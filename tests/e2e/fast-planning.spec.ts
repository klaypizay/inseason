import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { hostedRoadmapFixture } from "../support/roadmap-fixture";
import { withSession } from "../../src/server/db/repository";
test.use({ actionTimeout: 20000, navigationTimeout: 30000 });
test("coach goes from roadmap review to a saved, editable practice", async ({
  page,
}, info) => {
  test.skip(
    !process.env.SUPABASE_SECRET_KEY ||
      process.env.COACH_AI_PROVIDER !== "fixture",
    "Requires synthetic auth/database and explicit free fixture provider",
  );
  test.setTimeout(240000);
  const auth = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const email = "fast-planning-" + randomUUID() + "@example.com",
    password = randomBytes(24).toString("base64url");
  const { data, error } = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw Error("Unable to create synthetic coach");
  let f: Awaited<ReturnType<typeof hostedRoadmapFixture>> | undefined;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    f = await hostedRoadmapFixture(data.user.id);
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/today$/, { timeout: 30000 });
    // Finish the fixture's existing review before requesting a fresh roadmap.
    await page.goto("/roadmaps/" + f.id);
    await page
      .getByRole("button", { name: "Use this roadmap", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Your season, with a clear next step.",
      }),
    ).toBeVisible({ timeout: 30000 });
    await page.goto("/season");
    await expect(page.getByText(/Example mode:/)).toBeVisible();
    await page
      .getByText("Optional: get a team assessment", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "Assess team needs", exact: true })
      .click();
    const assessmentLoader = page.getByRole("dialog", {
      name: "Preparing your team assessment…",
      exact: true,
    });
    await expect(assessmentLoader).toBeVisible();
    await expect(page).toHaveURL(/drafts\//, { timeout: 30000 });
    await expect(
      page.getByRole("heading", {
        name: "The team notes we used",
        exact: true,
      }),
    ).toBeVisible({ timeout: 60000 });
    await expect(assessmentLoader).not.toBeVisible();
    await page.goto("/season");
    await page
      .getByRole("button", { name: "Create roadmap draft", exact: true })
      .click();
    const roadmapLoader = page.getByRole("dialog", {
      name: "Building your season roadmap…",
      exact: true,
    });
    await expect(roadmapLoader).toBeVisible();
    await expect(roadmapLoader).not.toBeVisible({ timeout: 60000 });
    await expect(page).toHaveURL(/roadmaps\//, { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Your season at a glance" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Why these priorities and this order?", { exact: true }),
    ).toBeHidden();
    await page
      .getByRole("button", { name: "Use this roadmap", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Your season, with a clear next step.",
      }),
    ).toBeVisible({ timeout: 30000 });
    await page
      .getByRole("link", { name: "Plan practice →", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your next practice, made simple." }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByRole("textbox", { name: "Teaching objective 1", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Practice", exact: true })
      .selectOption({ index: 1 });
    await expect(page).toHaveURL(/session=/);
    const selectedSession = await page
      .getByRole("combobox", { name: "Practice", exact: true })
      .inputValue();
    await page
      .getByLabel("Anything different today? (optional)", { exact: true })
      .fill("Keep the instructions simple.");
    if (info.project.name === "mobile")
      await page.emulateMedia({ reducedMotion: "reduce" });
    const practiceLoader = page.getByRole("dialog", {
      name: "Preparing your practice…",
      exact: true,
    });
    await page
      .getByRole("button", { name: "Build this practice", exact: true })
      .click();
    await expect(practiceLoader).toBeVisible();
    await expect(practiceLoader).toBeFocused();
    await expect(practiceLoader.locator(".ai-generation-orbit")).toHaveCSS(
      "animation-name",
      info.project.name === "mobile" ? "none" : "ai-logo-orbit",
    );
    await page.screenshot({ path: info.outputPath("ai-loading.png") });
    await expect(practiceLoader).not.toBeVisible({ timeout: 75000 });
    await expect(
      page.getByRole("heading", {
        name: "Example practice — weekly focus",
        exact: true,
      }),
    ).toBeVisible({ timeout: 75000 });
    await page
      .getByRole("button", { name: "Quick edit", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Quick edit drill" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("tab", { name: "Edit manually", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      dialog.getByRole("checkbox", { name: "Lock this drill", exact: true }),
    ).toHaveCount(0);
    await dialog
      .getByLabel("Coaching cues", { exact: true })
      .fill("Pause, demonstrate, then let players try.");
    const drillName = await dialog
      .getByLabel("Drill name", { exact: true })
      .inputValue();
    await dialog
      .getByRole("tab", { name: "Edit manually", exact: true })
      .press("ArrowRight");
    await expect(
      dialog.getByRole("tab", { name: "Ask AI", exact: true }),
    ).toBeFocused();
    await expect(
      dialog.getByRole("tab", { name: "Ask AI", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await dialog
      .getByLabel("What would you like to change about this drill?", {
        exact: true,
      })
      .fill("Give beginners one simple decision to practice.");
    await dialog
      .getByRole("tab", { name: "Edit manually", exact: true })
      .click();
    await expect(
      dialog.getByLabel("Coaching cues", { exact: true }),
    ).toHaveValue("Pause, demonstrate, then let players try.");
    await dialog.getByRole("tab", { name: "Ask AI", exact: true }).click();
    await expect(
      dialog.getByLabel("What would you like to change about this drill?", {
        exact: true,
      }),
    ).toHaveValue("Give beginners one simple decision to practice.");
    await page.screenshot({ path: info.outputPath("ask-ai.png") });
    // A real validation failure must release the loading overlay and preserve edits.
    await dialog
      .getByRole("tab", { name: "Edit manually", exact: true })
      .click();
    await dialog.getByLabel("Drill name", { exact: true }).fill("");
    await dialog.getByRole("tab", { name: "Ask AI", exact: true }).click();
    await dialog
      .getByRole("button", { name: "Save edits & revise drill", exact: true })
      .click();
    await expect(practiceLoader).toBeVisible();
    await expect(practiceLoader).not.toBeVisible({ timeout: 30000 });
    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog
      .getByRole("tab", { name: "Edit manually", exact: true })
      .click();
    await expect(
      dialog.getByLabel("Coaching cues", { exact: true }),
    ).toHaveValue("Pause, demonstrate, then let players try.");
    await dialog.getByLabel("Drill name", { exact: true }).fill(drillName);
    await dialog.getByRole("tab", { name: "Ask AI", exact: true }).click();
    await dialog
      .getByRole("button", { name: "Save edits & revise drill", exact: true })
      .click();
    await expect(practiceLoader).toBeVisible();
    await expect(practiceLoader).toBeFocused();
    await expect(practiceLoader).not.toBeVisible({ timeout: 75000 });
    await expect(dialog).not.toBeVisible({ timeout: 30000 });
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    await expect(
      page.getByText(
        "Example revision: demonstrate one simple choice, then let players practice it together.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 75000 });
    await page
      .getByRole("button", { name: "Quick edit", exact: true })
      .first()
      .click();
    await dialog
      .getByLabel("Coaching cues", { exact: true })
      .fill("Pause, demonstrate, then let players try.");
    await dialog
      .getByRole("button", { name: "Keep edits", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "Lock this drill", exact: true })
      .first()
      .check();
    await expect(
      page
        .getByText("A regenerated practice plan will not affect this drill.", {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Use this practice", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ready to coach.", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByRole("button", { name: "Print / Save PDF", exact: true }),
    ).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(
      page.locator(".practice-block details p").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeHidden();
    if (info.project.name === "desktop")
      await page.pdf({
        path: info.outputPath("practice-print.pdf"),
        format: "A4",
      });
    await page.emulateMedia({ media: "screen" });
    await page.reload();
    await expect(
      page
        .getByRole("checkbox", { name: "Lock this drill", exact: true })
        .first(),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Quick edit", exact: true })
      .first()
      .click();
    await expect(
      dialog.getByLabel("Drill name", { exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("tab", { name: "Ask AI", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "Revise this drill", exact: true }),
    ).toBeDisabled();
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Practice", exact: true }),
    ).toHaveValue(selectedSession);
    await expect(
      page.getByText("Pause, demonstrate, then let players try.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByText("Describe a change to your practice", { exact: true })
      .click();
    await page
      .getByLabel("What would you like to change?", { exact: true })
      .fill("Keep the locked teaching block.");
    await page
      .getByRole("button", { name: "Revise plan", exact: true })
      .click();
    await expect(practiceLoader).toBeVisible();
    await expect(practiceLoader).not.toBeVisible({ timeout: 75000 });
    await expect(
      page.getByRole("button", { name: "Use this practice", exact: true }),
    ).toBeEnabled({ timeout: 75000 });
    await expect(
      page.getByText("Pause, demonstrate, then let players try.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Use this practice", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ready to coach.", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const saved = await withSession(f.db, f.token, (r) =>
      r.week().savedPractices(f!.setup.seasonId!),
    );
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe("accepted");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("ready-practice.png"),
      fullPage: true,
    });
    await page.goto("/library");
    await expect(
      page.getByRole("heading", { name: "Practice plans", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", {
        name: "Example practice — weekly focus",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/session=/);
    await expect(
      page.getByRole("heading", { name: "Ready to coach.", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    if (f) await f.cleanup();
    await auth.auth.admin.deleteUser(data.user.id);
  }
});
