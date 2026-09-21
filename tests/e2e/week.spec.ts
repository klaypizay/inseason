import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { hostedRoadmapFixture } from "../support/roadmap-fixture";
import { withSession } from "../../src/server/db/repository";
import { editsFor } from "../../src/domain/roadmap";
test.use({ actionTimeout: 20000, navigationTimeout: 30000 });
test("weekly objectives persist, accept, lock and regenerate on desktop and mobile", async ({
  page,
}, info) => {
  test.skip(
    !process.env.SUPABASE_SECRET_KEY ||
      process.env.COACH_AI_PROVIDER !== "fixture",
    "Requires synthetic hosted setup and fixture-mode server; never paid browser calls",
  );
  test.setTimeout(240000);
  const auth = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const email = "season-coach-m4-" + randomUUID() + "@example.com",
    password = randomBytes(24).toString("base64url");
  const { data, error } = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw Error("Unable to create synthetic coach");
  let f: Awaited<ReturnType<typeof hostedRoadmapFixture>> | undefined;
  try {
    f = await hostedRoadmapFixture(data.user.id);
    const review = await withSession(f.db, f.token, (r) =>
      r.roadmap().get(f!.id),
    );
    const roadmap = await withSession(f.db, f.token, (r) =>
      r
        .roadmap()
        .save(f!.id, editsFor(review.version.plan), randomUUID(), true),
    );
    const week = review.version.plan.weeks[0].id;
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/today$/, { timeout: 20000 });
    await page.goto("/roadmaps/" + roadmap);
    await page
      .getByRole("link", { name: "Prepare this week’s practice", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp("weeks/" + week));
    await page.goto("/weeks/" + week + "?advanced=1");
    const field = page.getByRole("textbox", {
      name: "Teaching objective 1",
      exact: true,
    });
    await field.fill("Find and use open passing lanes.");
    await page
      .getByRole("textbox", {
        name: "What progress would look like 1",
        exact: true,
      })
      .fill("Players explain the open passing option to the coach.");
    const save = async (name: string, enabled = true) => {
      const before = await withSession(f!.db, f!.token, (r) =>
        r.week().get(week),
      );
      await page.getByRole("button", { name, exact: true }).click();
      await expect
        .poll(
          async () =>
            (await withSession(f!.db, f!.token, (r) => r.week().get(week)))
              .reviewId,
          { timeout: 30000 },
        )
        .not.toBe(before.reviewId);
      if (enabled) await expect(field).toBeEnabled();
      else await expect(field).toBeDisabled();
      await page.reload();
    };
    await save("Save weekly draft");
    await expect(field).toHaveValue("Find and use open passing lanes.");
    await save("Use these weekly priorities");
    await expect(page.getByRole("status")).toHaveText(
      "These weekly priorities are saved and in use.",
    );
    await page
      .getByRole("checkbox", {
        name: "Objective 1: Find and use open passing lanes.",
        exact: true,
      })
      .first()
      .uncheck();
    await page.getByLabel("Lock objective 1", { exact: true }).check();
    await save("Use these weekly priorities", false);
    await expect(
      page.getByLabel("Lock objective 1", { exact: true }),
    ).toBeChecked();
    const before = (await withSession(f.db, f.token, (r) => r.week().get(week)))
      .reviewId;
    await page
      .getByRole("button", {
        name: "Regenerate unlocked objectives",
        exact: true,
      })
      .click();
    const loading = page.getByRole("dialog", {
      name: "Preparing your weekly priorities…",
      exact: true,
    });
    await expect(loading).toBeVisible();
    await expect(loading).not.toBeVisible({ timeout: 60000 });
    await expect
      .poll(
        async () =>
          (await withSession(f!.db, f!.token, (r) => r.week().get(week)))
            .reviewId,
        { timeout: 45000 },
      )
      .not.toBe(before);
    await page.reload();
    await expect(field).toHaveValue("Find and use open passing lanes.");
    await expect(field).toBeDisabled();
    await expect(
      page
        .getByRole("checkbox", {
          name: "Objective 1: Find and use open passing lanes.",
          exact: true,
        })
        .first(),
    ).not.toBeChecked();
    await expect(
      page.getByText(
        "Coach-assigned priorities · preserved during regeneration.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Your weekly draft is saved. Review it, then choose Use these weekly priorities.",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "the roadmap this weekly plan follows",
      }),
    ).toHaveAttribute("href", "/roadmaps/" + roadmap);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: info.outputPath("weekly-planner.png"),
      fullPage: true,
    });
    await page.getByLabel("Lock objective 1", { exact: true }).uncheck();
    await save("Save weekly draft");
    await expect(field).toBeEnabled();
    await page
      .getByRole("button", { name: "Add objective", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Teaching objective 2", exact: true })
      .fill("Recover to a balanced defensive position.");
    await page
      .getByRole("textbox", {
        name: "What progress would look like 2",
        exact: true,
      })
      .fill("Coach observes controlled recovery after the pass.");
    await save("Use these weekly priorities");
    await expect(
      page.getByRole("textbox", { name: "Teaching objective 2", exact: true }),
    ).toHaveValue("Recover to a balanced defensive position.");
  } finally {
    if (f) await f.cleanup();
    await auth.auth.admin.deleteUser(data.user.id);
  }
});
