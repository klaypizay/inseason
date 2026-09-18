import { expect, it, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { blankSetup, type Setup } from "../src/domain/onboarding";
import {
  calendarWeeks,
  validateGenerated,
  InvalidGeneration,
  type PlanningContext,
  type Roadmap,
} from "../src/domain/planning";
import {
  fixtureSeasonProvider,
  runGeneration,
  ProviderFailure,
  type SeasonProvider,
} from "../src/server/ai/season-provider";
import { generateSeason } from "../src/server/ai/generate-season";
import {
  digest,
  withSession,
  type Database,
  type Query,
} from "../src/server/db/repository";
let pg: PGlite, db: Database;
const actors = [randomUUID(), randomUUID()],
  tokens = ["e".repeat(64), "f".repeat(64)];
let setups: Setup[], context: PlanningContext;
beforeAll(async () => {
  pg = new PGlite();
  for (const file of [
    "001_foundation",
    "003_onboarding",
    "004_generation_drafts",
    "005_draft_season_integrity",
  ])
    await pg.exec(await readFile("migrations/" + file + ".sql", "utf8"));
  db = {
    transaction: (work) =>
      pg.transaction(async (tx) => {
        await tx.exec("set local role season_coach_app");
        const q: Query = async (sql, values) =>
          (await tx.query(sql, values)).rows as never;
        return work(q);
      }),
  };
  setups = [];
  for (let i = 0; i < 2; i++) {
    await pg.query("insert into coach.accounts(id) values($1)", [actors[i]]);
    await pg.query(
      "insert into coach.sessions(token_hash,account_id) values($1,$2)",
      [digest(tokens[i]), actors[i]],
    );
    const data = {
      ...blankSetup(),
      teamName: "Synthetic " + i,
      complete: true,
      start: "2027-01-06",
      end: "2027-03-30",
      playerCount: 9,
      hoops: 1,
      court: "half",
      reports: {
        ...blankSetup().reports,
        experience: "First year",
        ageBand: "13U",
        goals: "Teach spacing",
      },
      phases: [
        { type: "preseason", start: "2027-01-06", end: "2027-01-17" },
        { type: "in_season", start: "2027-01-18", end: "2027-03-30" },
      ],
    };
    setups.push(
      (await withSession(db, tokens[i], (r) => r.onboarding().save(data))).data,
    );
  }
  context = await withSession(db, tokens[0], (r) =>
    r.planning().context(setups[0].teamId!, setups[0].seasonId!),
  );
});
afterAll(async () => pg.close());
const request = (
  i = 0,
  action: "assessSeason" | "draftRoadmap" = "assessSeason",
) => ({
  teamId: setups[i].teamId!,
  seasonId: setups[i].seasonId!,
  action,
  idempotencyKey: randomUUID(),
});
it("covers every inclusive date exactly once, including midweek starts and skipped phases", () => {
  const weeks = calendarWeeks(context.phases, 1);
  expect(weeks[0].start).toBe("2027-01-06");
  expect(weeks[0].end).toBe("2027-01-10");
  expect(weeks.at(-1)?.end).toBe("2027-03-30");
  const dates = weeks.flatMap((w) => {
    const out = [];
    for (let n = Date.parse(w.start); n <= Date.parse(w.end); n += 86400000)
      out.push(n);
    return out;
  });
  expect(dates).toHaveLength(84);
  expect(new Set(dates).size).toBe(84);
  expect(context.phases.map((p) => p.type)).toEqual(["preseason", "in_season"]);
  for (let i = 1; i < dates.length; i++)
    expect(dates[i] - dates[i - 1]).toBe(86400000);
  const sunday = calendarWeeks(context.phases, 0);
  expect(sunday[0].end).toBe("2027-01-09");
});
it("rejects invented evidence, Known model claims, omitted weeks and foreign phases", async () => {
  const raw = (
    await fixtureSeasonProvider.generate(
      "assessSeason",
      context,
      false,
      new AbortController().signal,
    )
  ).value as Record<string, unknown>;
  expect(() =>
    validateGenerated(
      "assessSeason",
      {
        ...raw,
        strengths: [
          {
            text: "A claim",
            topic: "skill",
            confidence: "Likely",
            evidenceIds: [randomUUID()],
          },
        ],
      },
      context,
    ),
  ).toThrow("invalid_evidence");
  expect(() =>
    validateGenerated(
      "assessSeason",
      {
        ...raw,
        strengths: [
          {
            text: "Unsupported skill inference",
            topic: "skill",
            confidence: "Likely",
            evidenceIds: [
              context.sources.find((s) => s.field === "ageBand")!.id,
            ],
          },
        ],
      },
      context,
    ),
  ).toThrow("invalid_evidence");
  expect(() =>
    validateGenerated(
      "assessSeason",
      {
        ...raw,
        strengths: [
          {
            text: "A claim",
            topic: "skill",
            confidence: "Known",
            evidenceIds: [],
          },
        ],
      },
      context,
    ),
  ).toThrow("invalid_output");
  const roadmap = (
    await fixtureSeasonProvider.generate(
      "draftRoadmap",
      context,
      false,
      new AbortController().signal,
    )
  ).value as Roadmap;
  expect(() =>
    validateGenerated(
      "draftRoadmap",
      { ...roadmap, weeks: roadmap.weeks.slice(1) },
      context,
    ),
  ).toThrow("invalid_calendar");
  expect(() =>
    validateGenerated(
      "draftRoadmap",
      {
        ...roadmap,
        phases: roadmap.phases.map((p) => ({ ...p, phaseId: randomUUID() })),
      },
      context,
    ),
  ).toThrow("invalid_calendar");
});
it("bounds transient retry and schema repair to three calls, never retries auth/evidence failures", async () => {
  let calls = 0;
  const attempts: number[] = [];
  const flaky: SeasonProvider = {
    ...fixtureSeasonProvider,
    async generate(...args) {
      calls++;
      if (calls === 1) throw new ProviderFailure("timeout", true);
      if (calls === 2)
        return { value: { wrong: true }, inputTokens: 5, outputTokens: 2 };
      return fixtureSeasonProvider.generate(...args);
    },
  };
  const result = await runGeneration(
    flaky,
    "assessSeason",
    context,
    async (n) => {
      attempts.push(n);
    },
  );
  expect(result.errorCode).toBeUndefined();
  expect(attempts).toEqual([1, 2, 3]);
  expect(result.metrics.inputTokens).toBe(5);
  for (const error of [
    new ProviderFailure("provider_auth"),
    new InvalidGeneration("invalid_evidence"),
  ]) {
    let failures = 0;
    const provider = {
      ...fixtureSeasonProvider,
      async generate() {
        failures++;
        throw error;
      },
    };
    const failed = await runGeneration(
      provider,
      "assessSeason",
      context,
      async () => {},
    );
    expect(failed.errorCode).toBe(error.code);
    expect(failures).toBe(1);
  }
  const timeout = await runGeneration(
    { ...fixtureSeasonProvider, generate: () => new Promise(() => {}) },
    "assessSeason",
    context,
    async () => {},
    20,
  );
  expect(timeout.errorCode).toBe("timeout");
  expect(timeout.metrics.attempts).toBe(2);
});
it("persists private drafts, preserves Known/Unknown reports and deduplicates request replay", async () => {
  const req = request();
  let calls = 0;
  const provider = {
    ...fixtureSeasonProvider,
    async generate(...args: Parameters<SeasonProvider["generate"]>) {
      calls++;
      return fixtureSeasonProvider.generate(...args);
    },
  };
  const first = await generateSeason(db, tokens[0], req, provider);
  const second = await generateSeason(db, tokens[0], req, provider);
  expect(second.id).toBe(first.id);
  expect(calls).toBe(1);
  const draft = await withSession(db, tokens[0], (r) =>
    r.planning().get(first.id),
  );
  expect(draft.status).toBe("succeeded");
  expect(draft.draft?.status).toBe("draft");
  expect(
    draft.draft?.context.sources.find((s) => s.field === "skill")?.confidence,
  ).toBe("Unknown");
  expect(
    draft.draft?.context.sources.find((s) => s.field === "experience")?.value,
  ).toBe("First year");
  await expect(
    withSession(db, tokens[1], (r) => r.planning().get(first.id)),
  ).rejects.toThrow("unavailable");
  await expect(
    withSession(db, tokens[1], (r) => r.planning().attempt(first.id, 1)),
  ).rejects.toThrow("unavailable");
  await expect(
    withSession(db, undefined, (r) => r.planning().get(first.id)),
  ).rejects.toThrow("Sign in");
  await expect(
    withSession(db, tokens[1], (r) =>
      r.planning().begin(req, "fixture", "fixture", 30),
    ),
  ).rejects.toThrow("unavailable");
  await pg.transaction(async (tx) => {
    await tx.exec("set local role season_coach_app");
    await tx.query("select set_config('coach.actor_id',$1,true)", [actors[1]]);
    expect(
      (
        await tx.query("select * from coach.generation_drafts where id=$1", [
          first.id,
        ])
      ).rows,
    ).toHaveLength(0);
  });
});
it("rejects late output after a setting changes and preserves the prior successful draft", async () => {
  const before = await withSession(db, tokens[0], (r) =>
    r.planning().list(setups[0].teamId!, setups[0].seasonId!),
  );
  const provider = {
    ...fixtureSeasonProvider,
    async generate(...args: Parameters<SeasonProvider["generate"]>) {
      setups[0] = (
        await withSession(db, tokens[0], (r) =>
          r.onboarding().save({
            ...setups[0],
            reports: { ...setups[0].reports, goals: "Updated goal" },
          }),
        )
      ).data;
      return fixtureSeasonProvider.generate(...args);
    },
  };
  const late = await generateSeason(db, tokens[0], request(), provider);
  const result = await withSession(db, tokens[0], (r) =>
    r.planning().get(late.id),
  );
  expect(result.status).toBe("failed");
  expect(result.errorCode).toBe("stale_context");
  expect(result.draft).toBeNull();
  expect(
    (await withSession(db, tokens[0], (r) => r.planning().get(before[0].id)))
      .draft,
  ).not.toBeNull();
});
it("discards output after logout without recreating the revoked session", async () => {
  const token = "9".repeat(64);
  await pg.query(
    "insert into coach.sessions(token_hash,account_id) values($1,$2)",
    [digest(token), actors[0]],
  );
  const provider = {
    ...fixtureSeasonProvider,
    async generate(...args: Parameters<SeasonProvider["generate"]>) {
      await pg.query("delete from coach.sessions where token_hash=$1", [
        digest(token),
      ]);
      return fixtureSeasonProvider.generate(...args);
    },
  };
  const result = await generateSeason(db, token, request(), provider);
  expect(
    (
      await pg.query("select * from coach.generation_drafts where id=$1", [
        result.id,
      ])
    ).rows,
  ).toHaveLength(0);
  await expect(
    withSession(db, token, (r) => r.planning().get(result.id)),
  ).rejects.toThrow("Sign in");
});
it("limits concurrent and daily runs, expires interrupted leases, and cascades draft deletion", async () => {
  const req = request(1);
  const a = await withSession(db, tokens[1], (r) =>
    r.planning().begin(req, "fixture", "fixture", 30),
  );
  await withSession(db, tokens[1], (r) =>
    r
      .planning()
      .begin(
        { ...req, idempotencyKey: randomUUID() },
        "fixture",
        "fixture",
        30,
      ),
  );
  await expect(
    withSession(db, tokens[1], (r) =>
      r
        .planning()
        .begin(
          { ...req, idempotencyKey: randomUUID() },
          "fixture",
          "fixture",
          30,
        ),
    ),
  ).rejects.toThrow("Two drafts");
  await pg.query(
    "update coach.generation_runs set lease_expires_at=now()-interval '1 second' where season_id=$1",
    [setups[1].seasonId],
  );
  expect(
    (await withSession(db, tokens[1], (r) => r.planning().get(a.id))).errorCode,
  ).toBe("interrupted");
  await expect(
    withSession(db, tokens[1], (r) =>
      r
        .planning()
        .begin(
          { ...req, idempotencyKey: randomUUID() },
          "fixture",
          "fixture",
          2,
        ),
    ),
  ).rejects.toThrow("Daily");
  const [program] = (
    await pg.query<{ program_id: string }>(
      "select program_id from coach.seasons where id=$1",
      [setups[0].seasonId],
    )
  ).rows;
  await pg.query("update coach.programs set synthetic=true where id=$1", [
    program.program_id,
  ]);
  await withSession(db, tokens[0], (r) =>
    r.onboarding().deleteSynthetic(program.program_id, "Synthetic 0"),
  );
  expect(
    (
      await pg.query(
        "select * from coach.generation_drafts where program_id=$1",
        [program.program_id],
      )
    ).rows,
  ).toHaveLength(0);
});
