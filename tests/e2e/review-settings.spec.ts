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
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Welcome back, Coach Review." }),
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
    await page
      .getByRole("combobox", { name: "Folder", exact: true })
      .selectOption("Youth teams");
    await expect(
      page.getByRole("heading", { name: "Spring fundamentals", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Name & organize", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Location", exact: true })
      .selectOption("trash");
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
    await page
      .getByRole("button", { name: "Name & organize", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Location", exact: true })
      .selectOption("active");
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
    await page.screenshot({ path: info.outputPath("organized-library.png") });
  } finally {
    if (fixture) await fixture.cleanup();
    await auth.auth.admin.deleteUser(data.user.id);
  }
});
