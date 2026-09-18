import { it, expect } from "vitest";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { fixtureIds } from "../scripts/fixtures.mjs";
import {
  digest,
  withSession,
  type Database,
} from "../src/server/db/repository";
import { fixtureSeasonProvider } from "../src/server/ai/season-provider";
it.skipIf(process.env.RUN_HOSTED_DB_TESTS !== "1")(
  "persists actual JSON drafts using the restricted hosted PostgreSQL driver",
  async () => {
    const ssl = process.env.DATABASE_CA_CERT_FILE
      ? {
          ca: readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8"),
          rejectUnauthorized: true,
        }
      : ("verify-full" as const);
    const admin = postgres(process.env.MIGRATION_DATABASE_URL!, {
      ssl,
      max: 1,
      prepare: false,
    });
    const runtime = postgres(process.env.DATABASE_URL!, {
      ssl,
      max: 1,
      prepare: false,
    });
    const database: Database = {
      transaction: (work) =>
        runtime.begin(async (tx) =>
          work(
            async (sql, values = []) =>
              (await tx.unsafe(sql, values as never[])) as never,
          ),
        ) as never,
    };
    const token = randomBytes(32).toString("hex"),
      runs: string[] = [];
    try {
      await admin.unsafe(
        "insert into coach.sessions(token_hash,account_id) values($1,$2)",
        [digest(token), process.env.SEED_COACH_A_ID!],
      );
      for (const action of ["assessSeason", "draftRoadmap"] as const) {
        const req = {
          teamId: fixtureIds[0].team,
          seasonId: fixtureIds[0].season,
          action,
          idempotencyKey: randomUUID(),
        };
        const start = await withSession(database, token, (r) =>
          r.planning().begin(req, "fixture", "season-fixture-v2"),
        );
        runs.push(start.id);
        const claimed = await withSession(database, token, (r) =>
          r.planning().claim(start.id, "fixture", "season-fixture-v2"),
        );
        expect(claimed).not.toBeNull();
        const output = await fixtureSeasonProvider.generate(
          action,
          claimed!.context,
          false,
          new AbortController().signal,
        );
        const view = await withSession(database, token, (r) =>
          r.planning().finish(start.id, output.value, {
            attempts: 1,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: 1,
          }),
        );
        expect(view.status).toBe("succeeded");
        expect(view.draft?.schemaVersion).toBe(1);
      }
    } catch (error) {
      const e = error as {
        code?: string;
        constraint_name?: string;
        message?: string;
      };
      throw new Error(
        "Hosted draft check failed: " +
          (e.code ?? "assertion") +
          " " +
          (e.constraint_name ?? ""),
      );
    } finally {
      for (const id of runs)
        await admin.unsafe("delete from coach.generation_runs where id=$1", [
          id,
        ]);
      await admin.unsafe("delete from coach.sessions where token_hash=$1", [
        digest(token),
      ]);
      await admin.end();
      await runtime.end();
    }
  },
  60000,
);
