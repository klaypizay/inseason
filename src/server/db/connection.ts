import "server-only";
import postgres from "postgres";
import { readFileSync } from "node:fs";
let connection: ReturnType<typeof postgres> | undefined;
export function db() {
  if (!connection) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Database is not configured");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(url).hostname,
    );
    if (process.env.DATABASE_SSL === "false" && !local)
      throw new Error("TLS required");
    connection = postgres(url, {
      ssl:
        local && process.env.DATABASE_SSL === "false"
          ? false
          : process.env.DATABASE_CA_CERT_FILE
            ? {
                ca: readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8"),
                rejectUnauthorized: true,
              }
            : "verify-full",
      max: 5,
      prepare: false,
      connect_timeout: 10,
    });
  }
  return connection;
}
