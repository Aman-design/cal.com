import { EventTypeCustomInput, MembershipRole, PeriodType, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
// REVIEW: From lint error
import _ from "lodash";
import { z } from "zod";

import getAppKeysFromSlug from "@calcom/app-store/_utils/getAppKeysFromSlug";
import { DailyLocationType } from "@calcom/app-store/locations";
import { stripeDataSchema } from "@calcom/app-store/stripepayment/lib/server";
import { validateBookingLimitOrder } from "@calcom/lib";
import { CAL_URL } from "@calcom/lib/constants";
import { baseEventTypeSelect, baseUserSelect } from "@calcom/prisma";
import { _DestinationCalendarModel, _EventTypeCustomInputModel, _EventTypeModel } from "@calcom/prisma/zod";
import { EventTypeMetaDataSchema, stringOrNumber } from "@calcom/prisma/zod-utils";
import { createEventTypeInput } from "@calcom/prisma/zod/custom/eventtype";

import { TRPCError } from "@trpc/server";

import { authedProcedure, router } from "../../trpc";
import { viewerRouter } from "../viewer";

function isPeriodType(keyInput: string): keyInput is PeriodType {
  return Object.keys(PeriodType).includes(keyInput);
}

function handlePeriodType(periodType: string | undefined): PeriodType | undefined {
  if (typeof periodType !== "string") return undefined;
  const passedPeriodType = periodType.toUpperCase();
  if (!isPeriodType(passedPeriodType)) return undefined;
  return PeriodType[passedPeriodType];
}

function handleCustomInputs(customInputs: EventTypeCustomInput[], eventTypeId: number) {
  const cInputsIdsToDelete = customInputs.filter((input) => input.id > 0).map((e) => e.id);
  const cInputsToCreate = customInputs
    .filter((input) => input.id < 0)
    .map((input) => ({
      type: input.type,
      label: input.label,
      required: input.required,
      placeholder: input.placeholder,
    }));
  const cInputsToUpdate = customInputs
    .filter((input) => input.id > 0)
    .map((input) => ({
      data: {
        type: input.type,
        label: input.label,
        required: input.required,
        placeholder: input.placeholder,
      },
      where: {
        id: input.id,
      },
    }));

  return {
    deleteMany: {
      eventTypeId,
      NOT: {
        id: { in: cInputsIdsToDelete },
      },
    },
    createMany: {
      data: cInputsToCreate,
    },
    update: cInputsToUpdate,
  };
}

const EventTypeUpdateInput = _EventTypeModel
  /** Optional fields */
  .extend({
    customInputs: z.array(_EventTypeCustomInputModel),
    destinationCalendar: _DestinationCalendarModel.pick({
      integration: true,
      externalId: true,
    }),
    users: z.array(stringOrNumber).optional(),
    schedule: z.number().optional(),
    hashedLink: z.string(),
  })
  .partial()
  .extend({
    metadata: EventTypeMetaDataSchema.optional(),
  })
  .merge(
    _EventTypeModel
      /** Required fields */
      .pick({
        id: true,
      })
  );

const eventOwnerProcedure = authedProcedure.use(async ({ ctx, rawInput, next }) => {
  // Prevent non-owners to update/delete a team event
  const event = await ctx.prisma.eventType.findUnique({
    where: { id: (rawInput as Record<"id", number>)?.id },
    include: {
      users: true,
      team: {
        select: {
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const isAuthorized = (function () {
    if (event.team) {
      return event.team.members
        .filter((member) => member.role === MembershipRole.OWNER || member.role === MembershipRole.ADMIN)
        .map((member) => member.userId)
        .includes(ctx.user.id);
    }
    return event.userId === ctx.user.id || event.users.find((user) => user.id === ctx.user.id);
  })();

  if (!isAuthorized) {
    console.warn(`User ${ctx.user.id} attempted to an access an event ${event.id} they do not own.`);
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const inputUsers = (rawInput as any).users || [];

  const isAllowed = (function () {
    if (event.team) {
      const allTeamMembers = event.team.members.map((member) => member.userId);
      return inputUsers.every((userId: string) => allTeamMembers.includes(Number.parseInt(userId)));
    }
    return inputUsers.every((userId: string) => Number.parseInt(userId) === ctx.user.id);
  })();

  if (!isAllowed) {
    console.warn(`User ${ctx.user.id} attempted to an create an event for users ${inputUsers.join(", ")}.`);
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next();
});

export const eventTypesRouter = router({
  // REVIEW: What should we name this procedure?
  getByViewer: authedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;
    const eventTypeSelect = Prisma.validator<Prisma.EventTypeSelect>()({
      // Position is required by lodash to sort on it. Don't remove it, TS won't complain but it would silently break reordering
      position: true,
      hashedLink: true,
      locations: true,
      destinationCalendar: true,
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          // logo: true, // Skipping to avoid 4mb limit
          bio: true,
          hideBranding: true,
        },
      },
      metadata: true,
      users: {
        select: baseUserSelect,
      },
      ...baseEventTypeSelect,
    });

    const user = await prisma.user.findUnique({
      where: {
        id: ctx.user.id,
      },
      select: {
        id: true,
        username: true,
        name: true,
        startTime: true,
        endTime: true,
        bufferTime: true,
        plan: true,
        teams: {
          where: {
            accepted: true,
          },
          select: {
            role: true,
            team: {
              select: {
                id: true,
                name: true,
                slug: true,
                members: {
                  select: {
                    userId: true,
                  },
                },
                eventTypes: {
                  select: eventTypeSelect,
                  orderBy: [
                    {
                      position: "desc",
                    },
                    {
                      id: "asc",
                    },
                  ],
                },
              },
            },
          },
        },
        eventTypes: {
          where: {
            team: null,
          },
          select: eventTypeSelect,
          orderBy: [
            {
              position: "desc",
            },
            {
              id: "asc",
            },
          ],
        },
      },
    });

    if (!user) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }

    const mapEventType = (eventType: typeof user.eventTypes[number]) => ({
      ...eventType,
      // @FIXME: cc @hariombalhara This is failing with production data
      // metadata: EventTypeMetaDataSchema.parse(eventType.metadata),
    });

    const userEventTypes = user.eventTypes.map(mapEventType);
    // backwards compatibility, TMP:
    const typesRaw = (
      await prisma.eventType.findMany({
        where: {
          userId: ctx.user.id,
        },
        select: eventTypeSelect,
        orderBy: [
          {
            position: "desc",
          },
          {
            id: "asc",
          },
        ],
      })
    ).map(mapEventType);

    type EventTypeGroup = {
      teamId?: number | null;
      profile: {
        slug: typeof user["username"];
        name: typeof user["name"];
      };
      metadata: {
        membershipCount: number;
        readOnly: boolean;
      };
      eventTypes: typeof userEventTypes;
    };

    let eventTypeGroups: EventTypeGroup[] = [];
    const eventTypesHashMap = userEventTypes.concat(typesRaw).reduce((hashMap, newItem) => {
      const oldItem = hashMap[newItem.id];
      hashMap[newItem.id] = { ...oldItem, ...newItem };
      return hashMap;
    }, {} as Record<number, EventTypeGroup["eventTypes"][number]>);
    const mergedEventTypes = Object.values(eventTypesHashMap).map((eventType) => eventType);
    eventTypeGroups.push({
      teamId: null,
      profile: {
        slug: user.username,
        name: user.name,
      },
      eventTypes: _.orderBy(mergedEventTypes, ["position", "id"], ["desc", "asc"]),
      metadata: {
        membershipCount: 1,
        readOnly: false,
      },
    });

    eventTypeGroups = ([] as EventTypeGroup[]).concat(
      eventTypeGroups,
      user.teams.map((membership) => ({
        teamId: membership.team.id,
        profile: {
          name: membership.team.name,
          image: `${CAL_URL}/team/${membership.team.slug}/avatar.png`,
          slug: "team/" + membership.team.slug,
        },
        metadata: {
          membershipCount: membership.team.members.length,
          readOnly: membership.role === MembershipRole.MEMBER,
        },
        eventTypes: membership.team.eventTypes.map(mapEventType),
      }))
    );
    return {
      viewer: {
        plan: user.plan,
      },
      // don't display event teams without event types,
      eventTypeGroups: eventTypeGroups.filter((groupBy) => !!groupBy.eventTypes?.length),
      // so we can show a dropdown when the user has teams
      profiles: eventTypeGroups.map((group) => ({
        teamId: group.teamId,
        ...group.profile,
        ...group.metadata,
      })),
    };
  }),
  list: authedProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.eventType.findMany({
      where: {
        userId: ctx.user.id,
        team: null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        length: true,
        schedulingType: true,
        slug: true,
        hidden: true,
        metadata: true,
      },
    });
  }),
  create: authedProcedure.input(createEventTypeInput).mutation(async ({ ctx, input }) => {
    const { schedulingType, teamId, ...rest } = input;
    const userId = ctx.user.id;

    const data: Prisma.EventTypeCreateInput = {
      ...rest,
      owner: teamId ? undefined : { connect: { id: userId } },
      users: {
        connect: {
          id: userId,
        },
      },
    };

    const appKeys = await getAppKeysFromSlug("daily-video");
    // Shouldn't override input locations
    if (rest.locations?.length === 0 && typeof appKeys.api_key === "string") {
      data.locations = [{ type: DailyLocationType }];
    }

    if (teamId && schedulingType) {
      const hasMembership = await ctx.prisma.membership.findFirst({
        where: {
          userId,
          teamId: teamId,
          accepted: true,
        },
      });

      if (!hasMembership?.role || !["ADMIN", "OWNER"].includes(hasMembership.role)) {
        console.warn(`User ${userId} does not have permission to create this new event type`);
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      data.team = {
        connect: {
          id: teamId,
        },
      };
      data.schedulingType = schedulingType;
    }

    try {
      const eventType = await ctx.prisma.eventType.create({ data });
      return { eventType };
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === "P2002" && Array.isArray(e.meta?.target) && e.meta?.target.includes("slug")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "URL Slug already exists for given user." });
        }
      }
      throw e;
    }
  }),
  get: eventOwnerProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: {
          id: ctx.user.id,
        },
        select: {
          id: true,
          username: true,
          name: true,
          startTime: true,
          endTime: true,
          bufferTime: true,
          avatar: true,
          plan: true,
        },
      });
      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      return await ctx.prisma.eventType.findUnique({
        where: {
          id: input.id,
        },
        include: {
          team: true,
          users: true,
        },
      });
    }),
  update: eventOwnerProcedure.input(EventTypeUpdateInput.strict()).mutation(async ({ ctx, input }) => {
    const {
      schedule,
      periodType,
      locations,
      bookingLimits,
      destinationCalendar,
      customInputs,
      recurringEvent,
      users,
      id,
      hashedLink,
      ...rest
    } = input;
    const data: Prisma.EventTypeUpdateInput = {
      ...rest,
      metadata: rest.metadata === null ? Prisma.DbNull : rest.metadata,
    };
    data.locations = locations ?? undefined;
    if (periodType) {
      data.periodType = handlePeriodType(periodType);
    }

    if (recurringEvent) {
      data.recurringEvent = {
        dstart: recurringEvent.dtstart as unknown as Prisma.InputJsonObject,
        interval: recurringEvent.interval,
        count: recurringEvent.count,
        freq: recurringEvent.freq,
        until: recurringEvent.until as unknown as Prisma.InputJsonObject,
        tzid: recurringEvent.tzid,
      };
    } else if (recurringEvent === null) {
      data.recurringEvent = Prisma.DbNull;
    }

    if (destinationCalendar) {
      /** We connect or create a destination calendar to the event type instead of the user */
      await viewerRouter.createCaller(ctx).setDestinationCalendar({
        ...destinationCalendar,
        eventTypeId: id,
      });
    }

    if (customInputs) {
      data.customInputs = handleCustomInputs(customInputs, id);
    }

    if (bookingLimits) {
      const isValid = validateBookingLimitOrder(bookingLimits);
      if (!isValid)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Booking limits must be in ascending order." });
      data.bookingLimits = bookingLimits;
    }

    if (schedule) {
      data.schedule = {
        connect: {
          id: schedule,
        },
      };
    }

    if (users) {
      data.users = {
        set: [],
        connect: users.map((userId: number) => ({ id: userId })),
      };
    }

    if (input?.price) {
      const paymentCredential = await ctx.prisma.credential.findFirst({
        where: {
          userId: ctx.user.id,
          type: {
            contains: "_payment",
          },
        },
        select: {
          type: true,
          key: true,
        },
      });

      if (paymentCredential?.type === "stripe_payment") {
        const { default_currency } = stripeDataSchema.parse(paymentCredential.key);
        data.currency = default_currency;
      }
    }

    const connectedLink = await ctx.prisma.hashedLink.findFirst({
      where: {
        eventTypeId: input.id,
      },
      select: {
        id: true,
      },
    });

    if (hashedLink) {
      // check if hashed connection existed. If it did, do nothing. If it didn't, add a new connection
      if (!connectedLink) {
        // create a hashed link
        await ctx.prisma.hashedLink.upsert({
          where: {
            eventTypeId: input.id,
          },
          update: {
            link: hashedLink,
          },
          create: {
            link: hashedLink,
            eventType: {
              connect: { id: input.id },
            },
          },
        });
      }
    } else {
      // check if hashed connection exists. If it does, disconnect
      if (connectedLink) {
        await ctx.prisma.hashedLink.delete({
          where: {
            eventTypeId: input.id,
          },
        });
      }
    }

    const eventType = await ctx.prisma.eventType.update({
      where: { id },
      data,
    });

    return { eventType };
  }),
  delete: eventOwnerProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      await ctx.prisma.eventTypeCustomInput.deleteMany({
        where: {
          eventTypeId: id,
        },
      });

      await ctx.prisma.eventType.delete({
        where: {
          id,
        },
      });

      return {
        id,
      };
    }),
});
