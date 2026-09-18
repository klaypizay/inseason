import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fixtureIds } from "../scripts/fixtures.mjs";
import {
  digest,
  revokeApplicationSession,
  withSession,
  type Database,
  type Query,
} from "../src/server/db/repository";

describe.skipIf(process.env.RUN_HOSTED_DB_TESTS !== "1")(
  "hosted M0 isolation",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;
    let database: Database;
    const tokens = [
      randomBytes(32).toString("hex"),
      randomBytes(32).toString("hex"),
    ];
    beforeAll(async () => {
      const ssl = process.env.DATABASE_CA_CERT_FILE
        ? {
            ca: readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8"),
            rejectUnauthorized: true,
          }
        : ("verify-full" as const);
      admin = postgres(process.env.MIGRATION_DATABASE_URL!, {
        ssl,
        max: 1,
        prepare: false,
      });
      runtime = postgres(process.env.DATABASE_URL!, {
        ssl,
        max: 1,
        prepare: false,
      });
      const roles =
        await runtime`select current_user as name,rolsuper,rolbypassrls from pg_roles where rolname=current_user`;
      expect(roles[0]).toMatchObject({
        name: "season_coach_app",
        rolsuper: false,
        rolbypassrls: false,
      });
      for (const [index, actor] of [
        process.env.SEED_COACH_A_ID!,
        process.env.SEED_COACH_B_ID!,
      ].entries()) {
        await admin`insert into coach.sessions(token_hash,account_id) values(${digest(tokens[index])},${actor})`;
      }
      database = {
        async transaction<T>(work: (q: Query) => Promise<T>): Promise<T> {
          return runtime.begin(async (tx) =>
            work(
              async (sql, values = []) =>
                (await tx.unsafe(sql, values as never[])) as never,
            ),
          ) as Promise<T>;
        },
      };
    });
    afterAll(async () => {
      if (admin) {
        await admin`delete from coach.sessions where token_hash in ${admin(tokens.map(digest))}`;
        await admin.end({ timeout: 2 });
      }
      if (runtime) await runtime.end({ timeout: 2 });
    });
    it("isolates both coaches at direct, nested, mutation and generation entry points", async () => {
      for (const [index, token] of tokens.entries()) {
        const own = fixtureIds[index],
          other = fixtureIds[1 - index];
        expect(await withSession(database, token, (r) => r.teams())).toEqual([
          { id: own.team, name: index === 0 ? "Demo Cedar" : "Demo Willow" },
        ]);
        expect(
          await withSession(database, token, (r) =>
            r.roster(own.team, own.season),
          ),
        ).not.toHaveLength(0);
        await expect(
          withSession(database, token, (r) => r.team(other.team)),
        ).rejects.toThrow("unavailable");
        await expect(
          withSession(database, token, (r) => r.season(own.team, other.season)),
        ).rejects.toThrow("unavailable");
        await expect(
          withSession(database, token, (r) =>
            r.renameTeam(other.team, "Forbidden"),
          ),
        ).rejects.toThrow("unavailable");
        await expect(
          withSession(database, token, (r) =>
            r.renameSeason(other.team, other.season, "Forbidden"),
          ),
        ).rejects.toThrow("unavailable");
        await expect(
          withSession(database, token, (r) => r.generation(other.run)),
        ).rejects.toThrow("unavailable");
        await expect(
          withSession(database, token, (r) => r.failGeneration(other.run)),
        ).rejects.toThrow("unavailable");
      }
      await expect(
        withSession(database, undefined, (r) => r.teams()),
      ).rejects.toThrow("Sign in");
      await revokeApplicationSession(database, tokens[0]);
      await expect(
        withSession(database, tokens[0], (r) => r.teams()),
      ).rejects.toThrow("Sign in");
    });
    it("keeps the migration ledger and private schema inaccessible to API roles", async () => {
      const rows =
        await admin`select r as role,has_schema_privilege(r,'coach','USAGE') as schema_access,
      has_table_privilege(r,'public.coach_migrations','SELECT') as ledger_read,
      has_table_privilege(r,'public.coach_migrations','INSERT') as ledger_write
      from unnest(array['anon','authenticated']) r`;
      for (const row of rows)
        expect(row).toMatchObject({
          schema_access: false,
          ledger_read: false,
          ledger_write: false,
        });
    });
  },
);
