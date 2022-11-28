/* eslint-disable playwright/no-skipped-test */
import { expect } from "@playwright/test";
import { UserPlan } from "@prisma/client";

import { test } from "./lib/fixtures";

test.describe.configure({ mode: "serial" });

test.describe("Onboarding", () => {
  test.describe("Onboarding v2", () => {
    test("Onboarding Flow", async ({ page, users }) => {
      const user = await users.create({ plan: UserPlan.TRIAL, completedOnboarding: false, name: null });
      await user.login();

      // tests whether the user makes it to /getting-started
      // after login with completedOnboarding false
      await page.waitForURL("/getting-started");

      await test.step("step 1", async () => {
        // Check required fields
        await page.locator("button[type=submit]").click();
        await expect(page.locator("data-testid=required")).toBeVisible();

        // happy path
        await page.locator("input[name=username]").fill("new user onboarding");
        await page.locator("input[name=name]").fill("new user 2");
        await page.locator("input[role=combobox]").click();
        await page.locator("text=Eastern Time").click();

        await page.locator("button[type=submit]").click();

        // should be on step 2 now.
        await expect(page).toHaveURL(/.*connected-calendar/);

        const userComplete = await user.self();
        expect(userComplete.name).toBe("new user 2");
      });

      await test.step("step 2", async () => {
        const isDisabled = await page.locator("button[data-testid=save-calendar-button]").isDisabled();
        await expect(isDisabled).toBe(true);
        // tests skip button, we don't want to test entire flow.
        await page.locator("button[data-testid=skip-step]").click();

        await expect(page).toHaveURL(/.*setup-availability/);
      });

      await test.step("step 3", async () => {
        const isDisabled = await page.locator("button[data-testid=save-availability]").isDisabled();
        await expect(isDisabled).toBe(false);
        // same here, skip this step.
        await page.locator("button[data-testid=skip-step]").click();

        await expect(page).toHaveURL(/.*user-profile/);
      });

      await test.step("step 4", async () => {
        const finishButton = await page.locator("button[type=submit]");
        // bio field is required, try to submit (and test whether that fails)
        await finishButton.click();

        const requiredBio = await page.locator("data-testid=required");
        await expect(requiredBio).toBeVisible();

        await page.locator("textarea[name=bio]").fill("Something about me");

        const isDisabled = await finishButton.isDisabled();
        await expect(isDisabled).toBe(false);

        await finishButton.click();

        // should redirect to /event-types after onboarding
        await page.waitForURL("/event-types");

        const userComplete = await user.self();
        expect(userComplete.bio).toBe("Something about me");
      });
    });
  });
});
