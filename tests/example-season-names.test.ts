import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { fixtureIds } from "../scripts/fixtures.mjs";

it("renames only original seed labels, preserving custom and unrelated seasons", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create schema coach;
      create table coach.programs(id uuid primary key, synthetic boolean not null, name text);
      create table coach.seasons(id uuid primary key, program_id uuid not null, title text not null);`);
    const [a, b] = fixtureIds;
    for (const f of fixtureIds) {
      await pg.query(
        "insert into coach.programs(id,synthetic) values($1,true)",
        [f.program],
      );
      await pg.query(
        "insert into coach.seasons values($1,$2,'Synthetic season')",
        [f.season, f.program],
      );
    }
    const migration = await readFile(
      "migrations/012_example_season_names.sql",
      "utf8",
    );
    await pg.exec(migration);
    await pg.exec(migration);
    expect(
      (
        await pg.query<{ title: string }>("select title from coach.seasons")
      ).rows.map((s) => s.title),
    ).toEqual(["Example season", "Example season"]);

    await pg.query(
      "update coach.seasons set title='Our winter season' where id=$1",
      [a.season],
    );
    await pg.query(
      "update coach.seasons set title='Synthetic season' where id=$1",
      [b.season],
    );
    await pg.query("update coach.programs set synthetic=false where id=$1", [
      b.program,
    ]);
    await pg.exec(migration);
    expect(
      (
        await pg.query<{ title: string }>(
          "select title from coach.seasons order by id",
        )
      ).rows.map((s) => s.title),
    ).toEqual(["Our winter season", "Synthetic season"]);

    // A similar title on another season, or a mismatched seed/program pair,
    // must not be sufficient to select a coach's content for renaming.
    await pg.query(
      "insert into coach.seasons values('30000000-0000-4000-8000-000000000003',$1,'Synthetic season')",
      [a.program],
    );
    await pg.query("update coach.seasons set program_id=$1 where id=$2", [
      a.program,
      b.season,
    ]);
    await pg.exec(migration);
    expect(
      (
        await pg.query<{ title: string }>(
          "select title from coach.seasons order by id",
        )
      ).rows.map((s) => s.title),
    ).toEqual(["Our winter season", "Synthetic season", "Synthetic season"]);

    const legacyMigration = await readFile(
      "migrations/013_legacy_example_season_names.sql",
      "utf8",
    );
    await pg.query("update coach.seasons set program_id=$1 where id=$2", [
      b.program,
      b.season,
    ]);
    await pg.query(
      "update coach.programs set name='A real program' where id=$1",
      [b.program],
    );
    await pg.exec(legacyMigration);
    expect(
      (
        await pg.query<{ title: string }>(
          "select title from coach.seasons where id=$1",
          [b.season],
        )
      ).rows[0].title,
    ).toBe("Synthetic season");
    await pg.query(
      "update coach.programs set name='Demo Program 2' where id=$1",
      [b.program],
    );
    await pg.exec(legacyMigration);
    await pg.exec(legacyMigration);
    expect(
      (
        await pg.query<{ title: string }>(
          "select title from coach.seasons order by id",
        )
      ).rows.map((s) => s.title),
    ).toEqual(["Our winter season", "Example season", "Synthetic season"]);
    expect(
      (
        await pg.query<{ synthetic: boolean }>(
          "select synthetic from coach.programs where id=$1",
          [b.program],
        )
      ).rows[0].synthetic,
    ).toBe(false);
  } finally {
    await pg.close();
  }
});
