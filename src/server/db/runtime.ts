import "server-only";
import { db } from "./connection";
import type { Database, Query } from "./repository";
export const database: Database = {
  async transaction<T>(work: (q: Query) => Promise<T>): Promise<T> {
    return db().begin(async (sql) => {
      const roles =
        await sql`select current_user as name,rolsuper,rolbypassrls from pg_roles where rolname=current_user`;
      if (
        roles[0]?.name !== "season_coach_app" ||
        roles[0]?.rolsuper ||
        roles[0]?.rolbypassrls
      )
        throw new Error("Unsafe database role");
      const q: Query = async (query, values = []) => {
        // All SQL text is internal; values are always separate protocol parameters.
        return (await sql.unsafe(query, values as never[])) as never;
      };
      return work(q);
    }) as Promise<T>;
  },
};
