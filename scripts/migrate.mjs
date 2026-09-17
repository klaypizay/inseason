import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { migrationConnection } from "./connection.mjs";
const sql = migrationConnection();
try {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(640120)`;
    await tx`create table if not exists public.coach_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())`;
    for (const name of (
      await readdir(new URL("../migrations/", import.meta.url))
    )
      .filter((n) => /^\d+_[a-z_]+\.sql$/.test(n))
      .sort()) {
      const content = await readFile(
        new URL(`../migrations/${name}`, import.meta.url),
        "utf8",
      );
      const checksum = createHash("sha256").update(content).digest("hex");
      const existing =
        await tx`select checksum from public.coach_migrations where name=${name}`;
      if (existing.length) {
        if (existing[0].checksum !== checksum)
          throw new Error("Applied migration was modified");
        continue;
      }
      await tx.unsafe(content);
      await tx`insert into public.coach_migrations(name,checksum) values(${name},${checksum})`;
      console.log(`Applied ${name}`);
    }
  });
} finally {
  await sql.end();
}
