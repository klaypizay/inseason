import { test, expect } from "@playwright/test";
test("two managed coaches see only their own seeded team", async ({ page }) => {
  test.skip(
    !process.env.E2E_COACH_A_EMAIL || !process.env.E2E_COACH_B_EMAIL,
    "Requires two provisioned synthetic coaches",
  );
  for (const [suffix, own, other] of [
    ["A", "Demo Cedar", "Demo Willow"],
    ["B", "Demo Willow", "Demo Cedar"],
  ]) {
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill(process.env[`E2E_COACH_${suffix}_EMAIL`]!);
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env[`E2E_COACH_${suffix}_PASSWORD`]!);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(own, { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(other, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
});
test("unauthenticated coaches reach an accessible, responsive sign-in page", async ({
  page,
}) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Get back to your team." }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
});
test("sign-in failure is actionable and does not show a successful workspace", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("unprovisioned@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("invalid-synthetic-password");
  const emailForm = page.getByRole("form", { name: "Email sign in" });
  await emailForm.getByRole("checkbox").check();
  await emailForm.getByRole("button", { name: "Sign in" }).click();
  await expect(emailForm.getByRole("alert")).toContainText(
    /unavailable|Unable to sign in|Too many/,
  );
  await expect(
    emailForm.getByRole("button", { name: "Sign in" }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/\/login$/);
});
test("managed login, refresh and revoked cookie replay", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.E2E_COACH_EMAIL || !process.env.E2E_COACH_PASSWORD,
    "Requires a provisioned synthetic Supabase coach and configured database",
  );
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.E2E_COACH_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_COACH_PASSWORD!);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  const saved = await context.cookies();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await context.addCookies(saved);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login$/);
});
