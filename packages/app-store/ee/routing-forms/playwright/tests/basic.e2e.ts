import { expect, Page } from "@playwright/test";

import { Fixtures, test } from "@calcom/web/playwright/lib/fixtures";

async function gotoRoutingLink(page: Page, formId: string) {
  await page.goto(`/forms/${formId}`);
  // HACK: There seems to be some issue with the inputs to the form getting reset if we don't wait.
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function addForm(page: Page) {
  await page.click('[data-testid="new-routing-form"]');
  await page.fill("input[name]", "Test Form Name");
  await page.click('[data-testid="add-form"]');
  await page.waitForSelector('[data-testid="add-field"]');
  const url = page.url();
  const formId = new URL(url).pathname.split("/").at(-1);
  if (!formId) {
    throw new Error("Form ID couldn't be determined from url");
  }
  return formId;
}

async function verifySelectOptions(
  selector: { selector: string; nth: number },
  expectedOptions: string[],
  page: Page
) {
  await page.locator(selector.selector).nth(selector.nth).click();
  const selectOptions = await page
    .locator(selector.selector)
    .nth(selector.nth)
    .locator('[id*="react-select-"][aria-disabled]')
    .allInnerTexts();

  const sortedSelectOptions = [...selectOptions].sort();
  const sortedExpectedOptions = [...expectedOptions].sort();
  expect(sortedSelectOptions).toEqual(sortedExpectedOptions);
  return {
    optionsInUi: selectOptions,
  };
}

async function fillForm(
  page: Page,
  form: { description: string; field?: { typeIndex: number; label: string } }
) {
  await page.click('[data-testid="add-field"]');
  await page.fill('[data-testid="description"]', form.description);

  // Verify all Options of SelectBox
  const { optionsInUi: types } = await verifySelectOptions(
    { selector: ".data-testid-field-type", nth: 0 },
    ["Email", "Long Text", "MultiSelect", "Number", "Phone", "Select", "Short Text"],
    page
  );

  if (form.field) {
    await page.fill('[name="fields.0.label"]', form.field.label);
    await page.click(".data-testid-field-type");
    await page.locator('[id*="react-select-"][aria-disabled]').nth(form.field.typeIndex).click();
  }
  await page.click('[data-testid="update-form"]');
  await page.waitForSelector(".data-testid-toast-success");
  return {
    types,
  };
}

test.describe("Routing Forms", () => {
  test.afterEach(async ({ users }) => {
    // This also delete forms on cascade
    await users.deleteAll();
  });
  test.describe("Zero State Routing Forms", () => {
    test.beforeEach(async ({ page, users }) => {
      const user = await users.create({ username: "routing-forms" });
      await user.login();
      // Install app
      await page.goto(`/apps/routing-forms`);
      await page.click('[data-testid="install-app-button"]');
      await page.waitForNavigation({
        url: (url) => url.pathname === `/apps/routing-forms/forms`,
      });
    });

    test("should be able to add a new form and view it", async ({ page }) => {
      await page.waitForSelector('[data-testid="empty-screen"]');

      const formId = await addForm(page);

      await page.click('[href="/apps/routing-forms/forms"]');
      // TODO: Workaround for bug in https://github.com/calcom/cal.com/issues/3410
      await page.click('[href="/apps/routing-forms/forms"]');

      await page.waitForSelector('[data-testid="routing-forms-list"]');
      // Ensure that it's visible in forms list
      expect(await page.locator('[data-testid="routing-forms-list"] > li').count()).toBe(1);

      await gotoRoutingLink(page, formId);
      await page.isVisible("text=Test Form Name");

      await page.goto(`apps/routing-forms/route-builder/${formId}`);
      await page.click('[data-testid="toggle-form"] [value="on"]');
      await gotoRoutingLink(page, formId);
      await page.isVisible("text=ERROR 404");
    });

    test("should be able to edit the form", async ({ page }) => {
      await addForm(page);
      const description = "Test Description";

      const field = {
        label: "Test Label",
        typeIndex: 1,
      };

      const { types } = await fillForm(page, {
        description,
        field: field,
      });

      await page.reload();

      expect(await page.inputValue(`[data-testid="description"]`), description);
      expect(await page.locator('[data-testid="field"]').count()).toBe(1);
      expect(await page.inputValue('[name="fields.0.label"]')).toBe(field.label);
      expect(await page.locator(".data-testid-field-type").first().locator("div").nth(1).innerText()).toBe(
        types[field.typeIndex]
      );

      await page.click('[href*="/apps/routing-forms/route-builder/"]');
      await page.click('[data-testid="add-route"]');
      await page.click('[data-testid="add-rule"]');
      await verifySelectOptions(
        {
          selector: ".rule-container .data-testid-field-select",
          nth: 0,
        },
        [field.label],
        page
      );
    });
  });

  test.describe("Seeded Routing Form ", () => {
    const createUserAndLoginAndInstallApp = async function ({
      users,
      page,
    }: {
      users: Fixtures["users"];
      page: Page;
    }) {
      const user = await users.create({ username: "routing-forms" }, { seedRoutingForms: true });
      await user.login();
      // Install app
      await page.goto(`/apps/routing-forms`);
      await page.click('[data-testid="install-app-button"]');
      await page.waitForNavigation({
        url: (url) => url.pathname === `/apps/routing-forms/forms`,
      });
      return user;
    };

    test("Routing Link - Reporting and CSV Download ", async ({ page, users }) => {
      const user = await createUserAndLoginAndInstallApp({ users, page });
      const routingForm = user.routingForms[0];
      test.setTimeout(120000);
      // Fill form when you are logged out
      await users.logout();

      await fillSeededForm(page, routingForm.id);

      // Log back in to view form responses.
      await user.login();

      await page.goto(`/apps/routing-forms/reporting/${routingForm.id}`);
      // Can't keep waiting forever. So, added a timeout of 5000ms
      await page.waitForResponse((response) => response.url().includes("viewer.appRoutingForms.report"), {
        timeout: 5000,
      });
      const headerEls = page.locator("[data-testid='reporting-header'] th");
      // Once the response is there, React would soon render it, so 500ms is enough
      await headerEls.first().waitFor({
        timeout: 500,
      });
      const numHeaderEls = await headerEls.count();
      const headers = [];
      for (let i = 0; i < numHeaderEls; i++) {
        headers.push(await headerEls.nth(i).innerText());
      }

      const responses = [];
      const responseRows = page.locator("[data-testid='reporting-row']");
      const numResponseRows = await responseRows.count();
      for (let i = 0; i < numResponseRows; i++) {
        const rowLocator = responseRows.nth(i).locator("td");
        const numRowEls = await rowLocator.count();
        const rowResponses = [];
        for (let j = 0; j < numRowEls; j++) {
          rowResponses.push(await rowLocator.nth(j).innerText());
        }
        responses.push(rowResponses);
      }

      expect(headers).toEqual(["Test field", "Multi Select"]);
      expect(responses).toEqual([
        ["event-routing", ""],
        ["external-redirect", ""],
        ["custom-page", ""],
      ]);

      const [download] = await Promise.all([
        // Start waiting for the download
        page.waitForEvent("download"),
        // Perform the action that initiates download
        page.click('[data-testid="download-responses"]'),
      ]);
      const downloadStream = await download.createReadStream();
      expect(download.suggestedFilename()).toEqual(`${routingForm.name}-${routingForm.id}.csv`);
      const csv: string = await new Promise((resolve) => {
        let body = "";
        downloadStream?.on("data", (chunk) => {
          body += chunk;
        });
        downloadStream?.on("end", () => {
          resolve(body);
        });
      });
      const csvRows = csv.trim().split("\n");
      const csvHeaderRow = csvRows[0];
      expect(csvHeaderRow).toEqual("Test field,Multi Select,Submission Time");

      const firstResponseCells = csvRows[1].split(",");
      const secondResponseCells = csvRows[2].split(",");
      const thirdResponseCells = csvRows[3].split(",");

      expect(firstResponseCells.slice(0, -1).join(",")).toEqual("event-routing,");
      expect(new Date(firstResponseCells.at(-1)).getDay()).toEqual(new Date().getDay());

      expect(secondResponseCells.slice(0, -1).join(",")).toEqual("external-redirect,");
      expect(new Date(secondResponseCells.at(-1)).getDay()).toEqual(new Date().getDay());

      expect(thirdResponseCells.slice(0, -1).join(",")).toEqual("custom-page,");
      expect(new Date(thirdResponseCells.at(-1)).getDay()).toEqual(new Date().getDay());
    });

    test("Router URL should work", async ({ page, users }) => {
      const user = await createUserAndLoginAndInstallApp({ users, page });
      const routingForm = user.routingForms[0];

      // Router should be publicly accessible
      await users.logout();
      page.goto(`/router?form=${routingForm.id}&Test field=event-routing`);
      await page.waitForNavigation({
        url(url) {
          return url.pathname.endsWith("/pro/30min");
        },
      });

      page.goto(`/router?form=${routingForm.id}&Test field=external-redirect`);
      await page.waitForNavigation({
        url(url) {
          return url.hostname.includes("google.com");
        },
      });

      await page.goto(`/router?form=${routingForm.id}&Test field=custom-page`);
      await page.isVisible("text=Custom Page Result");

      await page.goto(`/router?form=${routingForm.id}&Test field=doesntmatter&multi=Option-2`);
      await page.isVisible("text=Multiselect chosen");
    });

    test("Routing Link should validate fields", async ({ page, users }) => {
      const user = await createUserAndLoginAndInstallApp({ users, page });
      const routingForm = user.routingForms[0];
      await gotoRoutingLink(page, routingForm.id);
      page.click('button[type="submit"]');
      const firstInputMissingValue = await page.evaluate(() => {
        return document.querySelectorAll("input")[0].validity.valueMissing;
      });
      expect(firstInputMissingValue).toBe(true);
      expect(await page.locator('button[type="submit"][disabled]').count()).toBe(0);
    });

    test("Test preview should return correct route", async ({ page, users }) => {
      const user = await createUserAndLoginAndInstallApp({ users, page });
      const routingForm = user.routingForms[0];
      page.goto(`apps/routing-forms/form-edit/${routingForm.id}`);
      await page.click('[data-testid="test-preview"]');

      // //event redirect
      await page.fill('[data-testid="form-field"]', "event-routing");
      await page.click('[data-testid="test-routing"]');
      let routingType = await page.locator('[data-testid="test-routing-result-type"]').innerText();
      let route = await page.locator('[data-testid="test-routing-result"]').innerText();
      await expect(routingType).toBe("Event Redirect");
      await expect(route).toBe("pro/30min");

      //custom page
      await page.fill('[data-testid="form-field"]', "custom-page");
      await page.click('[data-testid="test-routing"]');
      routingType = await page.locator('[data-testid="test-routing-result-type"]').innerText();
      route = await page.locator('[data-testid="test-routing-result"]').innerText();
      await expect(routingType).toBe("Custom Page");
      await expect(route).toBe("Custom Page Result");

      //external redirect
      await page.fill('[data-testid="form-field"]', "external-redirect");
      await page.click('[data-testid="test-routing"]');
      routingType = await page.locator('[data-testid="test-routing-result-type"]').innerText();
      route = await page.locator('[data-testid="test-routing-result"]').innerText();
      await expect(routingType).toBe("External Redirect");
      await expect(route).toBe("https://google.com");

      //fallback route
      await page.fill('[data-testid="form-field"]', "fallback");
      await page.click('[data-testid="test-routing"]');
      routingType = await page.locator('[data-testid="test-routing-result-type"]').innerText();
      route = await page.locator('[data-testid="test-routing-result"]').innerText();
      await expect(routingType).toBe("Custom Page");
      await expect(route).toBe("Fallback Message");
    });
  });
});
async function fillSeededForm(page: Page, routingFormId: string) {
  await gotoRoutingLink(page, routingFormId);
  await page.fill('[data-testid="form-field"]', "event-routing");
  page.click('button[type="submit"]');
  await page.waitForNavigation({
    url(url) {
      return url.pathname.endsWith("/pro/30min");
    },
  });

  await gotoRoutingLink(page, routingFormId);
  await page.fill('[data-testid="form-field"]', "external-redirect");
  page.click('button[type="submit"]');
  await page.waitForNavigation({
    url(url) {
      return url.hostname.includes("google.com");
    },
  });

  await gotoRoutingLink(page, routingFormId);
  await page.fill('[data-testid="form-field"]', "custom-page");
  await page.click('button[type="submit"]');
  await page.isVisible("text=Custom Page Result");
}
