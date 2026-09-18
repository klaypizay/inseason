import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { calendarWeeks, type PlanningContext } from "../src/domain/planning";
import { openAISeasonProvider } from "../src/server/ai/openai-season";
import { runGeneration } from "../src/server/ai/season-provider";
// Explicit operator opt-in. At most six calls, each capped at 12k output tokens
// and 48k input bytes plus schema/instructions. Reserve $0.10 per call (<$1 total).
it.skipIf(process.env.RUN_LIVE_AI_TESTS !== "1" || !process.env.OPENAI_API_KEY)(
  "measures live OpenAI synthetic assessment and roadmap",
  async () => {
    const phaseId = randomUUID();
    const context: PlanningContext = {
      seasonId: randomUUID(),
      contextVersion: 1,
      sources: [
        ["experience", "First year"],
        ["ageBand", "13U"],
        ["skill", null],
        ["goals", "Learn team spacing"],
        ["equipment", "One ball per player"],
      ].map(([field, value]) => ({
        id: randomUUID(),
        field: field!,
        value,
        confidence: value ? "Known" : "Unknown",
        reportedAt: "2026-09-18T00:00:00Z",
      })),
      season: {
        start: "2027-01-04",
        end: "2027-03-28",
        timezone: "America/Chicago",
        weekStart: 1,
        playerCount: 9,
        hoops: 1,
        court: "half",
      },
      phases: [
        {
          id: phaseId,
          type: "in_season",
          start: "2027-01-04",
          end: "2027-03-28",
        },
      ],
      weeks: [],
      availability: [1, 3].map((weekday) => ({
        weekday,
        time: "18:00",
        minutes: 90,
        start: null,
        end: null,
      })),
      events: [],
      participation: { available: 0, limited: 0, unavailable: 0, unknown: 9 },
    };
    context.weeks = calendarWeeks(context.phases, 1);
    const provider = openAISeasonProvider(
      process.env.OPENAI_API_KEY!,
      "gpt-5.4-mini-2026-03-17",
    );
    let calls = 0;
    const ledgerPath = ".env.m2-test-budget";
    let reservedCalls = 0;
    try {
      reservedCalls = Number(await readFile(ledgerPath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!Number.isInteger(reservedCalls) || reservedCalls < 0)
      throw Error("Invalid test budget ledger");

    await mkdir(".local-artifacts/live-ai", { recursive: true });
    for (const action of ["assessSeason", "draftRoadmap"] as const) {
      const id = randomUUID();
      const result = await runGeneration(
        provider,
        action,
        context,
        async () => {
          if (++calls > 6 || reservedCalls >= 9)
            throw Error("Synthetic test call budget exhausted");
          await writeFile(ledgerPath, String(++reservedCalls));
        },
      );
      const cost =
        (result.metrics.inputTokens * 0.75 +
          result.metrics.outputTokens * 4.5) /
        1000000;
      await writeFile(
        ".local-artifacts/live-ai/" + id + ".json",
        JSON.stringify(
          {
            id,
            action,
            model: provider.model,
            context,
            result,
            estimatedUSD: cost,
          },
          null,
          2,
        ),
      );
      console.log(
        JSON.stringify({
          action,
          model: provider.model,
          ...result.metrics,
          estimatedUSD: cost,
          errorCode: result.errorCode ?? null,
        }),
      );
      expect(result.errorCode).toBeUndefined();
      expect(result.content).toBeDefined();
    }
  },
  240000,
);
