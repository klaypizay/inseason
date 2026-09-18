import postgres from "postgres";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { blankSetup } from "../../src/domain/onboarding";
import {
  digest,
  withSession,
  type Database,
} from "../../src/server/db/repository";
import { generateSeason } from "../../src/server/ai/generate-season";
import { fixtureSeasonProvider } from "../../src/server/ai/season-provider";
export async function hostedRoadmapFixture(actor: string = randomUUID()) {
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
    }),
    runtime = postgres(process.env.DATABASE_URL!, {
      ssl,
      max: 1,
      prepare: false,
    });
  const db: Database = {
    transaction: (work) =>
      runtime.begin(async (tx) =>
        work(async (s, v = []) => (await tx.unsafe(s, v as never[])) as never),
      ) as never,
  };
  const token = randomBytes(32).toString("hex");
  let programId: string | undefined;
  const cleanup = async () => {
    try {
      if (programId)
        await admin.unsafe(
          "delete from coach.programs where id=$1 and owner_id=$2 and synthetic",
          [programId, actor],
        );
      await admin.unsafe("delete from coach.sessions where account_id=$1", [
        actor,
      ]);
      await admin.unsafe("delete from coach.accounts where id=$1", [actor]);
    } finally {
      await runtime.end();
      await admin.end();
    }
  };
  try {
    await admin.unsafe("insert into coach.accounts(id) values($1)", [actor]);
    await admin.unsafe(
      "insert into coach.sessions(token_hash,account_id) values($1,$2)",
      [digest(token), actor],
    );
    const setup = (
      await withSession(db, token, (r) =>
        r.onboarding().save({
          ...blankSetup(),
          teamName: "M3 test team",
          title: "Roadmap review fixture",
          complete: true,
          start: "2027-01-04",
          end: "2027-03-28",
          playerCount: 9,
          hoops: 1,
          court: "half",
          phases: [
            { type: "in_season", start: "2027-01-04", end: "2027-03-28" },
          ],
          availability: [1, 3].map((weekday) => ({
            weekday,
            time: "18:00",
            minutes: 90,
            start: null,
            end: null,
          })),
        }),
      )
    ).data;
    const [program] = await admin.unsafe(
      "select program_id from coach.seasons where id=$1",
      [setup.seasonId!],
    );
    programId = program.program_id;
    await admin.unsafe("update coach.programs set synthetic=true where id=$1", [
      programId!,
    ]);
    const generated = await generateSeason(
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
      r.roadmap().open(generated.id, randomUUID()),
    );
    return { db, admin, token, id, generationId: generated.id, setup, cleanup };
  } catch (e) {
    await cleanup();
    throw new Error(
      "Synthetic roadmap fixture failed: " +
        ((e as { code?: string }).code ?? "validation"),
    );
  }
}
