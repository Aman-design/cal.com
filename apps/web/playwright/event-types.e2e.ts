import { expect } from "@playwright/test";

import { WEBAPP_URL } from "@calcom/lib/constants";

import { randomString } from "../lib/random";
import { test } from "./lib/fixtures";

test.describe.configure({ mode: "parallel" });

test.describe("Event Types tests", () => {
  test.describe("pro user", () => {
    test.beforeEach(async ({ page, users }) => {
      const proUser = await users.create();
      await proUser.login();
      await page.goto("/event-types");
      // We wait until loading is finished
      await page.waitForSelector('[data-testid="event-types"]');
    });

    test.afterEach(async ({ users }) => {
      await users.deleteAll();
    });

    test("has at least 2 events", async ({ page }) => {
      const $eventTypes = page.locator("[data-testid=event-types] > li a");
      const count = await $eventTypes.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test("can add new event type", async ({ page }) => {
      await page.click("[data-testid=new-event-type]");
      const nonce = randomString(3);
      const eventTitle = `hello ${nonce}`;

      await page.fill("[name=title]", eventTitle);
      await page.fill("[name=length]", "10");
      await page.click("[type=submit]");

      await page.waitForNavigation({
        url(url) {
          return url.pathname !== "/event-types";
        },
      });

      await page.goto("/event-types");
      await expect(page.locator(`text='${eventTitle}'`)).toBeVisible();
    });

    test("enabling recurring event comes with default options", async ({ page }) => {
      await page.click("[data-testid=new-event-type]");
      const nonce = randomString(3);
      const eventTitle = `my recurring event ${nonce}`;

      await page.fill("[name=title]", eventTitle);
      await page.fill("[name=length]", "15");
      await page.click("[type=submit]");

      await page.waitForNavigation({
        url(url) {
          return url.pathname !== "/event-types";
        },
      });

      await page.click("[data-testid=vertical-tab-recurring]");
      await expect(page.locator("[data-testid=recurring-event-collapsible]")).not.toBeVisible();
      await page.click("[data-testid=recurring-event-check]");
      await expect(page.locator("[data-testid=recurring-event-collapsible]")).toBeVisible();

      expect(
        await page
          .locator("[data-testid=recurring-event-collapsible] input[type=number]")
          .nth(0)
          .getAttribute("value")
      ).toBe("1");
      expect(
        await page.locator("[data-testid=recurring-event-collapsible] div[class$=singleValue]").textContent()
      ).toBe("week");
      expect(
        await page
          .locator("[data-testid=recurring-event-collapsible] input[type=number]")
          .nth(1)
          .getAttribute("value")
      ).toBe("12");
    });

    test("can duplicate an existing event type", async ({ page }) => {
      const firstElement = await page.waitForSelector(
        '[data-testid="event-types"] a[href^="/event-types/"] >> nth=0'
      );
      const href = await firstElement.getAttribute("href");
      if (!href) throw new Error("No href found for event type");
      const [eventTypeId] = new URL(WEBAPP_URL + href).pathname.split("/").reverse();
      const firstTitle = await page.locator(`[data-testid=event-type-title-${eventTypeId}]`).innerText();
      const firstFullSlug = await page.locator(`[data-testid=event-type-slug-${eventTypeId}]`).innerText();
      const firstSlug = firstFullSlug.split("/")[2];

      await page.click(`[data-testid=event-type-options-${eventTypeId}]`);
      await page.click(`[data-testid=event-type-duplicate-${eventTypeId}]`);

      const url = page.url();
      const params = new URLSearchParams(url);

      expect(params.get("title")).toBe(firstTitle);
      expect(params.get("slug")).toBe(firstSlug);

      const formTitle = await page.inputValue("[name=title]");
      const formSlug = await page.inputValue("[name=slug]");

      expect(formTitle).toBe(firstTitle);
      expect(formSlug).toBe(firstSlug);
    });
    test("edit first event", async ({ page }) => {
      const $eventTypes = page.locator("[data-testid=event-types] > li a");
      const firstEventTypeElement = $eventTypes.first();
      await firstEventTypeElement.click();
      await page.waitForNavigation({
        url: (url) => {
          return !!url.pathname.match(/\/event-types\/.+/);
        },
      });
      await page.locator("[data-testid=update-eventtype]").click();
      const toast = await page.waitForSelector("div[class*='data-testid-toast-success']");
      await expect(toast).toBeTruthy();
    });
  });

  test.describe("free user", () => {
    test.beforeEach(async ({ page, users }) => {
      const free = await users.create({ plan: "FREE" });
      await free.login();
      await page.goto("/event-types");
      // We wait until loading is finished
      await page.waitForSelector('[data-testid="event-types"]');
    });

    test("has at least 2 events where first is enabled", async ({ page }) => {
      const $eventTypes = page.locator("[data-testid=event-types] > li a");
      const count = await $eventTypes.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test("edit first event", async ({ page }) => {
      const $eventTypes = page.locator("[data-testid=event-types] > li a");
      const firstEventTypeElement = $eventTypes.first();
      await firstEventTypeElement.click();
      await page.waitForNavigation({
        url: (url) => {
          return !!url.pathname.match(/\/event-types\/.+/);
        },
      });
      await page.locator("[data-testid=update-eventtype]").click();
      const toast = await page.waitForSelector("div[class*='data-testid-toast-success']");
      await expect(toast).toBeTruthy();
    });
  });
});
