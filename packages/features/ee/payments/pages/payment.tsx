import { GetServerSidePropsContext } from "next";
import { z } from "zod";

import { PaymentData } from "@calcom/app-store/stripepayment/lib/server";
import prisma from "@calcom/prisma";
import { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";
import type { inferSSRProps } from "@calcom/types/inferSSRProps";

import { ssrInit } from "@server/lib/ssr";

export type PaymentPageProps = inferSSRProps<typeof getServerSideProps>;

const querySchema = z.object({
  uid: z.string(),
});

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const ssr = await ssrInit(context);

  const { uid } = querySchema.parse(context.query);
  const rawPayment = await prisma.payment.findFirst({
    where: {
      uid,
    },
    select: {
      data: true,
      success: true,
      uid: true,
      refunded: true,
      bookingId: true,
      booking: {
        select: {
          id: true,
          uid: true,
          description: true,
          title: true,
          startTime: true,
          attendees: {
            select: {
              email: true,
              name: true,
            },
          },
          eventTypeId: true,
          location: true,
          eventType: {
            select: {
              id: true,
              title: true,
              description: true,
              length: true,
              eventName: true,
              requiresConfirmation: true,
              userId: true,
              metadata: true,
              users: {
                select: {
                  name: true,
                  username: true,
                  hideBranding: true,
                  plan: true,
                  theme: true,
                },
              },
              team: {
                select: {
                  name: true,
                  hideBranding: true,
                },
              },
              price: true,
              currency: true,
            },
          },
        },
      },
    },
  });

  if (!rawPayment) return { notFound: true };

  const { data, booking: _booking, ...restPayment } = rawPayment;
  const payment = {
    ...restPayment,
    data: data as unknown as PaymentData,
  };

  if (!_booking) return { notFound: true };

  const { startTime, eventType, ...restBooking } = _booking;
  const booking = {
    ...restBooking,
    startTime: startTime.toString(),
  };

  if (!eventType) return { notFound: true };

  const [user] = eventType.users;
  if (!user) return { notFound: true };

  const profile = {
    name: eventType.team?.name || user?.name || null,
    theme: (!eventType.team?.name && user?.theme) || null,
    hideBranding: eventType.team?.hideBranding || user?.hideBranding || null,
  };

  return {
    props: {
      user,
      eventType: {
        ...eventType,
        metadata: EventTypeMetaDataSchema.parse(eventType.metadata),
      },
      booking,
      trpcState: ssr.dehydrate(),
      payment,
      profile,
    },
  };
};
