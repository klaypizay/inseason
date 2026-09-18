import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { manualWeek, type WeekContext } from "../src/domain/week";
import { openAIWeekProvider, runWeek } from "../src/server/ai/week-provider";
it.skipIf(
  process.env.RUN_LIVE_WEEK_TEST !== "1" || !process.env.OPENAI_API_KEY,
)(
  "validates one live synthetic tournament week within the existing test budget",
  async () => {
    const weekId = randomUUID(),
      phaseId = randomUUID(),
      goalId = randomUUID();
    const context: WeekContext = {
      roadmapId: randomUUID(),
      contextVersion: 1,
      timezone: "America/Chicago",
      today: "2027-01-04",
      week: {
        id: weekId,
        phaseId,
        start: "2027-01-04",
        end: "2027-01-10",
        emphasis: "Find open passing lanes and recover to defend.",
        checkpoint:
          "Coach observes players explaining a useful passing option.",
        locked: false,
        contentVersion: 1,
      },
      goals: [
        {
          id: goalId,
          phaseId,
          description: "Develop shared spacing habits.",
          successCriteria:
            "Coach observes players recognizing open passing lanes.",
          locked: false,
          contentVersion: 1,
        },
      ],
      sessions: [
        {
          id: randomUUID(),
          weekId,
          date: "2027-01-06",
          time: "18:00",
          minutes: 45,
          status: "scheduled",
          override: "",
          contentVersion: 1,
        },
      ],
      events: [
        {
          id: randomUUID(),
          type: "tournament",
          start: "2027-01-08",
          end: "2027-01-10",
          time: "",
          endTime: "",
          blocksPractice: true,
        },
      ],
      coach: {
        season: {
          start: "2027-01-04",
          end: "2027-03-28",
          timezone: "America/Chicago",
          weekStart: 1,
          playerCount: 9,
          hoops: 1,
          court: "half",
        },
        participation: { available: 0, limited: 0, unavailable: 0, unknown: 9 },
        sources: [
          {
            id: randomUUID(),
            field: "ageBand",
            value: "13U",
            confidence: "Known",
            reportedAt: "2026-09-18T00:00:00Z",
          },
          {
            id: randomUUID(),
            field: "experience",
            value: "First year coach",
            confidence: "Known",
            reportedAt: "2026-09-18T00:00:00Z",
          },
        ],
      },
    };
    const ledger = ".env.m2-test-budget";
    const reserved = Number(await readFile(ledger, "utf8"));
    if (!Number.isInteger(reserved) || reserved < 0 || reserved >= 9)
      throw Error("Existing synthetic test budget exhausted");
    let calls = 0;
    const result = await runWeek(
      openAIWeekProvider(process.env.OPENAI_API_KEY!),
      { context, previous: manualWeek(context, randomUUID) },
      async () => {
        if (++calls > 1)
          throw Error("No further paid calls authorized by this test");
        await writeFile(ledger, String(reserved + 1));
      },
    );
    await mkdir(".local-artifacts/live-ai", { recursive: true });
    await writeFile(
      ".local-artifacts/live-ai/m4-synthetic-week.json",
      JSON.stringify({ context, result }, null, 2),
    );
    console.log(
      JSON.stringify({
        action: "draftWeek",
        ...result.metrics,
        error: result.errorCode ?? null,
      }),
    );
    expect(result.errorCode).toBeUndefined();
    expect(result.content!.objectives.length).toBeGreaterThanOrEqual(1);
    expect(result.content!.objectives.length).toBeLessThanOrEqual(3);
    expect(result.content!.allocations).toHaveLength(1);
  },
  90000,
);
