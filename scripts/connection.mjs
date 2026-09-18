import postgres from "postgres";
import { readFileSync } from "node:fs";
export function migrationConnection() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("Set MIGRATION_DATABASE_URL in .env.local");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(url).hostname,
  );
  if (process.env.DATABASE_SSL === "false" && !local)
    throw new Error("TLS required");
  return postgres(url, {
    ssl:
      local && process.env.DATABASE_SSL === "false"
        ? false
        : process.env.DATABASE_CA_CERT_FILE
          ? {
              ca: readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8"),
              rejectUnauthorized: true,
            }
          : "verify-full",
    max: 1,
  });
}
