import { withSession } from "../../src/server/db/repository";
import { generateSeason } from "../../src/server/ai/generate-season";
import { fixtureSeasonProvider } from "../../src/server/ai/season-provider";
import { test, expect, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { hostedRoadmapFixture } from "../support/roadmap-fixture";
test.use({ actionTimeout: 20000, navigationTimeout: 30000 });
test("coach organizes multiple roadmaps with folder cards and drag or move controls", async ({
  page,
}, info) => {
  async function dragToFolder(source: Locator, target: Locator) {
    await source.scrollIntoViewIfNeeded();
    const box = (await source.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 15,
      box.y + box.height / 2 + 10,
      { steps: 10 },
    );
    const destination = (await target.boundingBox())!;
    if (destination.y < 80) {
      await page.mouse.move(700, 10, { steps: 20 });
      await expect
        .poll(async () => (await target.boundingBox())!.y)
        .toBeGreaterThan(100);
    }
    const end = (await target.boundingBox())!;
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
      steps: 20,
    });
    await page.mouse.up();
  }
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
    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
      exact: true,
    });
    if (info.project.name === "desktop") {
      await expect(navigation).toBeVisible();
      await expect(
        navigation.getByRole("link", { name: /Start here/ }),
      ).toHaveAttribute("aria-current", "page");
      await navigation.getByRole("link", { name: /Team setup/ }).click();
      await expect(page).toHaveURL(/setup$/);
      await expect(
        navigation.getByRole("link", { name: /Team setup/ }),
      ).toHaveAttribute("aria-current", "page");
      await navigation.getByRole("link", { name: /Season roadmap/ }).click();
      await expect(
        navigation.getByRole("link", { name: /Season roadmap/ }),
      ).toHaveAttribute("aria-current", "page");
    } else {
      await expect(navigation).toBeHidden();
      await page.goto("/season");
    }
    await page.goto("/library");
    const library = page.getByRole("region", {
      name: "Roadmap library",
      exact: true,
    });
    await library.scrollIntoViewIfNeeded();
    const panel = library.getByRole("complementary", {
      name: "Folder navigation",
    });
    await library
      .locator(".folder-grid")
      .evaluate((node) => node.scrollIntoView({ block: "center" }));
    const firstFolder = library.locator(".folder-entry").filter({
      has: page.getByRole("button", {
        name: "Folder: First folder",
        exact: true,
      }),
    });
    if (info.project.name === "desktop") {
      await library
        .getByLabel("Drag folder Second folder", { exact: true })
        .dragTo(firstFolder, { steps: 20, targetPosition: { x: 40, y: 10 } });
    } else {
      await library
        .getByRole("button", { name: "Drag folder Second folder", exact: true })
        .press("ArrowUp");
    }
    await expect(library.getByRole("status")).toHaveText("Folder order saved.");
    await expect(library.locator(".folder-entry strong").first()).toHaveText(
      "Second folder",
    );
    await page.reload();
    await expect(library.locator(".folder-entry strong").first()).toHaveText(
      "Second folder",
    );
    const panelBox = (await panel.boundingBox())!;
    const contentBox = (await library
      .locator(".library-content")
      .boundingBox())!;
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(contentBox.y);

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
      await dragToFolder(
        library
          .locator("article")
          .filter({
            has: page.getByRole("heading", { name: "Roadmap A", exact: true }),
          })
          .locator(".drag-handle"),
        library.getByRole("button", {
          name: "Folder: First folder",
          exact: true,
        }),
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
      await dragToFolder(
        library
          .locator("article")
          .filter({
            has: page.getByRole("heading", { name: "Roadmap A", exact: true }),
          })
          .locator(".drag-handle"),
        library.getByRole("button", {
          name: "Folder: Second folder",
          exact: true,
        }),
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
    await library
      .getByRole("combobox", { name: "View", exact: true })
      .selectOption("list");
    await library
      .getByRole("button", { name: "Drag Roadmap A", exact: true })
      .press("ArrowUp");
    await expect(library.getByRole("status")).toHaveText(
      "Library order saved.",
    );
    await expect(library.locator("article h2").first()).toHaveText("Roadmap A");
    await page.reload();
    await expect(library.locator("article h2").first()).toHaveText("Roadmap A");
    await library
      .getByRole("combobox", { name: "View", exact: true })
      .selectOption("table");
    await expect(library.getByRole("table")).toBeVisible();
    await expect(library.getByRole("columnheader")).toHaveCount(7);
    await page.screenshot({ path: info.outputPath("library-table.png") });
    await library
      .locator("article")
      .first()
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Name & folder" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await library
      .getByRole("combobox", { name: "View", exact: true })
      .selectOption("cards");
    if (info.project.name === "desktop") {
      const source = library
        .locator("article")
        .filter({
          has: page.getByRole("heading", { name: "Roadmap A", exact: true }),
        })
        .locator(".drag-handle");
      await source.scrollIntoViewIfNeeded();
      const box = (await source.boundingBox())!;
      const before = await page.evaluate(() => scrollY);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 15,
        box.y + box.height / 2 + 10,
        { steps: 10 },
      );
      await page.mouse.move(30, 25, { steps: 20 });
      await expect
        .poll(() => page.evaluate(() => scrollY))
        .toBeLessThan(before - 50);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await library
        .getByRole("button", { name: "Clear selection", exact: true })
        .click();
      const target = library.locator("article").filter({
        has: page.getByRole("heading", { name: "Roadmap B", exact: true }),
      });
      await source.scrollIntoViewIfNeeded();
      const startBox = (await source.boundingBox())!;
      await page.mouse.move(
        startBox.x + startBox.width / 2,
        startBox.y + startBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        startBox.x + startBox.width / 2 + 15,
        startBox.y + startBox.height / 2 + 10,
        { steps: 10 },
      );
      await page.mouse.move(900, page.viewportSize()!.height - 10, {
        steps: 20,
      });
      await expect
        .poll(async () => {
          const box = (await target.boundingBox())!;
          return box.y + box.height;
        })
        .toBeLessThan(page.viewportSize()!.height - 20);
      const dropBox = (await target.boundingBox())!;
      await page.mouse.move(dropBox.x + 40, dropBox.y + dropBox.height - 30, {
        steps: 10,
      });
      await page.mouse.up();
      await expect(library.getByRole("status")).toHaveText(
        "Library order saved.",
      );
      await expect(library.locator("article h2").first()).toHaveText(
        "Roadmap B",
      );
    }
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
