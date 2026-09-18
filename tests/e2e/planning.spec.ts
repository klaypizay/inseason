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
  await page.getByRole("link", { name: "Season", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "From team context to a teaching plan.",
    }),
  ).toBeVisible({ timeout: 20000 });
  // Never let an automated browser test spend live-provider credits accidentally.
  test.skip(
    !(await page.getByText(/Demo mode/).count()),
    "This scenario requires the free fixture provider",
  );
  await page
    .getByRole("button", { name: "Assess team needs", exact: true })
    .click();
  await expect(page).toHaveURL(/drafts\//, { timeout: 20000 });
  await expect(
    page.getByRole("heading", { name: "What you reported" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("First year", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Proposed season goals" }),
  ).toBeVisible();
  const assessmentUrl = page.url();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What you reported" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Season drafts" }).click();
  await page
    .getByRole("button", { name: "Create roadmap draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Why this roadmap?" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("heading", { name: /Week \d+ ·/ })).toHaveCount(
    12,
  );
  await expect(
    page.getByText("Suggested teaching content only.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Week \d+ ·/ })).toHaveCount(
    12,
  );
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
    page.getByRole("heading", { name: "What you reported" }),
  ).toBeVisible();
});
