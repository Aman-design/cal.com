import { expect } from "@playwright/test";
import { BookingStatus } from "@prisma/client";

import prisma from "@calcom/prisma";

import { test } from "./lib/fixtures";
import { selectFirstAvailableTimeSlotNextMonth } from "./lib/testUtils";

const IS_STRIPE_ENABLED = !!(
  process.env.STRIPE_CLIENT_ID &&
  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY &&
  process.env.STRIPE_PRIVATE_KEY
);

test.describe.configure({ mode: "parallel" });

test.describe("Reschedule Tests", async () => {
  test.afterEach(async ({ users }) => {
    await users.deleteAll();
  });
  test("Should do a booking request reschedule from /bookings", async ({ page, users, bookings }) => {
    const user = await users.create();

    const booking = await bookings.create(user.id, user.username, user.eventTypes[0].id!, {
      status: BookingStatus.ACCEPTED,
    });

    await user.login();
    await page.goto("/bookings/upcoming");

    await page.locator('[data-testid="edit_booking"]').nth(0).click();

    await page.locator('[data-testid="reschedule_request"]').click();

    await page.fill('[data-testid="reschedule_reason"]', "I can't longer have it");

    await page.locator('button[data-testid="send_request"]').click();
    await expect(page.locator('[id="modal-title"]')).not.toBeVisible();

    const updatedBooking = await booking.self();

    expect(updatedBooking.rescheduled).toBe(true);
    expect(updatedBooking.cancellationReason).toBe("I can't longer have it");
    expect(updatedBooking.status).toBe(BookingStatus.CANCELLED);
    await booking.delete();
  });

  test("Should display former time when rescheduling availability", async ({ page, users, bookings }) => {
    test.skip(true, "TODO: Re-enable after v1.7 launch");
    const user = await users.create();
    const booking = await bookings.create(user.id, user.username, user.eventTypes[0].id!, {
      status: BookingStatus.CANCELLED,
      rescheduled: true,
    });

    await page.goto(`/${user.username}/${user.eventTypes[0].slug}?rescheduleUid=${booking.uid}`);
    const formerTimeElement = page.locator('[data-testid="former_time_p_desktop"]');
    await expect(formerTimeElement).toBeVisible();
    await booking.delete();
  });

  test("Should display request reschedule send on bookings/cancelled", async ({ page, users, bookings }) => {
    const user = await users.create();
    const booking = await bookings.create(user.id, user.username, user.eventTypes[0].id, {
      status: BookingStatus.CANCELLED,
      rescheduled: true,
    });

    await user.login();
    await page.goto("/bookings/cancelled");

    const requestRescheduleSentElement = page.locator('[data-testid="request_reschedule_sent"]').nth(1);
    await expect(requestRescheduleSentElement).toBeVisible();
    await booking.delete();
  });

  test("Should do a reschedule from user owner", async ({ page, users, bookings }) => {
    const user = await users.create();
    const [eventType] = user.eventTypes;
    const booking = await bookings.create(user.id, user.username, eventType.id, {
      status: BookingStatus.CANCELLED,
      rescheduled: true,
    });

    await page.goto(`/${user.username}/${eventType.slug}?rescheduleUid=${booking.uid}`);

    await selectFirstAvailableTimeSlotNextMonth(page);

    await expect(page.locator('[name="name"]')).toBeDisabled();
    await expect(page.locator('[name="email"]')).toBeDisabled();

    await page.locator('[data-testid="confirm-reschedule-button"]').click();

    await expect(page.locator("[data-testid=success-page]")).toBeVisible();

    // NOTE: remove if old booking should not be deleted
    expect(await booking.self()).toBeNull();

    const newBooking = await prisma.booking.findFirst({ where: { fromReschedule: booking.uid } });
    expect(newBooking).not.toBeNull();
    await prisma.booking.delete({ where: { id: newBooking?.id } });
  });

  test("Unpaid rescheduling should go to payment page", async ({ page, users, bookings, payments }) => {
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(!IS_STRIPE_ENABLED, "Skipped as Stripe is not installed");
    const user = await users.create();
    await user.login();
    await user.getPaymentCredential();
    const eventType = user.eventTypes.find((e) => e.slug === "paid")!;
    const booking = await bookings.create(user.id, user.username, eventType.id, {
      rescheduled: true,
      status: BookingStatus.CANCELLED,
      paid: false,
    });

    const payment = await payments.create(booking.id);
    await page.goto(`/${user.username}/${eventType.slug}?rescheduleUid=${booking.uid}`);

    await selectFirstAvailableTimeSlotNextMonth(page);

    await page.locator('[data-testid="confirm-reschedule-button"]').click();

    await page.waitForNavigation({
      url(url) {
        return url.pathname.indexOf("/payment") > -1;
      },
    });

    await expect(page).toHaveURL(/.*payment/);
    await payment.delete();
  });

  test("Paid rescheduling should go to success page", async ({ page, users, bookings, payments }) => {
    const user = await users.create();
    await user.login();
    await user.getPaymentCredential();
    await users.logout();
    const eventType = user.eventTypes.find((e) => e.slug === "paid")!;
    const booking = await bookings.create(user.id, user.username, eventType.id, {
      rescheduled: true,
      status: BookingStatus.CANCELLED,
      paid: true,
    });

    const payment = await payments.create(booking.id);
    await page.goto(`/${user?.username}/${eventType?.slug}?rescheduleUid=${booking?.uid}`);

    await selectFirstAvailableTimeSlotNextMonth(page);

    await page.locator('[data-testid="confirm-reschedule-button"]').click();

    await expect(page).toHaveURL(/.*success/);

    await payment.delete();
  });

  test("Opt in event should be PENDING when rescheduled by USER", async ({ page, users, bookings }) => {
    const user = await users.create();
    const eventType = user.eventTypes.find((e) => e.slug === "opt-in")!;
    const booking = await bookings.create(user.id, user.username, eventType.id, {
      status: BookingStatus.ACCEPTED,
    });

    await page.goto(`/${user.username}/${eventType.slug}?rescheduleUid=${booking.uid}`);

    await selectFirstAvailableTimeSlotNextMonth(page);

    await page.locator('[data-testid="confirm-reschedule-button"]').click();

    await expect(page).toHaveURL(/.*success/);

    const newBooking = await prisma.booking.findFirst({ where: { fromReschedule: booking?.uid } });
    expect(newBooking).not.toBeNull();
    expect(newBooking?.status).toBe(BookingStatus.PENDING);
  });

  test("Opt in event should be ACCEPTED when rescheduled by OWNER", async ({ page, users, bookings }) => {
    const user = await users.create();
    const eventType = user.eventTypes.find((e) => e.slug === "opt-in")!;
    const booking = await bookings.create(user.id, user.username, eventType.id, {
      status: BookingStatus.ACCEPTED,
    });
    await user.login();

    await page.goto(`/${user.username}/${eventType.slug}?rescheduleUid=${booking.uid}`);

    await selectFirstAvailableTimeSlotNextMonth(page);

    await page.locator('[data-testid="confirm-reschedule-button"]').click();

    await expect(page).toHaveURL(/.*success/);

    const newBooking = await prisma.booking.findFirst({ where: { fromReschedule: booking?.uid } });
    expect(newBooking).not.toBeNull();
    expect(newBooking?.status).toBe(BookingStatus.ACCEPTED);
  });
});
