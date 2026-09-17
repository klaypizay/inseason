import postgres from "postgres";
export function migrationConnection() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("Set MIGRATION_DATABASE_URL in .env.local");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(url).hostname,
  );
  if (process.env.DATABASE_SSL === "false" && !local)
    throw new Error("TLS required");
  return postgres(url, {
    ssl: local && process.env.DATABASE_SSL === "false" ? false : "verify-full",
    max: 1,
  });
}
