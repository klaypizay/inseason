import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it } from "vitest";
import { blankSetup, setupSchema, type Setup } from "../src/domain/onboarding";
import {
  digest,
  withSession,
  type Database,
  type Query,
} from "../src/server/db/repository";

let pg: PGlite, db: Database;
const actors = [randomUUID(), randomUUID()];
const tokens = ["c".repeat(64), "d".repeat(64)];
let a: Setup, b: Setup;
const fixture = (): Setup => ({
  ...blankSetup(),
  teamName: "Synthetic 13U",
  title: "Twelve weeks",
  complete: true,
  start: "2027-01-04",
  end: "2027-03-28",
  playerCount: 9,
  hoops: 1,
  court: "half",
  reports: {
    ...blankSetup().reports,
    experience: "First year",
    ageBand: "13U",
  },
  phases: [{ type: "in_season", start: "2027-01-04", end: "2027-03-28" }],
  availability: [1, 3].map((weekday) => ({
    weekday,
    time: "18:00",
    minutes: 90,
    start: null,
    end: null,
  })),
  events: [
    {
      type: "tournament",
      title: "",
      start: "2027-02-13",
      end: "2027-02-14",
      time: "",
      endTime: "",
      blocksPractice: true,
    },
  ],
  players: Array.from({ length: 9 }, () => ({
    alias: "",
    participation: "unknown" as const,
    note: "",
  })),
});
beforeAll(async () => {
  pg = new PGlite();
  for (const f of [
    "001_foundation",
    "003_onboarding",
    "004_generation_drafts",
    "005_draft_season_integrity",
  ])
    await pg.exec(await readFile("migrations/" + f + ".sql", "utf8"));
  for (let i = 0; i < 2; i++) {
    await pg.query("insert into coach.accounts(id) values($1)", [actors[i]]);
    await pg.query(
      "insert into coach.sessions(token_hash,account_id) values($1,$2)",
      [digest(tokens[i]), actors[i]],
    );
  }
  db = {
    transaction: (work) =>
      pg.transaction(async (tx) => {
        await tx.exec("set local role season_coach_app");
        const q: Query = async (sql, values) =>
          (await tx.query(sql, values)).rows as never;
        return work(q);
      }),
  };
});
afterAll(async () => pg.close());
const save = (token: string, value: unknown) =>
  withSession(db, token, (r) => r.onboarding().save(value));
it("saves incomplete setup, resumes, completes the 13U fixture, and attributes Unknowns", async () => {
  const draft = await save(tokens[0], {
    ...blankSetup(),
    teamName: "Synthetic draft",
  });
  expect(draft.data.start).toBeNull();
  expect(
    (await withSession(db, tokens[0], (r) => r.onboarding().load())).data,
  ).toEqual(draft.data);
  a = (
    await save(tokens[0], {
      ...fixture(),
      teamId: draft.data.teamId,
      seasonId: draft.data.seasonId,
      version: draft.data.version,
    })
  ).data;
  b = (await save(tokens[1], fixture())).data;
  expect(a.players).toHaveLength(9);
  expect(a.players.every((p) => p.alias.startsWith("Player "))).toBe(true);
  expect(a.availability.map((s) => s.minutes)).toEqual([90, 90]);
  const view = await withSession(db, tokens[0], (r) => r.onboarding().load());
  expect(view.sources.find((s) => s.field === "skill")?.confidence).toBe(
    "Unknown",
  );
  expect(view.sources.find((s) => s.field === "experience")?.confidence).toBe(
    "Known",
  );
  expect(view.data).toEqual(a);
});
it("rejects invalid calendar/duration/phase/unknown fields on the server with no writes", async () => {
  for (const invalid of [
    { ...a, end: "2026-01-01" },
    { ...a, start: "2027-02-30" },
    { ...a, availability: [{ ...a.availability[0], minutes: 0 }] },
    { ...a, availability: [{ ...a.availability[0], minutes: -90 }] },
    { ...a, availability: [{ ...a.availability[0], minutes: 1.5 }] },
    { ...a, timezone: "not/a-zone" },
    { ...a, phases: [] },
    { ...a, phases: [a.phases[0], a.phases[0]] },
    { ...a, events: [{ ...a.events[0], end: "2028-01-01" }] },
    { ...a, owner_id: actors[1] },
  ])
    await expect(save(tokens[0], invalid)).rejects.toThrow();
  expect(
    (await withSession(db, tokens[0], (r) => r.onboarding().load())).data,
  ).toEqual(a);
  expect(
    setupSchema.parse({ ...fixture(), players: [], availability: [] }),
  ).toBeTruthy();
});
it("rejects direct and nested foreign IDs and anonymous reads for every new resource", async () => {
  await expect(
    withSession(db, undefined, (r) => r.onboarding().load()),
  ).rejects.toThrow("Sign in");
  for (const [token, own, foreign] of [
    [tokens[0], a, b],
    [tokens[1], b, a],
  ] as const) {
    await expect(
      withSession(db, token, (r) =>
        r.onboarding().get(foreign.teamId!, foreign.seasonId!),
      ),
    ).rejects.toThrow("unavailable");
    await expect(save(token, foreign)).rejects.toThrow("unavailable");
    for (const key of ["phases", "availability", "events", "players"] as const)
      await expect(
        save(token, { ...own, [key]: foreign[key] }),
      ).rejects.toThrow("unavailable");
  }
  await pg.transaction(async (tx) => {
    await tx.exec("set local role season_coach_app");
    await tx.query("select set_config('coach.actor_id',$1,true)", [actors[0]]);
    for (const table of [
      "profile_reports",
      "phases",
      "availability_rules",
      "calendar_events",
    ]) {
      expect(
        (
          await tx.query(
            "select * from coach." + table + " where season_id=$1",
            [b.seasonId],
          )
        ).rows,
      ).toHaveLength(0);
    }
    await expect(
      tx.query(
        "insert into coach.phases(program_id,season_id,type,start_date,end_date,created_by) select program_id,$1,'in_season','2027-01-04','2027-03-28',$2 from coach.seasons where id=$3",
        [b.seasonId, actors[0], a.seasonId],
      ),
    ).rejects.toThrow();
  });
});
it("preserves IDs and source revisions, and rejects stale tabs without overwriting", async () => {
  const old = a;
  a = (
    await save(tokens[0], {
      ...a,
      reports: { ...a.reports, goals: "Teach spacing" },
      players: a.players.map((p, i) =>
        i === 0 ? { ...p, alias: "Cedar" } : p,
      ),
    })
  ).data;
  expect(a.players.map((p) => p.id).sort()).toEqual(
    old.players.map((p) => p.id).sort(),
  );
  expect(a.phases[0].id).toEqual(old.phases[0].id);
  await expect(save(tokens[0], old)).rejects.toThrow("another tab");
  expect(
    (await withSession(db, tokens[0], (r) => r.onboarding().load())).data
      .reports.goals,
  ).toBe("Teach spacing");
  const history = await pg.query(
    "select * from coach.profile_reports where season_id=$1 and field='goals' order by revision",
    [a.seasonId],
  );
  expect(history.rows.length).toBeGreaterThan(1);
});
it("requires owner, synthetic marker, fresh auth and exact confirmation; cascades all live tenant data", async () => {
  const rows = await pg.query<{ program_id: string }>(
    "select program_id from coach.seasons where id=$1",
    [a.seasonId],
  );
  const program = rows.rows[0].program_id;
  const remove = (token: string, name = "Synthetic draft") =>
    withSession(db, token, (r) =>
      r.onboarding().deleteSynthetic(program, name),
    );
  await expect(remove(tokens[0])).rejects.toThrow("unavailable");
  await pg.query("update coach.programs set synthetic=true where id=$1", [
    program,
  ]);
  await expect(remove(tokens[1])).rejects.toThrow("unavailable");
  await expect(remove(tokens[0], "wrong")).rejects.toThrow("unavailable");
  await pg.query(
    "update coach.sessions set created_at=now()-interval '11 minutes' where token_hash=$1",
    [digest(tokens[0])],
  );
  await expect(remove(tokens[0])).rejects.toThrow("Sign in again");
  await pg.query(
    "update coach.sessions set created_at=now() where token_hash=$1",
    [digest(tokens[0])],
  );
  await pg.query(
    "insert into coach.generation_runs(program_id,season_id,action,idempotency_key,context_version,created_by) values($1,$2,'assessSeason',$3,1,$4)",
    [program, a.seasonId, randomUUID(), actors[0]],
  );
  await remove(tokens[0]);
  for (const table of [
    "teams",
    "seasons",
    "players",
    "season_roster",
    "generation_runs",
    "profile_reports",
    "phases",
    "availability_rules",
    "calendar_events",
  ])
    expect(
      (
        await pg.query(
          "select * from coach." + table + " where program_id=$1",
          [program],
        )
      ).rows,
    ).toHaveLength(0);
  await expect(
    withSession(db, tokens[0], (r) => r.onboarding().load()),
  ).rejects.toThrow("Sign in");
  expect(
    (await withSession(db, tokens[1], (r) => r.onboarding().load())).data,
  ).toEqual(b);
});
