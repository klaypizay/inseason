import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { fixtureIds, seedFixtures } from "../scripts/fixtures.mjs";
import {
  digest,
  revokeApplicationSession,
  withSession,
  type Database,
  type Query,
} from "../src/server/db/repository";
const [a, b] = fixtureIds;
const tokenA = "a".repeat(64),
  tokenB = "b".repeat(64);
let pg: PGlite;
let database: Database;
beforeAll(async () => {
  pg = new PGlite();
  // Model the hosted provider's default grants on the runner-created ledger.
  await pg.exec(`create role anon; create role authenticated;
    create table public.coach_migrations(name text primary key,checksum text not null);
    grant all on public.coach_migrations to anon,authenticated;`);
  await pg.exec(await readFile("migrations/001_foundation.sql", "utf8"));
  await pg.exec(
    await readFile("migrations/002_protect_migration_ledger.sql", "utf8"),
  );
  await pg.exec(await readFile("migrations/003_onboarding.sql", "utf8"));
  const q = async (sql: string, values?: unknown[]) =>
    (await pg.query(sql, values)).rows;
  await seedFixtures(q);
  await seedFixtures(q); // Re-running seeds must not duplicate data.
  for (const [token, actor] of [
    [tokenA, a.coach],
    [tokenB, b.coach],
  ])
    await pg.query(
      "insert into coach.sessions(token_hash,account_id) values($1,$2)",
      [digest(token), actor],
    );
  database = {
    transaction: (work) =>
      pg.transaction(async (tx) => {
        await tx.exec("set local role season_coach_app");
        const query: Query = async (sql, values) =>
          (await tx.query(sql, values)).rows as never;
        return work(query);
      }),
  };
});
afterAll(async () => pg.close());
describe("fresh migration and two-coach isolation", () => {
  it("denies API-role access to migration history despite provider default grants", async () => {
    for (const role of ["anon", "authenticated"]) {
      await expect(
        pg.transaction(async (tx) => {
          await tx.exec(`set local role ${role}`);
          await tx.query("select * from public.coach_migrations");
        }),
      ).rejects.toThrow();
      await expect(
        pg.transaction(async (tx) => {
          await tx.exec(`set local role ${role}`);
          await tx.query(
            "insert into public.coach_migrations values ('forged','forged')",
          );
        }),
      ).rejects.toThrow();
    }
  });
  it("allows each coach to see only their team and roster", async () => {
    expect(await withSession(database, tokenA, (r) => r.teams())).toEqual([
      { id: a.team, name: "Demo Cedar" },
    ]);
    expect(await withSession(database, tokenB, (r) => r.teams())).toEqual([
      { id: b.team, name: "Demo Willow" },
    ]);
    expect(
      await withSession(database, tokenA, (r) => r.roster(a.team, a.season)),
    ).toEqual([
      { id: a.player, alias: "Player Cedar", participation: "unknown" },
    ]);
  });
  it("rejects guessed direct, nested and generation IDs in both directions", async () => {
    for (const [token, own, other] of [
      [tokenA, a, b],
      [tokenB, b, a],
    ] as const) {
      await expect(
        withSession(database, token, (r) => r.team(other.team)),
      ).rejects.toThrow("unavailable");
      await expect(
        withSession(database, token, (r) => r.season(own.team, other.season)),
      ).rejects.toThrow("unavailable");
      await expect(
        withSession(database, token, (r) => r.roster(other.team, other.season)),
      ).rejects.toThrow("unavailable");
      await expect(
        withSession(database, token, (r) => r.generation(other.run)),
      ).rejects.toThrow("unavailable");
      await expect(
        withSession(database, token, (r) => r.renameTeam(other.team, "Attack")),
      ).rejects.toThrow("unavailable");
      await expect(
        withSession(database, token, (r) =>
          r.renameSeason(own.team, other.season, "Attack"),
        ),
      ).rejects.toThrow("unavailable");
      await expect(
        withSession(database, token, (r) => r.failGeneration(other.run)),
      ).rejects.toThrow("unavailable");
    }
  });
  it("allows scoped mutations and preserves the other coach", async () => {
    await withSession(database, tokenA, (r) =>
      r.renameTeam(a.team, "Cedar updated"),
    );
    expect(
      (await withSession(database, tokenA, (r) => r.team(a.team))).name,
    ).toBe("Cedar updated");
    expect(
      (await withSession(database, tokenB, (r) => r.team(b.team))).name,
    ).toBe("Demo Willow");
    await withSession(database, tokenA, (r) =>
      r.renameTeam(a.team, "Demo Cedar"),
    );
  });
  it("fails closed without a session, on unknown tokens and on expired sessions", async () => {
    for (const token of [undefined, "", "c".repeat(64), "bad"])
      await expect(
        withSession(database, token, (r) => r.teams()),
      ).rejects.toThrow("Sign in");
    for (const clause of [
      "last_seen_at=now()-interval '25 hours'",
      "expires_at=now()-interval '1 second'",
    ]) {
      await pg.exec(
        `update coach.sessions set ${clause} where account_id='${a.coach}'`,
      );
      await expect(
        withSession(database, tokenA, (r) => r.teams()),
      ).rejects.toThrow("Sign in");
      await pg.query(
        "update coach.sessions set last_seen_at=now(),expires_at=now()+interval '7 days' where account_id=$1",
        [a.coach],
      );
    }
  });
  it("applies RLS even when a query forgets application ownership filters", async () => {
    await database.transaction(async (q) => {
      expect(await q("select * from coach.teams")).toHaveLength(0);
      await q("select set_config('coach.actor_id',$1,true)", [a.coach]);
      for (const table of [
        "teams",
        "seasons",
        "players",
        "season_roster",
        "generation_runs",
      ]) {
        const rows = await q(`select program_id from coach.${table}`);
        expect(rows).toHaveLength(1);
        expect(rows[0].program_id).toBe(a.program);
      }
      expect(
        await q("update coach.teams set name=$1 where id=$2 returning id", [
          "Attack",
          b.team,
        ]),
      ).toHaveLength(0);
      expect(
        await q("update coach.seasons set title=$1 where id=$2 returning id", [
          "Attack",
          b.season,
        ]),
      ).toHaveLength(0);
      expect(
        await q(
          "update coach.generation_runs set status='failed' where id=$1 returning id",
          [b.run],
        ),
      ).toHaveLength(0);
    });
  });
  it("rejects foreign-parent and foreign-player relationships at the database boundary", async () => {
    await expect(
      pg.query(
        "insert into coach.seasons(program_id,team_id,title,created_by) values($1,$2,$3,$4)",
        [a.program, b.team, "Foreign", a.coach],
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(
        "insert into coach.season_roster(program_id,season_id,player_id,created_by) values($1,$2,$3,$4)",
        [a.program, a.season, b.player, a.coach],
      ),
    ).rejects.toThrow();
  });
  it("does not grant ownership changes to the application role", async () => {
    await expect(
      database.transaction((q) =>
        q("update coach.programs set owner_id=$1 where id=$2", [
          a.coach,
          b.program,
        ]),
      ),
    ).rejects.toThrow();
  });
  it("rejects saved cookie replay after server-side sign-out", async () => {
    await revokeApplicationSession(database, tokenB);
    await expect(
      withSession(database, tokenB, (r) => r.teams()),
    ).rejects.toThrow("Sign in");
    expect(await withSession(database, tokenA, (r) => r.teams())).toHaveLength(
      1,
    );
  });
});
