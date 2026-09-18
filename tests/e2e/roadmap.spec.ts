import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { hostedRoadmapFixture } from "../support/roadmap-fixture";
test.use({ actionTimeout: 20000, navigationTimeout: 30000 });
test("coach edits, accepts, locks, shifts and recovers a roadmap without AI calls", async ({
  page,
}, info) => {
  test.skip(
    !process.env.SUPABASE_SECRET_KEY || !process.env.MIGRATION_DATABASE_URL,
    "Requires synthetic development Auth admin and database credentials",
  );
  test.setTimeout(240000);
  const auth = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const email = "season-coach-m3-" + randomUUID() + "@example.com",
    password = randomBytes(24).toString("base64url");
  const { data, error } = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw Error("Unable to create temporary synthetic coach");
  let fixture: Awaited<ReturnType<typeof hostedRoadmapFixture>> | undefined;
  try {
    fixture = await hostedRoadmapFixture(data.user.id);
    const change = async (name: string | RegExp) => {
      const before = page.url();
      await page
        .getByRole("button", { name, exact: typeof name === "string" })
        .click();
      await expect(page).not.toHaveURL(before, { timeout: 30000 });
    };
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/today$/, { timeout: 20000 });
    await page.goto("/drafts/" + fixture.generationId, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "Review & edit roadmap", exact: true })
      .click();
    await expect(page).toHaveURL(/roadmaps\//, { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Review your season roadmap." }),
    ).toBeVisible({ timeout: 30000 });
    await page
      .getByRole("textbox", { name: "Weekly emphasis", exact: true })
      .fill("Find open passing lanes together.");
    await change("Save draft edits");
    await expect(page.getByRole("status")).toHaveText(/Saved version/, {
      timeout: 30000,
    });
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Weekly emphasis", exact: true }),
    ).toHaveValue("Find open passing lanes together.");
    await change("Accept roadmap");
    await expect(
      page.getByRole("heading", {
        name: "Your season, with a clear next step.",
      }),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/24 scheduled sessions/)).toBeVisible({
      timeout: 30000,
    });
    const firstAccepted = page.url();
    await page
      .getByLabel("Lock this week's teaching content", { exact: true })
      .check();
    await change("Accept roadmap");
    await expect(
      page.getByRole("textbox", { name: "Weekly emphasis", exact: true }),
    ).toBeDisabled({ timeout: 30000 });
    await page.reload();
    await expect(
      page.getByLabel("Lock this week's teaching content", { exact: true }),
    ).toBeChecked();
    await page
      .getByLabel("New season start", { exact: true })
      .fill("2027-01-11");
    await page.getByLabel("New season end", { exact: true }).fill("2027-04-04");
    await page
      .getByRole("button", { name: "Prepare date preview", exact: true })
      .click();
    await change("Save calendar preview");
    await expect(page.getByRole("status")).toHaveText(/Saved version/, {
      timeout: 30000,
    });
    await expect(
      page.getByText(/2027-01-11 to 2027-04-04/).first(),
    ).toBeVisible({ timeout: 30000 });
    await change("Accept roadmap");
    await expect(
      page.getByRole("heading", {
        name: "Your season, with a clear next step.",
      }),
    ).toBeVisible({ timeout: 30000 });
    await page.reload();
    await expect(
      page.getByText(/2027-01-11 to 2027-04-04/).first(),
    ).toBeVisible({ timeout: 30000 });
    await page.goto(firstAccepted);
    await change(/Recover version .* as a new draft/);
    await expect(page.getByRole("status")).toHaveText(/Saved version/, {
      timeout: 30000,
    });
    await expect(
      page.getByText(/2027-01-11 to 2027-04-04/).first(),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByLabel("Lock this week's teaching content", { exact: true }),
    ).toBeChecked();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath("roadmap-review.png") });
  } finally {
    if (fixture) await fixture.cleanup();
    await auth.auth.admin.deleteUser(data.user.id);
  }
});
