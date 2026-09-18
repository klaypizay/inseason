import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { blankSetup, type Setup } from "../src/domain/onboarding";
import { editsFor } from "../src/domain/roadmap";
import {
  eligibleSessions,
  generatedWeek,
  manualWeek,
  validateWeek,
} from "../src/domain/week";
import {
  digest,
  withSession,
  type Database,
  type Query,
} from "../src/server/db/repository";
import { fixtureSeasonProvider } from "../src/server/ai/season-provider";
import { fixtureWeekProvider, runWeek } from "../src/server/ai/week-provider";
import { generateSeason } from "../src/server/ai/generate-season";
import { executeWeek } from "../src/server/ai/generate-week";
let pg: PGlite, db: Database;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    "create table public.coach_migrations(name text primary key,checksum text not null)",
  );
  for (const f of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile("migrations/" + f, "utf8"));
  db = {
    transaction: (work) =>
      pg.transaction(async (tx) => {
        await tx.exec("set local role season_coach_app");
        const q: Query = async (s, v) => (await tx.query(s, v)).rows as never;
        return work(q);
      }),
  };
});
afterAll(async () => pg.close());
async function fixture(events: Setup["events"] = []) {
  const actor = randomUUID(),
    token = randomBytes(32).toString("hex");
  await pg.query("insert into coach.accounts(id) values($1)", [actor]);
  await pg.query(
    "insert into coach.sessions(token_hash,account_id) values($1,$2)",
    [digest(token), actor],
  );
  const setup = (
    await withSession(db, token, (r) =>
      r.onboarding().save({
        ...blankSetup(),
        teamName: "M4 synthetic",
        complete: true,
        start: "2027-01-04",
        end: "2027-03-28",
        playerCount: 9,
        hoops: 1,
        court: "half",
        phases: [{ type: "in_season", start: "2027-01-04", end: "2027-03-28" }],
        availability: [1, 3].map((weekday) => ({
          weekday,
          time: "18:00",
          minutes: 90,
          start: null,
          end: null,
        })),
        events,
      }),
    )
  ).data;
  const run = await generateSeason(
    db,
    token,
    {
      teamId: setup.teamId!,
      seasonId: setup.seasonId!,
      action: "draftRoadmap",
      idempotencyKey: randomUUID(),
    },
    fixtureSeasonProvider,
  );
  const review = await withSession(db, token, (r) =>
    r.roadmap().open(run.id, randomUUID()),
  );
  const v = await withSession(db, token, (r) => r.roadmap().get(review));
  const roadmap = await withSession(db, token, (r) =>
    r.roadmap().save(review, editsFor(v.version.plan), randomUUID(), true),
  );
  const week = v.version.plan.weeks[0].id;
  const get = () => withSession(db, token, (r) => r.week().get(week));
  return { actor, token, setup, roadmap, week, get };
}
async function save(f: Awaited<ReturnType<typeof fixture>>, accept = false) {
  const v = await f.get();
  return withSession(db, f.token, (r) =>
    r
      .week()
      .save(
        f.week,
        v.reviewId,
        f.roadmap,
        v.version?.content ?? manualWeek(v.context, randomUUID),
        randomUUID(),
        accept,
      ),
  );
}
it("saves and accepts immutable linked objectives atomically and idempotently", async () => {
  const f = await fixture(),
    view = await f.get(),
    content = manualWeek(view.context, randomUUID),
    request = randomUUID();
  const a = await withSession(db, f.token, (r) =>
    r.week().save(f.week, null, f.roadmap, content, request, true),
  );
  const b = await withSession(db, f.token, (r) =>
    r.week().save(f.week, null, f.roadmap, content, request, true),
  );
  expect(a).toBe(b);
  const next = await f.get();
  expect(next.currentId).toBe(a);
  expect(next.version?.content).toEqual(content);
  const rows = (
    await pg.query(
      "select roadmap_id,goal_id,week_id from coach.week_objectives where version_id=$1",
      [a],
    )
  ).rows;
  expect(rows).toEqual([
    {
      roadmap_id: f.roadmap,
      goal_id: content.objectives[0].goalId,
      week_id: f.week,
    },
  ]);
  await expect(
    withSession(db, f.token, (r) =>
      r.week().save(f.week, null, f.roadmap, content, randomUUID(), true),
    ),
  ).rejects.toThrow("changed");
});
it("generates on demand without accepting; locks, text, and assignments survive regeneration", async () => {
  const f = await fixture();
  await save(f, true);
  let v = await f.get();
  const content = structuredClone(v.version!.content);
  content.objectives[0].description = "Coach-picked teaching priority";
  content.objectives[0].locked = true;
  await withSession(db, f.token, (r) =>
    r.week().save(f.week, v.reviewId, f.roadmap, content, randomUUID(), true),
  );
  v = await f.get();
  const accepted = v.currentId;
  const run = await withSession(db, f.token, (r) =>
    r
      .week()
      .begin(
        f.week,
        v.reviewId,
        f.roadmap,
        randomUUID(),
        "fixture",
        fixtureWeekProvider.model,
        30,
      ),
  );
  await executeWeek(db, f.token, run, fixtureWeekProvider);
  v = await f.get();
  expect(v.currentId).toBe(accepted);
  expect(v.reviewId).not.toBe(accepted);
  expect(v.version!.content.objectives[0]).toEqual(content.objectives[0]);
  expect(v.runs[0].status).toBe("succeeded");
  const altered = structuredClone(v.version!.content);
  altered.objectives[0].description = "Overwrite";
  await expect(
    withSession(db, f.token, (r) =>
      r.week().save(f.week, v.reviewId, f.roadmap, altered, randomUUID(), true),
    ),
  ).rejects.toThrow("Locked");
});
it("supports zero-practice and tournament-heavy weeks without invented sessions", async () => {
  for (const end of ["2027-01-06", "2027-01-04"]) {
    const f = await fixture([
      {
        type: "tournament",
        title: "Synthetic event",
        start: "2027-01-04",
        end,
        time: "",
        endTime: "",
        blocksPractice: true,
      },
    ]);
    const v = await f.get(),
      previous = manualWeek(v.context, randomUUID);
    const result = await runWeek(
      fixtureWeekProvider,
      { context: v.context, previous },
      async () => {},
    );
    expect(result.errorCode).toBeUndefined();
    expect(result.content!.allocations).toHaveLength(
      end === "2027-01-06" ? 0 : 1,
    );
    expect(result.content!.objectives).toHaveLength(1);
    expect(v.context.events).toHaveLength(1);
    const bad = {
      ...result.content,
      allocations: [{ sessionId: randomUUID(), objectiveIds: [] }],
    };
    expect(() => validateWeek(bad, v.context)).toThrow("accepted roadmap");
    await withSession(db, f.token, (r) =>
      r
        .week()
        .save(f.week, null, f.roadmap, result.content, randomUUID(), true),
    );
  }
});
it("rejects other-coach reads, writes, nested goal/session IDs and generation access", async () => {
  const a = await fixture(),
    b = await fixture(),
    av = await a.get(),
    bv = await b.get();
  await expect(
    withSession(db, b.token, (r) => r.week().get(a.week)),
  ).rejects.toThrow("unavailable");
  await expect(
    withSession(db, b.token, (r) =>
      r
        .week()
        .save(
          a.week,
          null,
          a.roadmap,
          manualWeek(av.context, randomUUID),
          randomUUID(),
          true,
        ),
    ),
  ).rejects.toThrow("unavailable");
  const content = manualWeek(av.context, randomUUID);
  content.objectives[0].goalId = bv.context.goals[0].id;
  await expect(
    withSession(db, a.token, (r) =>
      r.week().save(a.week, null, a.roadmap, content, randomUUID(), true),
    ),
  ).rejects.toThrow("accepted roadmap");
  const run = await withSession(db, a.token, (r) =>
    r
      .week()
      .begin(
        a.week,
        null,
        a.roadmap,
        randomUUID(),
        "fixture",
        fixtureWeekProvider.model,
        30,
      ),
  );
  await expect(
    withSession(db, b.token, (r) =>
      r.week().claim(run, "fixture", fixtureWeekProvider.model),
    ),
  ).rejects.toThrow("unavailable");
  await expect(
    withSession(db, undefined, (r) => r.week().get(a.week)),
  ).rejects.toThrow();
});
it("discards late generation after a manual save or roadmap change", async () => {
  const f = await fixture(),
    v = await f.get();
  const run = await withSession(db, f.token, (r) =>
    r
      .week()
      .begin(
        f.week,
        null,
        f.roadmap,
        randomUUID(),
        "fixture",
        fixtureWeekProvider.model,
        30,
      ),
  );
  const context = await withSession(db, f.token, (r) =>
    r.week().claim(run, "fixture", fixtureWeekProvider.model),
  );
  const saved = await save(f, true);
  const result = await runWeek(fixtureWeekProvider, context!, async () => {});
  await withSession(db, f.token, (r) =>
    r.week().finish(run, result.content, result.metrics),
  );
  expect((await f.get()).currentId).toBe(saved);
  expect((await f.get()).runs[0].error).toBe("stale_context");
  const roadmap = await withSession(db, f.token, (r) =>
    r.roadmap().get(f.roadmap),
  );
  const next = await withSession(db, f.token, (r) =>
    r
      .roadmap()
      .save(f.roadmap, editsFor(roadmap.version.plan), randomUUID(), true),
  );
  expect((await f.get()).stale).toBe(true);
  await expect(
    withSession(db, f.token, (r) =>
      r
        .week()
        .save(
          f.week,
          saved,
          next,
          manualWeek(v.context, randomUUID),
          randomUUID(),
          true,
        ),
    ),
  ).rejects.toThrow("Refresh");
  await withSession(db, f.token, (r) =>
    r.week().refresh(f.week, saved, next, randomUUID()),
  );
  expect((await f.get()).stale).toBe(false);
  expect((await f.get()).version!.roadmapId).toBe(next);
});
it("preserves completed-session teaching and rejects invalid output; outage leaves manual saves available", async () => {
  const f = await fixture();
  await save(f, true);
  let v = await f.get();
  await pg.query(
    "update coach.plan_sessions set status='completed' where id=$1",
    [v.context.sessions[0].id],
  );
  v = await f.get();
  const bad = structuredClone(v.version!.content);
  bad.objectives[0].description = "rewrite completed work";
  expect(() => validateWeek(bad, v.context, v.version!.content)).toThrow(
    "completed",
  );
  expect(() =>
    generatedWeek(
      { objectives: [], allocations: [], rationale: "x", assumptions: [] },
      { context: v.context, previous: v.version!.content },
      randomUUID,
    ),
  ).toThrow();
  const result = await runWeek(
    {
      ...fixtureWeekProvider,
      generate: async () => {
        throw Error("synthetic outage");
      },
    },
    { context: v.context, previous: v.version!.content },
    async () => {},
  );
  expect(result.errorCode).toBe("provider_unavailable");
  await save(f, false);
});
it("enforces shared quota, expires interrupted runs, and cascades program deletion", async () => {
  const f = await fixture();
  await save(f, true);
  const latestForQuota = await f.get();
  await expect(
    withSession(db, f.token, (r) =>
      r
        .week()
        .begin(
          f.week,
          latestForQuota.reviewId,
          f.roadmap,
          randomUUID(),
          "fixture",
          fixtureWeekProvider.model,
          1,
        ),
    ),
  ).rejects.toThrow("Generation limit");
  const saved = await f.get();
  const run = await withSession(db, f.token, (r) =>
    r
      .week()
      .begin(
        f.week,
        saved.reviewId,
        f.roadmap,
        randomUUID(),
        "fixture",
        fixtureWeekProvider.model,
        30,
      ),
  );
  await pg.query(
    "update coach.generation_runs set lease_expires_at=now()-interval '1 minute' where id=$1",
    [run],
  );
  expect((await f.get()).runs[0].status).toBe("failed");
  const [p] = (
    await pg.query<{ program_id: string }>(
      "select program_id from coach.seasons where id=$1",
      [f.setup.seasonId],
    )
  ).rows;
  await pg.query("delete from coach.programs where id=$1", [p.program_id]);
  for (const table of [
    "week_versions",
    "week_heads",
    "week_objectives",
    "week_allocations",
    "week_generation_contexts",
  ])
    expect(
      (
        await pg.query(`select * from coach.${table} where program_id=$1`, [
          p.program_id,
        ])
      ).rows,
    ).toEqual([]);
});
it("database policies and foreign keys independently prevent cross-program links", async () => {
  const a = await fixture(),
    b = await fixture();
  const version = await save(a, true),
    av = await a.get(),
    bv = await b.get();
  const [owner] = (
    await pg.query<{ program_id: string }>(
      "select program_id from coach.seasons where id=$1",
      [a.setup.seasonId],
    )
  ).rows;
  await pg.transaction(async (tx) => {
    await tx.exec("set local role season_coach_app");
    await tx.query("select set_config('coach.actor_id',$1,true)", [b.actor]);
    expect(
      (
        await tx.query("select * from coach.week_versions where id=$1", [
          version,
        ])
      ).rows,
    ).toEqual([]);
  });
  await expect(
    pg.transaction(async (tx) => {
      await tx.exec("set local role season_coach_app");
      await tx.query("select set_config('coach.actor_id',$1,true)", [a.actor]);
      await tx.query(
        "insert into coach.week_objectives(id,version_id,program_id,season_id,week_id,roadmap_id,goal_id,description,success_criteria,priority,locked,created_by) values($1,$2,$3,$4,$5,$6,$7,'Foreign goal','Check',1,false,$8)",
        [
          randomUUID(),
          version,
          owner.program_id,
          a.setup.seasonId,
          a.week,
          a.roadmap,
          bv.context.goals[0].id,
          a.actor,
        ],
      );
    }),
  ).rejects.toMatchObject({ code: "23503" });
  const input = manualWeek(av.context, randomUUID);
  expect(() =>
    validateWeek({ ...input, ownerId: b.actor }, av.context),
  ).toThrow();
  const foreignSession = {
    ...input,
    allocations: [{ sessionId: bv.context.sessions[0].id, objectiveIds: [] }],
  };
  expect(() => validateWeek(foreignSession, av.context)).toThrow();
});
it("persists provider failure without changing the accepted week and permits manual editing", async () => {
  const f = await fixture(),
    accepted = await save(f, true);
  const run = await withSession(db, f.token, (r) =>
    r
      .week()
      .begin(
        f.week,
        accepted,
        f.roadmap,
        randomUUID(),
        "fixture",
        fixtureWeekProvider.model,
        30,
      ),
  );
  await executeWeek(db, f.token, run, {
    ...fixtureWeekProvider,
    generate: async () => {
      throw Error("Synthetic outage");
    },
  });
  const v = await f.get();
  expect(v.currentId).toBe(accepted);
  expect(v.runs[0].status).toBe("failed");
  await save(f, false);
  expect((await f.get()).currentId).toBe(accepted);
});
it("preserves manual allocation overrides even when generation omits their objective slot", async () => {
  const f = await fixture(),
    v = await f.get(),
    previous = manualWeek(v.context, randomUUID);
  const extra = {
    ...previous.objectives[0],
    id: randomUUID(),
    description: "Coach-selected second priority",
  };
  previous.objectives.push(extra);
  previous.allocations[0] = {
    ...previous.allocations[0],
    manual: true,
    objectiveIds: [extra.id],
  };
  const value = {
    rationale: "Simple weekly progression",
    assumptions: [],
    objectives: [
      {
        slot: 1,
        goalId: previous.objectives[0].goalId,
        description: "Suggested first priority",
        successCriteria: "Coach observes the action",
      },
    ],
    allocations: v.context.sessions.map((s) => ({
      sessionId: s.id,
      objectiveSlots: [1],
    })),
  };
  const result = generatedWeek(
    value,
    { context: v.context, previous },
    randomUUID,
  );
  expect(result.objectives).toContainEqual(extra);
  expect(result.allocations[0]).toEqual(previous.allocations[0]);
  await withSession(db, f.token, (r) =>
    r.week().save(f.week, null, f.roadmap, result, randomUUID(), true),
  );
  expect((await f.get()).version!.content.allocations[0].manual).toBe(true);
});

it("an availability override cannot bypass a blocking competition event", async () => {
  const f = await fixture();
  const view = await withSession(db, f.token, (r) =>
    r.roadmap().get(f.roadmap),
  );
  const plan = structuredClone(view.version.plan),
    session = plan.sessions[0];
  session.override = "Coach approved a different practice time";
  plan.events.push({
    id: randomUUID(),
    type: "tournament",
    title: "Blocked day",
    start: session.date,
    end: session.date,
    time: "",
    endTime: "",
    blocksPractice: true,
  });
  expect(eligibleSessions(plan, f.week).map((s) => s.id)).not.toContain(
    session.id,
  );
  session.status = "completed";
  expect(eligibleSessions(plan, f.week).map((s) => s.id)).toContain(session.id);
});

it("keeps preferences private and rejects stale settings", async () => {
  const a = await fixture(),
    b = await fixture();
  const first = await withSession(db, a.token, (r) => r.preferences().get());
  expect(first.dateFormat).toBe("MM/DD/YYYY");
  const saved = await withSession(db, a.token, (r) =>
    r
      .preferences()
      .save({ ...first, displayName: "Coach A", dateFormat: "DD/MM/YYYY" }),
  );
  expect(saved.revision).toBe(1);
  expect(
    (await withSession(db, b.token, (r) => r.preferences().get())).displayName,
  ).toBe("");
  await expect(
    withSession(db, a.token, (r) => r.preferences().save(first)),
  ).rejects.toThrow(/another tab/);
  await expect(
    withSession(db, a.token, (r) =>
      r.preferences().save({ ...saved, dateFormat: "invalid" }),
    ),
  ).rejects.toThrow();
});
it("organizes roadmap generations, blocks foreign access and protects the active plan", async () => {
  const a = await fixture(),
    b = await fixture();
  const v = await withSession(db, a.token, (r) => r.roadmap().get(a.roadmap));
  const id = v.version.generationId!;
  const old = await withSession(db, a.token, (r) => r.library().item(id));
  const input = {
    name: "Spring development",
    folder: "2027",
    state: "active",
    revision: old.revision,
  };
  const saved = await withSession(db, a.token, (r) =>
    r.library().save(id, input),
  );
  expect(saved.name).toBe(input.name);
  expect(saved.folder).toBe("2027");
  await expect(
    withSession(db, b.token, (r) => r.library().item(id)),
  ).rejects.toThrow();
  await expect(
    withSession(db, b.token, (r) => r.library().save(id, input)),
  ).rejects.toThrow();
  await expect(
    withSession(db, a.token, (r) => r.library().save(id, input)),
  ).rejects.toThrow(/another tab/);
  await expect(
    withSession(db, a.token, (r) =>
      r
        .library()
        .save(id, { ...input, revision: saved.revision, state: "trash" }),
    ),
  ).rejects.toThrow(/replacement/);
  const generated = await generateSeason(
    db,
    a.token,
    {
      teamId: a.setup.teamId!,
      seasonId: a.setup.seasonId!,
      action: "draftRoadmap",
      idempotencyKey: randomUUID(),
    },
    fixtureSeasonProvider,
  );
  const draft = await withSession(db, a.token, (r) =>
    r.roadmap().open(generated.id, randomUUID()),
  );
  const details = await withSession(db, a.token, (r) =>
    r.library().item(generated.id),
  );
  const trashed = await withSession(db, a.token, (r) =>
    r.library().save(generated.id, {
      name: "Second draft",
      folder: "2027",
      state: "trash",
      revision: details.revision,
    }),
  );
  expect(
    (
      await withSession(db, a.token, (r) =>
        r.roadmap().summary(a.setup.seasonId!),
      )
    ).reviewId,
  ).toBe(a.roadmap);
  await expect(
    withSession(db, a.token, (r) =>
      r.roadmap().open(generated.id, randomUUID()),
    ),
  ).rejects.toThrow(/Restore/);
  await expect(
    withSession(db, a.token, (r) =>
      r.roadmap().recover(draft, a.roadmap, a.roadmap, randomUUID()),
    ),
  ).rejects.toThrow(/Restore/);
  await withSession(db, a.token, (r) =>
    r.library().save(generated.id, {
      name: trashed.name,
      folder: trashed.folder,
      state: "active",
      revision: trashed.revision,
    }),
  );
  expect(
    await withSession(db, a.token, (r) =>
      r.roadmap().open(generated.id, randomUUID()),
    ),
  ).toBeTruthy();
});
