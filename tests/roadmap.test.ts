import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { blankSetup, type Setup } from "../src/domain/onboarding";
import {
  applyCalendar,
  applyEdits,
  calendarDefaults,
  conflicts,
  editsFor,
  protect,
} from "../src/domain/roadmap";
import {
  digest,
  withSession,
  type Database,
  type Query,
} from "../src/server/db/repository";
import { fixtureSeasonProvider } from "../src/server/ai/season-provider";
import { generateSeason } from "../src/server/ai/generate-season";
let pg: PGlite, db: Database;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    "create table public.coach_migrations(name text primary key, checksum text not null)",
  );
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile("migrations/" + name, "utf8"));
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
        teamName: "M3 synthetic",
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
  const gen = await generateSeason(
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
  const id = await withSession(db, token, (r) =>
    r.roadmap().open(gen.id, randomUUID()),
  );
  const view = () => withSession(db, token, (r) => r.roadmap().get(id));
  return { actor, token, setup, id, view };
}
async function accept(f: Awaited<ReturnType<typeof fixture>>, id = f.id) {
  const v = await withSession(db, f.token, (r) => r.roadmap().get(id));
  return withSession(db, f.token, (r) =>
    r.roadmap().save(id, editsFor(v.version.plan), randomUUID(), true),
  );
}
it("expands 24 slots, atomically accepts once, preserves refresh and rejects competing acceptance", async () => {
  const f = await fixture(),
    v = await f.view();
  expect(v.version.plan.sessions).toHaveLength(24);
  expect(v.version.plan.weeks).toHaveLength(12);
  expect(v.conflicts).toEqual([]);
  const request = randomUUID();
  const ids = await Promise.all(
    [1, 2].map(() =>
      withSession(db, f.token, (r) =>
        r.roadmap().save(f.id, editsFor(v.version.plan), request, true),
      ),
    ),
  );
  expect(ids[0]).toBe(ids[1]);
  const saved = await withSession(db, f.token, (r) => r.roadmap().get(ids[0]));
  expect(saved.currentId).toBe(ids[0]);
  expect(saved.history).toHaveLength(2);
  expect(saved.version.plan).toEqual(v.version.plan);
  await expect(accept(f)).rejects.toThrow("out of date");
  expect(
    (
      await pg.query("select * from coach.plan_sessions where season_id=$1", [
        f.setup.seasonId,
      ])
    ).rows,
  ).toHaveLength(24);
});
it("skips blocking tournament dates without inventing substitute sessions", async () => {
  const f = await fixture([
    {
      type: "tournament",
      title: "Weekend event",
      start: "2027-01-04",
      end: "2027-01-06",
      time: "",
      endTime: "",
      blocksPractice: true,
    },
  ]);
  const p = (await f.view()).version.plan;
  expect(p.sessions).toHaveLength(22);
  expect(p.sessions.every((s) => s.date > "2027-01-06")).toBe(true);
});
it("persists manual edits/locks, rejects lock bypass, and recovers older text as a new version", async () => {
  const f = await fixture();
  let id = await accept(f),
    v = await withSession(db, f.token, (r) => r.roadmap().get(id));
  const original = v.version.plan.weeks[0].emphasis;
  let e = editsFor(v.version.plan);
  e.weeks[0].emphasis = "Teach spacing with clear passing lanes.";
  e.weeks[0].checkpoint =
    "Coach observes players finding an open passing lane.";
  id = await withSession(db, f.token, (r) =>
    r.roadmap().save(id, e, randomUUID(), true),
  );
  v = await withSession(db, f.token, (r) => r.roadmap().get(id));
  expect(v.version.plan.weeks[0].contentVersion).toBe(2);
  const recovered = await withSession(db, f.token, (r) =>
    r.roadmap().recover(f.id, id, id, randomUUID()),
  );
  const rv = await withSession(db, f.token, (r) => r.roadmap().get(recovered));
  expect(rv.version.plan.weeks[0].emphasis).toBe(original);
  expect(rv.currentId).toBe(id);
  expect(rv.history).toHaveLength(4);
  id = await accept(f, recovered);
  v = await withSession(db, f.token, (r) => r.roadmap().get(id));
  e = editsFor(v.version.plan);
  e.weeks[0].locked = true;
  e.goals[0].locked = true;
  id = await withSession(db, f.token, (r) =>
    r.roadmap().save(id, e, randomUUID(), true),
  );
  v = await withSession(db, f.token, (r) => r.roadmap().get(id));
  e = editsFor(v.version.plan);
  e.weeks[0].locked = false;
  e.weeks[0].emphasis = "Bypass lock";
  await expect(
    withSession(db, f.token, (r) =>
      r.roadmap().save(id, e, randomUUID(), true),
    ),
  ).rejects.toThrow("unlock");
});
it("previews a seven-day shift, retains IDs/content versions and fixed events, and makes conflicts actionable", async () => {
  // A same-time fixed event outside the original season cannot be entered; use a Tuesday
  // override to demonstrate a fixed event conflict after moving seven days.
  const f = await fixture([
    {
      type: "game",
      title: "Fixed game",
      start: "2027-01-11",
      end: "2027-01-11",
      time: "18:00",
      endTime: "19:30",
      blocksPractice: true,
    },
  ]);
  const active = await accept(f);
  const v = await withSession(db, f.token, (r) => r.roadmap().get(active)),
    p = v.version.plan;
  const c = calendarDefaults(
    p,
    "2027-01-11",
    "2027-04-04",
    "shift",
    "2026-09-18",
  );
  const preview = await withSession(db, f.token, (r) =>
    r.roadmap().calendar(active, c, randomUUID()),
  );
  const next = await withSession(db, f.token, (r) => r.roadmap().get(preview));
  expect(next.currentId).toBe(active);
  expect(next.version.plan.sessions[0].id).toBe(p.sessions[0].id);
  expect(next.version.plan.sessions[0].date).toBe("2027-01-11");
  expect(next.version.plan.events).toEqual(p.events);
  expect(next.version.plan.weeks[0].contentVersion).toBe(
    p.weeks[0].contentVersion,
  );
  expect(next.conflicts.join(" ")).toContain("Fixed game");
  await expect(accept(f, preview)).rejects.toThrow("conflicts");
  const fix = calendarDefaults(
    next.version.plan,
    next.version.plan.start,
    next.version.plan.end,
    "keep",
    "2026-09-18",
  );
  fix.sessions[0].cancel = true;
  const resolved = await withSession(db, f.token, (r) =>
    r.roadmap().calendar(preview, fix, randomUUID()),
  );
  const accepted = await accept(f, resolved),
    final = await withSession(db, f.token, (r) => r.roadmap().get(accepted));
  expect(final.version.plan.sessions[0].status).toBe("canceled");
  expect(final.version.plan.sessions[1].date).toBe("2027-01-13");
  expect(final.version.plan.sessions[1].contentVersion).toBe(
    p.sessions[1].contentVersion,
  );
  expect(final.version.plan.events).toEqual(p.events);
});
it("requires explicit resolution when shortened, retains canceled rows, and keeps dates when requested", async () => {
  const f = await fixture(),
    p = (await f.view()).version.plan;
  const keep = applyCalendar(
    p,
    calendarDefaults(p, "2027-01-04", "2027-04-04", "keep", "2026-09-18"),
    "2026-09-18",
    randomUUID,
  );
  expect(keep.sessions).toEqual(p.sessions);
  expect(keep.weeks).toHaveLength(13);
  const c = calendarDefaults(p, p.start, "2027-03-21", "keep", "2026-09-18");
  let n = applyCalendar(p, c, "2026-09-18", randomUUID);
  expect(
    conflicts(n, n.availability).some(
      (x) => x.includes("reassign") || x.includes("outside"),
    ),
  ).toBe(true);
  expect(n.weeks).toHaveLength(12);
  c.weeks[11].remove = true;
  for (const s of c.sessions) if (s.date > c.end) s.cancel = true;
  n = applyCalendar(p, c, "2026-09-18", randomUUID);
  expect(conflicts(n, n.availability)).toEqual([]);
  expect(n.weeks).toHaveLength(11);
  expect(n.sessions).toHaveLength(24);
  expect(n.sessions.filter((s) => s.status === "canceled")).toHaveLength(2);
});
it("protects started weeks, past/completed/canceled sessions and live status changed after preview", async () => {
  const f = await fixture(),
    active = await accept(f),
    v = await withSession(db, f.token, (r) => r.roadmap().get(active)),
    p = v.version.plan;
  const past = structuredClone(p);
  past.sessions[2].status = "completed";
  past.sessions[3].status = "canceled";
  const c = calendarDefaults(past, past.start, past.end, "keep", "2027-01-05");
  c.sessions[0].date = "2027-01-06";
  expect(() => applyCalendar(past, c, "2027-01-05", randomUUID)).toThrow(
    "Past",
  );
  const changed = structuredClone(past);
  changed.sessions[2].date = "2027-01-20";
  expect(() => protect(past, changed, "2026-09-18")).toThrow("completed");
  const edits = editsFor(past);
  edits.weeks[0].emphasis = "Rewrite past week";
  expect(() => applyEdits(past, edits, "2027-01-05")).toThrow("Past");
  const shift = calendarDefaults(
    p,
    "2027-01-11",
    "2027-04-04",
    "shift",
    "2026-09-18",
  );
  const preview = await withSession(db, f.token, (r) =>
    r.roadmap().calendar(active, shift, randomUUID()),
  );
  await pg.query(
    "update coach.plan_sessions set status='completed' where id=$1",
    [p.sessions[0].id],
  );
  await expect(accept(f, preview)).rejects.toThrow("completed");
});
it("rejects foreign reads, parent references and immutable history writes through runtime RLS", async () => {
  const a = await fixture(),
    b = await fixture();
  await expect(
    withSession(db, a.token, (r) => r.roadmap().get(b.id)),
  ).rejects.toThrow("unavailable");
  await expect(
    withSession(db, a.token, (r) =>
      r.roadmap().recover(b.id, null, null, randomUUID()),
    ),
  ).rejects.toThrow("unavailable");
  await pg.transaction(async (tx) => {
    await tx.exec("set local role season_coach_app");
    await tx.query("select set_config('coach.actor_id',$1,true)", [a.actor]);
    expect(
      (await tx.query("select id from coach.plan_versions where id=$1", [b.id]))
        .rows,
    ).toHaveLength(0);
  });
  await expect(
    pg.transaction(async (tx) => {
      await tx.exec("set local role season_coach_app");
      await tx.query("select set_config('coach.actor_id',$1,true)", [a.actor]);
      await tx.query(
        "update coach.plan_versions set reason='tamper' where id=$1",
        [a.id],
      );
    }),
  ).rejects.toThrow("permission denied");
  const [own] = (
    await pg.query<{ program_id: string }>(
      "select program_id from coach.seasons where id=$1",
      [a.setup.seasonId],
    )
  ).rows;
  await expect(
    pg.query("update coach.seasons set current_plan_id=$1 where id=$2", [
      b.id,
      a.setup.seasonId,
    ]),
  ).rejects.toThrow("foreign key");
  await pg.query("update coach.programs set synthetic=true where id=$1", [
    own.program_id,
  ]);
  await withSession(db, a.token, (r) =>
    r.onboarding().deleteSynthetic(own.program_id, "M3 synthetic"),
  );
  expect(
    (
      await pg.query("select id from coach.plan_versions where season_id=$1", [
        a.setup.seasonId,
      ])
    ).rows,
  ).toHaveLength(0);
});
it("rejects acceptance after context changes without replacing the active pointer", async () => {
  const f = await fixture();
  await pg.query(
    "update coach.seasons set context_version=context_version+1 where id=$1",
    [f.setup.seasonId],
  );
  await expect(accept(f)).rejects.toThrow("out of date");
  expect(
    (
      await pg.query<{ current_plan_id: string | null }>(
        "select current_plan_id from coach.seasons where id=$1",
        [f.setup.seasonId],
      )
    ).rows[0].current_plan_id,
  ).toBeNull();
});

it("supports resolved first-review shortening and requires calendar review after acceptance", async () => {
  const f = await fixture(),
    p = (await f.view()).version.plan;
  const c = calendarDefaults(p, p.start, "2027-03-21", "keep", "2026-09-18");
  c.weeks[11].remove = true;
  c.sessions.filter((x) => x.date > c.end).forEach((x) => (x.cancel = true));
  const preview = await withSession(db, f.token, (r) =>
    r.roadmap().calendar(f.id, c, randomUUID()),
  );
  const id = await accept(f, preview);
  const v = await withSession(db, f.token, (r) => r.roadmap().get(id));
  expect(v.version.plan.weeks).toHaveLength(11);
  expect(
    v.version.plan.sessions.filter((x) => x.status === "canceled"),
  ).toHaveLength(2);
  const settings = (
    await withSession(db, f.token, (r) => r.onboarding().load())
  ).data;
  await expect(
    withSession(db, f.token, (r) =>
      r.onboarding().save({
        ...settings,
        end: "2027-03-22",
        phases: settings.phases.map((x) => ({ ...x, end: "2027-03-22" })),
      }),
    ),
  ).rejects.toThrow("Change dates or practice availability");
  await withSession(db, f.token, (r) =>
    r.onboarding().save({
      ...settings,
      reports: { ...settings.reports, goals: "Coach revised goals" },
    }),
  );
  await expect(
    withSession(db, f.token, (r) =>
      r.roadmap().save(id, editsFor(v.version.plan), randomUUID(), true),
    ),
  ).rejects.toThrow("out of date");
  const [row] = (
    await pg.query<{ program_id: string }>(
      "select program_id from coach.seasons where id=$1",
      [f.setup.seasonId],
    )
  ).rows;
  await pg.query("update coach.programs set synthetic=true where id=$1", [
    row.program_id,
  ]);
  await withSession(db, f.token, (r) =>
    r.onboarding().deleteSynthetic(row.program_id, "M3 synthetic"),
  );
  expect(
    (
      await pg.query("select id from coach.plan_sessions where season_id=$1", [
        f.setup.seasonId,
      ])
    ).rows,
  ).toHaveLength(0);
});

it("recovers removed teaching content into an explicit conflict review without restoring calendar sources", async () => {
  const f = await fixture(),
    first = await accept(f),
    initial = await withSession(db, f.token, (r) => r.roadmap().get(first));
  const c = calendarDefaults(
    initial.version.plan,
    initial.version.plan.start,
    "2027-03-21",
    "keep",
    "2026-09-18",
  );
  c.weeks[11].remove = true;
  c.sessions.filter((x) => x.date > c.end).forEach((x) => (x.cancel = true));
  const preview = await withSession(db, f.token, (r) =>
      r.roadmap().calendar(first, c, randomUUID()),
    ),
    active = await accept(f, preview);
  const restored = await withSession(db, f.token, (r) =>
      r.roadmap().recover(first, active, active, randomUUID()),
    ),
    v = await withSession(db, f.token, (r) => r.roadmap().get(restored));
  expect(v.version.plan.end).toBe("2027-03-21");
  expect(v.version.plan.weeks).toHaveLength(12);
  expect(v.conflicts.length).toBeGreaterThan(0);
  expect(v.currentId).toBe(active);
  expect(
    v.version.plan.sessions.filter((x) => x.status === "canceled"),
  ).toHaveLength(2);
});
