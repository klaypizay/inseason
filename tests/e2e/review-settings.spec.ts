import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { hostedRoadmapFixture } from "../support/roadmap-fixture";
test.use({ actionTimeout: 20000, navigationTimeout: 30000 });
test("coach saves date settings, names and folders, then trashes and restores a draft", async ({
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
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/today$/, { timeout: 20000 });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Coach display name", exact: true })
      .fill("Coach Review");
    await page
      .getByRole("combobox", { name: "Date format", exact: true })
      .selectOption("DD/MM/YYYY");
    await page
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await expect(
      page.getByText("Settings saved.", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const settings = page.getByRole("dialog", {
      name: "Your settings",
      exact: true,
    });
    await expect(
      settings.getByRole("button", {
        name: "3. Practice schedule",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(await settings.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await settings.evaluate((e) => e.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath("coach-settings.png") });
    await settings
      .getByRole("combobox", { name: "Coaching experience", exact: true })
      .selectOption("First year");
    await settings
      .getByRole("textbox", { name: "Teaching philosophy", exact: true })
      .fill("Let every player explore.");
    await settings.getByRole("tab", { name: "Team", exact: true }).click();
    expect(await settings.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await settings.evaluate((e) => e.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath("team-settings.png") });
    await expect(
      settings.getByRole("combobox", {
        name: "Coaching experience",
        exact: true,
      }),
    ).toHaveCount(0);
    await settings
      .getByRole("textbox", { name: "Team name", exact: true })
      .fill("Settings team");
    await settings
      .getByRole("button", { name: "3. Practice schedule", exact: true })
      .click();
    await expect(
      settings.getByRole("button", { name: "Add event", exact: true }),
    ).toHaveCount(0);
    await settings
      .getByRole("button", { name: "4. Events schedule", exact: true })
      .click();
    await expect(
      settings.getByRole("button", { name: "Add practice slot", exact: true }),
    ).toHaveCount(0);
    await settings
      .getByRole("tab", { name: "Profile (Coach)", exact: true })
      .click();
    await expect(
      settings.getByRole("textbox", {
        name: "Teaching philosophy",
        exact: true,
      }),
    ).toHaveValue("Let every player explore.");
    await settings
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await settings
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await settings
      .getByRole("button", { name: "Save coaching profile", exact: true })
      .click();
    await expect(
      settings.getByText(
        "Saved. Your coach and team settings are up to date.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 30000 });
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Welcome back, Coach Review." }),
    ).toBeVisible();
    await page.goto("/setup");
    await expect(
      page.getByRole("textbox", { name: "Team name", exact: true }),
    ).toHaveValue("Settings team");
    await expect(
      page.getByRole("textbox", { name: "Teaching philosophy", exact: true }),
    ).toHaveValue("Let every player explore.");
    await page
      .getByRole("button", { name: "3. Practice schedule", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Add event", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "4. Events schedule", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Add event", exact: true }),
    ).toBeVisible();
    await page.goto("/roadmaps/" + fixture.id);
    await expect(
      page.getByText(/04\/01\/2027 to 28\/03\/2027/).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Name & organize", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Spring fundamentals");
    await page
      .getByRole("combobox", { name: "Folder (optional)", exact: true })
      .fill("Youth teams");
    await page
      .getByRole("button", { name: "Save details", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Spring fundamentals", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await page.goto("/season");
    await page.getByRole("button", { name: "New folder", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Folder name", exact: true })
      .fill("Empty folder");
    await page
      .getByRole("button", { name: "Create folder", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "New folder", exact: true }),
    ).not.toBeVisible({ timeout: 30000 });
    await page.reload();
    await page
      .getByRole("combobox", { name: "Folder", exact: true })
      .selectOption("Empty folder");
    await expect(
      page.getByText("No items here yet.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Manage folders", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Choose folder", exact: true })
      .selectOption({ label: "Youth teams" });
    await page
      .getByRole("textbox", { name: "Folder name", exact: true })
      .fill("Youth program");
    await page
      .getByRole("button", { name: "Rename folder", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Manage folders", exact: true }),
    ).not.toBeVisible({ timeout: 30000 });

    await page
      .getByRole("combobox", { name: "Folder", exact: true })
      .selectOption("Youth program");
    await expect(
      page.getByRole("heading", { name: "Spring fundamentals", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("button", { name: "Move to Trash", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Spring fundamentals", exact: true }),
    ).toHaveCount(0, { timeout: 30000 });
    await page
      .getByRole("combobox", { name: "Show", exact: true })
      .selectOption("trash");
    await expect(
      page.getByRole("heading", { name: "Spring fundamentals", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    await page
      .getByRole("button", { name: "Save details", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Spring fundamentals", exact: true }),
    ).toHaveCount(0, { timeout: 30000 });
    await page
      .getByRole("combobox", { name: "Show", exact: true })
      .selectOption("active");
    await expect(
      page.getByRole("heading", { name: "Spring fundamentals", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Manage folders", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Choose folder", exact: true })
      .selectOption({ label: "Youth program" });
    await page
      .getByRole("button", { name: "Remove folder", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm remove folder", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Manage folders", exact: true }),
    ).not.toBeVisible({ timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Spring fundamentals", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Unfiled/)).toBeVisible();
    await page.screenshot({ path: info.outputPath("organized-library.png") });
  } finally {
    if (fixture) await fixture.cleanup();
    await auth.auth.admin.deleteUser(data.user.id);
  }
});
