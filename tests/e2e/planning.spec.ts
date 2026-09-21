import { test, expect } from "@playwright/test";
test("assessment and roadmap drafts survive refresh without activating a plan", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.E2E_COACH_A_EMAIL,
    "Requires synthetic coach and saved M1 fixture",
  );
  test.setTimeout(120000);
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.E2E_COACH_A_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_COACH_A_PASSWORD!);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/today$/, { timeout: 20000 });
  await page.goto("/season");
  await expect(
    page.getByRole("heading", {
      name: "Your season roadmap.",
    }),
  ).toBeVisible({ timeout: 20000 });
  // Never let an automated browser test spend live-provider credits accidentally.
  test.skip(
    !(await page.getByText(/Example mode/).count()),
    "This scenario requires the free fixture provider",
  );
  await page
    .getByText("Optional: get a team assessment", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Assess team needs", exact: true })
    .click();
  await expect(page).toHaveURL(/drafts\//, { timeout: 20000 });
  await expect(
    page.getByRole("heading", { name: "The team notes we used" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("First year", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Goals to consider for your season" }),
  ).toBeVisible();
  const assessmentUrl = page.url();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "The team notes we used" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← Season roadmap" }).click();
  await page
    .getByRole("button", { name: "Create roadmap draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your season at a glance" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("button", { name: /Review week \d+/ }),
  ).toHaveCount(12);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Review week \d+/ }),
  ).toHaveCount(12);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("roadmap.png"),
    fullPage: true,
  });
  await page.goto(assessmentUrl);
  await expect(
    page.getByRole("heading", { name: "The team notes we used" }),
  ).toBeVisible();
});
