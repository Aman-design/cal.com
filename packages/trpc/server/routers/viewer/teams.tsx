import { MembershipRole, Prisma, UserPlan } from "@prisma/client";
import { randomBytes } from "crypto";
import { z } from "zod";

import { addSeat, getRequestedSlugError, removeSeat } from "@calcom/app-store/stripepayment/lib/team-billing";
import { getUserAvailability } from "@calcom/core/getUserAvailability";
import { sendTeamInviteEmail } from "@calcom/emails";
import {
  cancelTeamSubscriptionFromStripe,
  purchaseTeamSubscription,
} from "@calcom/features/ee/teams/lib/payments";
import { HOSTED_CAL_FEATURES, IS_TEAM_BILLING_ENABLED, WEBAPP_URL } from "@calcom/lib/constants";
import { getTranslation } from "@calcom/lib/server/i18n";
import { getTeamWithMembers, isTeamAdmin, isTeamMember, isTeamOwner } from "@calcom/lib/server/queries/teams";
import slugify from "@calcom/lib/slugify";
import {
  closeComDeleteTeam,
  closeComDeleteTeamMembership,
  closeComUpdateTeam,
  closeComUpsertTeamUser,
} from "@calcom/lib/sync/SyncServiceManager";
import { availabilityUserSelect } from "@calcom/prisma";
import { teamMetadataSchema } from "@calcom/prisma/zod-utils";

import { TRPCError } from "@trpc/server";

import { authedProcedure, router } from "../../trpc";

export const viewerTeamsRouter = router({
  // Retrieves team by id
  get: authedProcedure
    .input(
      z.object({
        teamId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const team = await getTeamWithMembers(input.teamId, undefined, ctx.user.id);
      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
      }
      const membership = team?.members.find((membership) => membership.id === ctx.user.id);

      return {
        ...team,
        membership: {
          role: membership?.role as MembershipRole,
          isMissingSeat: membership?.plan === UserPlan.FREE,
          accepted: membership?.accepted,
        },
        requiresUpgrade: HOSTED_CAL_FEATURES ? !!team.members.find((m) => m.plan !== UserPlan.PRO) : false,
      };
    }),
  // Returns teams I a member of
  list: authedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.membership.findMany({
      where: {
        userId: ctx.user.id,
      },
      include: {
        team: true,
      },
      orderBy: { role: "desc" },
    });

    return memberships.map(({ team, ...membership }) => ({
      role: membership.role,
      accepted: membership.accepted,
      ...team,
    }));
  }),
  create: authedProcedure
    .input(
      z.object({
        name: z.string(),
        slug: z.string().transform((val) => slugify(val.trim())),
        logo: z
          .string()
          .optional()
          .nullable()
          .transform((v) => v || null),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { slug, name, logo } = input;

      const nameCollisions = await ctx.prisma.team.findFirst({
        where: { OR: [{ name }, { slug }] },
      });

      if (nameCollisions) throw new TRPCError({ code: "BAD_REQUEST", message: "Team name already taken." });

      const createTeam = await ctx.prisma.team.create({
        data: {
          name,
          logo,
          members: {
            create: {
              userId: ctx.user.id,
              role: MembershipRole.OWNER,
              accepted: true,
            },
          },
          metadata: {
            requestedSlug: slug,
          },
        },
      });

      // Sync Services: Close.com
      closeComUpsertTeamUser(createTeam, ctx.user, MembershipRole.OWNER);

      return createTeam;
    }),
  // Allows team owner to update team metadata
  update: authedProcedure
    .input(
      z.object({
        id: z.number(),
        bio: z.string().optional(),
        name: z.string().optional(),
        logo: z.string().optional(),
        slug: z.string().optional(),
        hideBranding: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await isTeamAdmin(ctx.user?.id, input.id))) throw new TRPCError({ code: "UNAUTHORIZED" });

      if (input.slug) {
        const userConflict = await ctx.prisma.team.findMany({
          where: {
            slug: input.slug,
          },
        });
        if (userConflict.some((t) => t.id !== input.id)) return;
      }

      const prevTeam = await ctx.prisma.team.findFirst({
        where: {
          id: input.id,
        },
      });

      if (!prevTeam) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });

      const data: Prisma.TeamUpdateArgs["data"] = {
        name: input.name,
        logo: input.logo,
        bio: input.bio,
        hideBranding: input.hideBranding,
      };

      if (
        input.slug &&
        IS_TEAM_BILLING_ENABLED &&
        /** If the team doesn't have a slug we can assume that it hasn't been published yet. */
        !prevTeam.slug
      ) {
        // Save it on the metadata so we can use it later
        data.metadata = {
          requestedSlug: input.slug,
        };
      } else {
        data.slug = input.slug;

        // If we save slug, we don't need the requestedSlug anymore
        const metadataParse = teamMetadataSchema.safeParse(prevTeam.metadata);
        if (metadataParse.success) {
          const { requestedSlug, ...cleanMetadata } = metadataParse.data || {};
          data.metadata = {
            ...cleanMetadata,
          };
        }
      }

      const updatedTeam = await ctx.prisma.team.update({
        where: { id: input.id },
        data,
      });

      // Sync Services: Close.com
      if (prevTeam) closeComUpdateTeam(prevTeam, updatedTeam);
    }),
  delete: authedProcedure
    .input(
      z.object({
        teamId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await isTeamOwner(ctx.user?.id, input.teamId))) throw new TRPCError({ code: "UNAUTHORIZED" });

      if (IS_TEAM_BILLING_ENABLED) await cancelTeamSubscriptionFromStripe(input.teamId);

      // delete all memberships
      await ctx.prisma.membership.deleteMany({
        where: {
          teamId: input.teamId,
        },
      });

      const deletedTeam = await ctx.prisma.team.delete({
        where: {
          id: input.teamId,
        },
      });

      // Sync Services: Close.cm
      closeComDeleteTeam(deletedTeam);
    }),
  removeMember: authedProcedure
    .input(
      z.object({
        teamId: z.number(),
        memberId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await isTeamAdmin(ctx.user?.id, input.teamId);
      if (!isAdmin && ctx.user?.id !== input.memberId) throw new TRPCError({ code: "UNAUTHORIZED" });
      // Only a team owner can remove another team owner.
      if (
        (await isTeamOwner(input.memberId, input.teamId)) &&
        !(await isTeamOwner(ctx.user?.id, input.teamId))
      )
        throw new TRPCError({ code: "UNAUTHORIZED" });
      if (ctx.user?.id === input.memberId && isAdmin)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can not remove yourself from a team you own.",
        });

      const membership = await ctx.prisma.membership.delete({
        where: {
          userId_teamId: { userId: input.memberId, teamId: input.teamId },
        },
        include: {
          user: true,
        },
      });

      // Sync Services
      closeComDeleteTeamMembership(membership.user);

      if (HOSTED_CAL_FEATURES) await removeSeat(ctx.user.id, input.teamId, input.memberId);
    }),
  inviteMember: authedProcedure
    .input(
      z.object({
        teamId: z.number(),
        usernameOrEmail: z.string(),
        role: z.nativeEnum(MembershipRole),
        language: z.string(),
        sendEmailInvitation: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await isTeamAdmin(ctx.user?.id, input.teamId))) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (input.role === MembershipRole.OWNER && !(await isTeamOwner(ctx.user?.id, input.teamId)))
        throw new TRPCError({ code: "UNAUTHORIZED" });

      const translation = await getTranslation(input.language ?? "en", "common");

      const team = await ctx.prisma.team.findFirst({
        where: {
          id: input.teamId,
        },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });

      const invitee = await ctx.prisma.user.findFirst({
        where: {
          OR: [{ username: input.usernameOrEmail }, { email: input.usernameOrEmail }],
        },
      });

      let inviteeUserId: number | undefined = invitee?.id;

      if (!invitee) {
        // liberal email match
        const isEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

        if (!isEmail(input.usernameOrEmail))
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Invite failed because there is no corresponding user for ${input.usernameOrEmail}`,
          });

        // valid email given, create User and add to team
        const user = await ctx.prisma.user.create({
          data: {
            email: input.usernameOrEmail,
            invitedTo: input.teamId,
            teams: {
              create: {
                teamId: input.teamId,
                role: input.role as MembershipRole,
              },
            },
          },
        });
        inviteeUserId = user.id;

        const token: string = randomBytes(32).toString("hex");

        await ctx.prisma.verificationToken.create({
          data: {
            identifier: input.usernameOrEmail,
            token,
            expires: new Date(new Date().setHours(168)), // +1 week
          },
        });

        if (ctx?.user?.name && team?.name) {
          await sendTeamInviteEmail({
            language: translation,
            from: ctx.user.name,
            to: input.usernameOrEmail,
            teamName: team.name,
            joinLink: `${WEBAPP_URL}/signup?token=${token}&callbackUrl=/settings/teams`,
          });
        }
      } else {
        // create provisional membership
        try {
          await ctx.prisma.membership.create({
            data: {
              teamId: input.teamId,
              userId: invitee.id,
              role: input.role as MembershipRole,
            },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === "P2002") {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "This user is a member of this team / has a pending invitation.",
              });
            }
          } else throw e;
        }

        // inform user of membership by email
        if (input.sendEmailInvitation && ctx?.user?.name && team?.name) {
          await sendTeamInviteEmail({
            language: translation,
            from: ctx.user.name,
            to: input.usernameOrEmail,
            teamName: team.name,
            joinLink: WEBAPP_URL + "/settings/teams",
          });
        }
      }
      try {
        if (HOSTED_CAL_FEATURES) await addSeat(ctx.user.id, team.id, inviteeUserId);
      } catch (e) {
        console.log(e);
      }
    }),
  acceptOrLeave: authedProcedure
    .input(
      z.object({
        teamId: z.number(),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.accept) {
        const membership = await ctx.prisma.membership.update({
          where: {
            userId_teamId: { userId: ctx.user.id, teamId: input.teamId },
          },
          data: {
            accepted: true,
          },
          include: {
            team: true,
          },
        });

        closeComUpsertTeamUser(membership.team, ctx.user, membership.role);
      } else {
        try {
          //get team owner so we can alter their subscription seat count
          const teamOwner = await ctx.prisma.membership.findFirst({
            where: { teamId: input.teamId, role: MembershipRole.OWNER },
            include: { team: true },
          });

          // TODO: disable if not hosted by Cal
          if (teamOwner) await removeSeat(teamOwner.userId, input.teamId, ctx.user.id);

          const membership = await ctx.prisma.membership.delete({
            where: {
              userId_teamId: { userId: ctx.user.id, teamId: input.teamId },
            },
          });

          // Sync Services: Close.com
          if (teamOwner) closeComUpsertTeamUser(teamOwner.team, ctx.user, membership.role);
        } catch (e) {
          console.log(e);
        }
      }
    }),
  changeMemberRole: authedProcedure
    .input(
      z.object({
        teamId: z.number(),
        memberId: z.number(),
        role: z.nativeEnum(MembershipRole),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await isTeamAdmin(ctx.user?.id, input.teamId))) throw new TRPCError({ code: "UNAUTHORIZED" });
      // Only owners can award owner role.
      if (input.role === MembershipRole.OWNER && !(await isTeamOwner(ctx.user?.id, input.teamId)))
        throw new TRPCError({ code: "UNAUTHORIZED" });
      const memberships = await ctx.prisma.membership.findMany({
        where: {
          teamId: input.teamId,
        },
      });

      const targetMembership = memberships.find((m) => m.userId === input.memberId);
      const myMembership = memberships.find((m) => m.userId === ctx.user.id);
      const teamHasMoreThanOneOwner = memberships.some((m) => m.role === MembershipRole.OWNER);

      if (myMembership?.role === MembershipRole.ADMIN && targetMembership?.role === MembershipRole.OWNER) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can not change the role of an owner if you are an admin.",
        });
      }

      if (!teamHasMoreThanOneOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can not change the role of the only owner of a team.",
        });
      }

      if (myMembership?.role === MembershipRole.ADMIN && input.memberId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can not change yourself to a higher role.",
        });
      }

      const membership = await ctx.prisma.membership.update({
        where: {
          userId_teamId: { userId: input.memberId, teamId: input.teamId },
        },
        data: {
          role: input.role,
        },
        include: {
          team: true,
          user: true,
        },
      });

      // Sync Services: Close.com
      closeComUpsertTeamUser(membership.team, membership.user, membership.role);
    }),
  getMemberAvailability: authedProcedure
    .input(
      z.object({
        teamId: z.number(),
        memberId: z.number(),
        timezone: z.string(),
        dateFrom: z.string(),
        dateTo: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const team = await isTeamMember(ctx.user?.id, input.teamId);
      if (!team) throw new TRPCError({ code: "UNAUTHORIZED" });

      // verify member is in team
      const members = await ctx.prisma.membership.findMany({
        where: { teamId: input.teamId },
        include: {
          user: {
            select: {
              ...availabilityUserSelect,
            },
          },
        },
      });
      const member = members?.find((m) => m.userId === input.memberId);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      if (!member.user.username)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Member doesn't have a username" });

      // get availability for this member
      return await getUserAvailability(
        {
          username: member.user.username,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        },
        { user: member.user }
      );
    }),
  getMembershipbyUser: authedProcedure
    .input(
      z.object({
        teamId: z.number(),
        memberId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.id !== input.memberId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You cannot view memberships that are not your own.",
        });
      }

      return await ctx.prisma.membership.findUnique({
        where: {
          userId_teamId: {
            userId: input.memberId,
            teamId: input.teamId,
          },
        },
      });
    }),
  updateMembership: authedProcedure
    .input(
      z.object({
        teamId: z.number(),
        memberId: z.number(),
        disableImpersonation: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id !== input.memberId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You cannot edit memberships that are not your own.",
        });
      }

      return await ctx.prisma.membership.update({
        where: {
          userId_teamId: {
            userId: input.memberId,
            teamId: input.teamId,
          },
        },
        data: {
          disableImpersonation: input.disableImpersonation,
        },
      });
    }),
  validateTeamSlug: authedProcedure
    .input(
      z.object({
        slug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const team = await ctx.prisma.team.findFirst({
        where: {
          slug: input.slug,
        },
      });

      return !team;
    }),
  publish: authedProcedure
    .input(
      z.object({
        teamId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await isTeamAdmin(ctx.user.id, input.teamId))) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { teamId: id } = input;

      const prevTeam = await ctx.prisma.team.findFirst({ where: { id }, include: { members: true } });

      if (!prevTeam) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });

      const metadata = teamMetadataSchema.safeParse(prevTeam.metadata);

      if (!metadata.success) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid team metadata" });

      // if payment needed, respond with checkout url
      if (IS_TEAM_BILLING_ENABLED) {
        const checkoutSession = await purchaseTeamSubscription({
          teamId: prevTeam.id,
          seats: prevTeam.members.length,
          userId: ctx.user.id,
        });
        if (!checkoutSession.url)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed retrieving a checkout session URL.",
          });
        return { url: checkoutSession.url, message: "Payment required to publish team" };
      }

      if (!metadata.data?.requestedSlug) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can't publish team without `requestedSlug`" });
      }

      const { requestedSlug, ...newMetadata } = metadata.data;
      let updatedTeam: Awaited<ReturnType<typeof ctx.prisma.team.update>>;

      try {
        updatedTeam = await ctx.prisma.team.update({
          where: { id },
          data: {
            slug: requestedSlug,
            metadata: { ...newMetadata },
          },
        });
      } catch (error) {
        const { message } = getRequestedSlugError(error, requestedSlug);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }

      // Sync Services: Close.com
      closeComUpdateTeam(prevTeam, updatedTeam);

      return {
        url: `${WEBAPP_URL}/settings/teams/${updatedTeam.id}/profile`,
        message: "Team published succesfully",
      };
    }),
  /** This is a temporal endpoint so we can progressively upgrade teams to the new billing system. */
  getUpgradeable: authedProcedure.query(async ({ ctx }) => {
    if (!IS_TEAM_BILLING_ENABLED) return [];
    let { teams } = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.user.id },
      include: { teams: { where: { role: MembershipRole.OWNER }, include: { team: true } } },
    });
    /** We only need to return teams that don't have a `subscriptionId` on their metadata */
    teams = teams.filter((m) => {
      const metadata = teamMetadataSchema.safeParse(m.team.metadata);
      if (metadata.success && metadata.data?.subscriptionId) return false;
      return true;
    });
    return teams;
  }),
});
