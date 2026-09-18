import { test, expect } from "@playwright/test";
test.use({ actionTimeout: 15000 });
test.use({ navigationTimeout: 30000 });
const savedTimeout = { timeout: 30000 };
test("setup resumes, preserves Unknowns and rejects invalid duration before completing", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    !process.env.E2E_COACH_A_EMAIL,
    "Requires the synthetic Supabase coach",
  );
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.E2E_COACH_A_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_COACH_A_PASSWORD!);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/today$/);
  await page.getByRole("link", { name: "Team settings" }).click();
  await page
    .getByLabel("Coaching experience", { exact: true })
    .selectOption("First year");
  await page
    .getByLabel("Guidance level", { exact: true })
    .selectOption("Step-by-step explanations");
  await page.getByLabel("Age band", { exact: true }).selectOption("13U");
  await page
    .getByLabel("Approximate skill level", { exact: true })
    .selectOption("");
  await page
    .getByRole("button", { name: "Save progress", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved.", savedTimeout);
  await page.reload();
  await expect(
    page.getByLabel("Coaching experience", { exact: true }),
  ).toHaveValue("First year");
  await expect(
    page.getByLabel("Approximate skill level", { exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "2. Season", exact: true }).click();
  await page.getByLabel("Season start", { exact: true }).fill("2027-01-04");
  await page
    .getByLabel("Season end (inclusive)", { exact: true })
    .fill("2027-03-28");
  if (
    await page
      .getByRole("button", { name: "Approve one in-season phase" })
      .count()
  )
    await page
      .getByRole("button", { name: "Approve one in-season phase" })
      .click();
  await page
    .getByRole("button", { name: "Save & continue", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved.", savedTimeout);
  await page.getByLabel("Approximate player count", { exact: true }).fill("9");
  await page.getByLabel("Hoops available", { exact: true }).fill("1");
  await page.getByLabel("Court access", { exact: true }).selectOption("half");
  while (
    (await page.getByLabel("Duration (minutes)", { exact: true }).count()) < 2
  )
    await page
      .getByRole("button", { name: "Add practice slot", exact: true })
      .click();
  await page.getByLabel("Day", { exact: true }).nth(0).selectOption("1");
  await page.getByLabel("Day", { exact: true }).nth(1).selectOption("3");
  await page.getByLabel("Duration (minutes)", { exact: true }).nth(0).fill("0");
  await page
    .getByRole("button", { name: "Save progress", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "minutes",
  );
  await page
    .getByLabel("Duration (minutes)", { exact: true })
    .nth(0)
    .fill("90");
  await page
    .getByLabel("Duration (minutes)", { exact: true })
    .nth(1)
    .fill("90");
  await page
    .getByRole("button", { name: "Save & continue", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved.", savedTimeout);
  if (!(await page.getByLabel("Event type", { exact: true }).count()))
    await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page
    .getByLabel("Event type", { exact: true })
    .first()
    .selectOption("tournament");
  await page
    .getByLabel("Event start", { exact: true })
    .first()
    .fill("2027-02-13");
  await page
    .getByLabel("Event end", { exact: true })
    .first()
    .fill("2027-02-14");
  await page
    .getByRole("button", { name: "Save & continue", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved.", savedTimeout);
  while ((await page.getByLabel(/alias \(optional\)/).count()) < 9)
    await page.getByRole("button", { name: "Add player", exact: true }).click();
  await page
    .getByRole("button", { name: "Save & continue", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved.", savedTimeout);
  await page
    .getByLabel("What are you unsure about?", { exact: true })
    .fill("How should I teach spacing?");
  await page.getByRole("button", { name: "Finish setup", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Setup complete.",
    savedTimeout,
  );
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Setup complete");
  await page.getByRole("button", { name: "5. Players", exact: true }).click();
  await expect(page.getByLabel(/alias \(optional\)/)).toHaveCount(9);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "1. Coach & team", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("setup.png"),
    fullPage: true,
  });
  const other = await context.newPage();
  await other.goto("/setup");
  await other
    .getByLabel("Season goals", { exact: true })
    .fill("Teach spacing through small-sided games.");
  await other
    .getByRole("button", { name: "Save progress", exact: true })
    .click();
  await expect(other.getByRole("status")).toContainText("Saved.", savedTimeout);
  await page.getByLabel("Season goals", { exact: true }).fill("Stale edit");
  await page
    .getByRole("button", { name: "Save progress", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "another tab",
  );
  await other.close();
  expect(errors).toEqual([]);
});
