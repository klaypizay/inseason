import { test, expect } from "@playwright/test";
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
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    /unavailable|Unable to sign in|Too many/,
  );
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
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
    page.getByRole("heading", { name: "Welcome back, coach." }),
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
