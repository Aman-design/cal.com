import { expect } from "@playwright/test";

import { test } from "./lib/fixtures";

test.afterEach(({ users }) => users.deleteAll());

test.describe("Change Password Test", () => {
  test("change password", async ({ page, users }) => {
    const pro = await users.create();
    await pro.login();
    // Go to http://localhost:3000/settings/security
    await page.goto("/settings/security/password");
    if (!pro.username) throw Error("Test user doesn't have a username");

    await page.waitForLoadState("networkidle");

    // Fill form
    await page.locator('[name="oldPassword"]').fill(pro.username);

    const $newPasswordField = page.locator('[name="newPassword"]');
    $newPasswordField.fill(`${pro.username}Aa1111`);

    await page.locator("text=Update").click();

    const toast = await page.waitForSelector("div[class*='data-testid-toast-success']");

    await expect(toast).toBeTruthy();
  });
});
