import { withSession } from "../../src/server/db/repository";
import { generateSeason } from "../../src/server/ai/generate-season";
import { fixtureSeasonProvider } from "../../src/server/ai/season-provider";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { hostedRoadmapFixture } from "../support/roadmap-fixture";
test.use({ actionTimeout: 20000, navigationTimeout: 30000 });
test("coach organizes multiple roadmaps with folder cards and drag or move controls", async ({
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
    const second = await generateSeason(
      fixture.db,
      fixture.token,
      {
        teamId: fixture.setup.teamId!,
        seasonId: fixture.setup.seasonId!,
        action: "draftRoadmap",
        idempotencyKey: randomUUID(),
      },
      fixtureSeasonProvider,
    );
    for (const [id, name] of [
      [fixture.generationId, "Roadmap A"],
      [second.id, "Roadmap B"],
    ]) {
      await withSession(fixture.db, fixture.token, async (r) => {
        const item = await r.library().item(id);
        await r.library().save(id, {
          name,
          folder: "",
          state: "active",
          revision: item.revision,
        });
      });
    }
    for (const name of ["First folder", "Second folder"])
      await withSession(fixture.db, fixture.token, (r) =>
        r.library().manageFolder({ action: "create", name }),
      );
    await page.goto("/season");
    await expect(
      page.getByRole("heading", { name: "How planning works", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Demo data is not a planning step.", { exact: true }),
    ).toBeVisible();
    const library = page.getByRole("region", {
      name: "Roadmap library",
      exact: true,
    });
    await library.scrollIntoViewIfNeeded();
    await expect(
      library.getByRole("button", {
        name: "Folder: First folder",
        exact: true,
      }),
    ).toBeVisible();
    await library
      .getByRole("checkbox", { name: "Select Roadmap A", exact: true })
      .check();
    await library
      .getByRole("checkbox", { name: "Select Roadmap B", exact: true })
      .check();
    await expect(
      library.getByText("2 selected", { exact: true }),
    ).toBeVisible();
    if (info.project.name === "desktop") {
      await library
        .locator("article")
        .filter({
          has: page.getByRole("heading", { name: "Roadmap A", exact: true }),
        })
        .locator(".drag-handle")
        .dragTo(
          library.getByRole("button", {
            name: "Folder: First folder",
            exact: true,
          }),
          { steps: 20 },
        );
    } else {
      await library
        .getByRole("combobox", { name: "Move to folder", exact: true })
        .selectOption({ label: "First folder" });
      await library
        .getByRole("button", { name: "Move selected", exact: true })
        .click();
    }
    await expect(library.getByRole("status")).toHaveText(
      "Moved 2 items to First folder.",
      { timeout: 30000 },
    );
    await page.reload();
    await library
      .getByRole("button", { name: "Folder: First folder", exact: true })
      .click();
    await expect(library.locator("article")).toHaveCount(2);
    await library
      .getByRole("checkbox", { name: "Select all shown", exact: true })
      .check();
    await library
      .getByRole("combobox", { name: "Move to folder", exact: true })
      .selectOption("");
    await library
      .getByRole("button", { name: "Move selected", exact: true })
      .click();
    await expect(library.getByRole("status")).toHaveText(
      "Moved 2 items to Unfiled.",
      { timeout: 30000 },
    );
    await expect(library.locator("article")).toHaveCount(0, { timeout: 30000 });
    await library
      .getByRole("button", { name: "Folder: Unfiled", exact: true })
      .click();
    await expect(library.locator("article")).toHaveCount(2);
    if (info.project.name === "desktop") {
      await library
        .locator("article")
        .filter({
          has: page.getByRole("heading", { name: "Roadmap A", exact: true }),
        })
        .locator(".drag-handle")
        .dragTo(
          library.getByRole("button", {
            name: "Folder: Second folder",
            exact: true,
          }),
          { steps: 20 },
        );
    } else {
      await library
        .getByRole("checkbox", { name: "Select Roadmap A", exact: true })
        .check();
      await library
        .getByRole("combobox", { name: "Move to folder", exact: true })
        .selectOption({ label: "Second folder" });
      await library
        .getByRole("button", { name: "Move selected", exact: true })
        .click();
    }
    await expect(library.getByRole("status")).toHaveText(
      "Moved 1 item to Second folder.",
      { timeout: 30000 },
    );
    await expect(library.locator("article")).toHaveCount(1, { timeout: 30000 });
    await expect(
      library.getByRole("heading", { name: "Roadmap B", exact: true }),
    ).toBeVisible();
    await library
      .getByRole("checkbox", { name: "Select Roadmap B", exact: true })
      .check();
    await library
      .getByRole("button", { name: "Folder: All items", exact: true })
      .click();
    await expect(
      library.getByText("0 selected", { exact: true }),
    ).toBeVisible();
    await expect(library.locator("article")).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await library.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("library-folders.png") });
  } finally {
    if (fixture) await fixture.cleanup();
    await auth.auth.admin.deleteUser(data.user.id);
  }
});
