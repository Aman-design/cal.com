import { test as base } from "@playwright/test";

import prisma from "@calcom/prisma";

import { createBookingsFixture } from "../fixtures/bookings";
import { createEmbedsFixture, createGetActionFiredDetails } from "../fixtures/embeds";
import { createPaymentsFixture } from "../fixtures/payments";
import { createServersFixture } from "../fixtures/servers";
import { createUsersFixture } from "../fixtures/users";

export interface Fixtures {
  users: ReturnType<typeof createUsersFixture>;
  bookings: ReturnType<typeof createBookingsFixture>;
  payments: ReturnType<typeof createPaymentsFixture>;
  addEmbedListeners: ReturnType<typeof createEmbedsFixture>;
  getActionFiredDetails: ReturnType<typeof createGetActionFiredDetails>;
  servers: ReturnType<typeof createServersFixture>;
  prisma: typeof prisma;
}

/**
 *  @see https://playwright.dev/docs/test-fixtures
 */
export const test = base.extend<Fixtures>({
  users: async ({ page }, use, workerInfo) => {
    const usersFixture = createUsersFixture(page, workerInfo);
    await use(usersFixture);
  },
  bookings: async ({ page }, use) => {
    const bookingsFixture = createBookingsFixture(page);
    await use(bookingsFixture);
  },
  payments: async ({ page }, use) => {
    const payemntsFixture = createPaymentsFixture(page);
    await use(payemntsFixture);
  },
  addEmbedListeners: async ({ page }, use) => {
    const embedsFixture = createEmbedsFixture(page);
    await use(embedsFixture);
  },
  getActionFiredDetails: async ({ page }, use) => {
    const getActionFiredDetailsFixture = createGetActionFiredDetails(page);
    await use(getActionFiredDetailsFixture);
  },
  servers: async ({}, use) => {
    const servers = createServersFixture();
    await use(servers);
  },
  prisma: async ({}, use) => {
    await use(prisma);
  },
});
