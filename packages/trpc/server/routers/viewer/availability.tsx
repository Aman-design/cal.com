import { Availability as AvailabilityModel, Prisma, Schedule as ScheduleModel, User } from "@prisma/client";
import { z } from "zod";

import { getUserAvailability } from "@calcom/core/getUserAvailability";
import { DEFAULT_SCHEDULE, getAvailabilityFromSchedule } from "@calcom/lib/availability";
import { PrismaClient } from "@calcom/prisma/client";
import { stringOrNumber } from "@calcom/prisma/zod-utils";
import { Schedule } from "@calcom/types/schedule";

import { TRPCError } from "@trpc/server";

import { router, authedProcedure } from "../../trpc";

export const availabilityRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    const { prisma, user } = ctx;

    const schedules = await prisma.schedule.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        name: true,
        availability: true,
        timeZone: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    const defaultScheduleId = await getDefaultScheduleId(user.id, prisma);

    return {
      schedules: schedules.map((schedule) => ({
        ...schedule,
        isDefault: schedule.id === defaultScheduleId,
      })),
    };
  }),
  user: authedProcedure
    .input(
      z.object({
        username: z.string(),
        dateFrom: z.string(),
        dateTo: z.string(),
        eventTypeId: stringOrNumber.optional(),
        withSource: z.boolean().optional(),
      })
    )
    .query(({ input }) => {
      return getUserAvailability(input);
    }),
  schedule: router({
    get: authedProcedure
      .input(
        z.object({
          scheduleId: z.optional(z.number()),
        })
      )
      .query(async ({ ctx, input }) => {
        const { prisma, user } = ctx;
        const schedule = await prisma.schedule.findUnique({
          where: {
            id: input.scheduleId || (await getDefaultScheduleId(user.id, prisma)),
          },
          select: {
            id: true,
            userId: true,
            name: true,
            availability: true,
            timeZone: true,
            eventType: {
              select: {
                _count: true,
                id: true,
                eventName: true,
              },
            },
          },
        });
        if (!schedule || schedule.userId !== user.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
          });
        }
        const availability = convertScheduleToAvailability(schedule);
        return {
          schedule,
          availability,
          timeZone: schedule.timeZone || user.timeZone,
          isDefault: !input.scheduleId || user.defaultScheduleId === schedule.id,
        };
      }),
    create: authedProcedure
      .input(
        z.object({
          name: z.string(),
          copyScheduleId: z.number().optional(),
          schedule: z
            .array(
              z.array(
                z.object({
                  start: z.date(),
                  end: z.date(),
                })
              )
            )
            .optional(),
          eventTypeId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { user, prisma } = ctx;
        const data: Prisma.ScheduleCreateInput = {
          name: input.name,
          user: {
            connect: {
              id: user.id,
            },
          },
          // If an eventTypeId is provided then connect the new schedule to that event type
          ...(input.eventTypeId && { eventType: { connect: { id: input.eventTypeId } } }),
        };

        const availability = getAvailabilityFromSchedule(input.schedule || DEFAULT_SCHEDULE);
        data.availability = {
          createMany: {
            data: availability.map((schedule) => ({
              days: schedule.days,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
            })),
          },
        };

        const schedule = await prisma.schedule.create({
          data,
        });
        const hasDefaultScheduleId = await hasDefaultSchedule(user, prisma);
        if (!hasDefaultScheduleId) {
          await setupDefaultSchedule(user.id, schedule.id, prisma);
        }

        return { schedule };
      }),
    delete: authedProcedure
      .input(
        z.object({
          scheduleId: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { user, prisma } = ctx;

        const scheduleToDelete = await prisma.schedule.findFirst({
          where: {
            id: input.scheduleId,
          },
          select: {
            userId: true,
          },
        });

        if (scheduleToDelete?.userId !== user.id) throw new TRPCError({ code: "UNAUTHORIZED" });

        if (user.defaultScheduleId === input.scheduleId) {
          // set a new default or unset default if no other schedule
          const scheduleToSetAsDefault = await prisma.schedule.findFirst({
            where: {
              userId: user.id,
              NOT: {
                id: input.scheduleId,
              },
            },
            select: {
              id: true,
            },
          });

          await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              defaultScheduleId: scheduleToSetAsDefault?.id,
            },
          });
        }
        await prisma.schedule.delete({
          where: {
            id: input.scheduleId,
          },
        });
      }),
    update: authedProcedure
      .input(
        z.object({
          scheduleId: z.number(),
          timeZone: z.string().optional(),
          name: z.string().optional(),
          isDefault: z.boolean().optional(),
          schedule: z.array(
            z.array(
              z.object({
                start: z.date(),
                end: z.date(),
              })
            )
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { user, prisma } = ctx;
        const availability = getAvailabilityFromSchedule(input.schedule);

        let updatedUser;
        if (input.isDefault) {
          const setupDefault = await setupDefaultSchedule(user.id, input.scheduleId, prisma);
          updatedUser = setupDefault;
        }

        // Not able to update the schedule with userId where clause, so fetch schedule separately and then validate
        // Bug: https://github.com/prisma/prisma/issues/7290
        const userSchedule = await prisma.schedule.findUnique({
          where: {
            id: input.scheduleId,
          },
          select: {
            userId: true,
          },
        });

        if (userSchedule?.userId !== user.id) throw new TRPCError({ code: "UNAUTHORIZED" });

        if (!userSchedule || userSchedule.userId !== user.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
          });
        }

        const schedule = await prisma.schedule.update({
          where: {
            id: input.scheduleId,
          },
          data: {
            timeZone: input.timeZone,
            name: input.name,
            availability: {
              deleteMany: {
                scheduleId: {
                  equals: input.scheduleId,
                },
              },
              createMany: {
                data: availability.map((schedule) => ({
                  days: schedule.days,
                  startTime: schedule.startTime,
                  endTime: schedule.endTime,
                })),
              },
            },
          },
          select: {
            id: true,
            userId: true,
            name: true,
            availability: true,
            timeZone: true,
            eventType: {
              select: {
                _count: true,
                id: true,
                eventName: true,
              },
            },
          },
        });

        const userAvailability = convertScheduleToAvailability(schedule);

        return {
          schedule,
          availability: userAvailability,
          timeZone: schedule.timeZone || user.timeZone,
          isDefault: updatedUser
            ? updatedUser.defaultScheduleId === schedule.id
            : user.defaultScheduleId === schedule.id,
          prevDefaultId: user.defaultScheduleId,
          currentDefaultId: updatedUser ? updatedUser.defaultScheduleId : user.defaultScheduleId,
        };
      }),
  }),
});

export const convertScheduleToAvailability = (
  schedule: Partial<ScheduleModel> & { availability: AvailabilityModel[] }
) => {
  return schedule.availability.reduce(
    (schedule: Schedule, availability) => {
      availability.days.forEach((day) => {
        schedule[day].push({
          start: new Date(
            Date.UTC(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth(),
              new Date().getUTCDate(),
              availability.startTime.getUTCHours(),
              availability.startTime.getUTCMinutes()
            )
          ),
          end: new Date(
            Date.UTC(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth(),
              new Date().getUTCDate(),
              availability.endTime.getUTCHours(),
              availability.endTime.getUTCMinutes()
            )
          ),
        });
      });
      return schedule;
    },
    Array.from([...Array(7)]).map(() => [])
  );
};

const setupDefaultSchedule = async (userId: number, scheduleId: number, prisma: PrismaClient) => {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      defaultScheduleId: scheduleId,
    },
  });
};

const isDefaultSchedule = (scheduleId: number, user: Partial<User>) => {
  return !user.defaultScheduleId || user.defaultScheduleId === scheduleId;
};

const getDefaultScheduleId = async (userId: number, prisma: PrismaClient) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      defaultScheduleId: true,
    },
  });

  if (user?.defaultScheduleId) {
    return user.defaultScheduleId;
  }

  const defaultSchedule = await prisma.schedule.findFirst({
    where: {
      userId,
    },
    select: {
      id: true,
    },
  });

  return defaultSchedule?.id; // TODO: Handle no schedules AT ALL
};

const hasDefaultSchedule = async (user: Partial<User>, prisma: PrismaClient) => {
  const defaultSchedule = await prisma.schedule.findFirst({
    where: {
      userId: user.id,
    },
  });
  return !!user.defaultScheduleId || !!defaultSchedule;
};
