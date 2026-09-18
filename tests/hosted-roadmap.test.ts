import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { hostedRoadmapFixture } from "./support/roadmap-fixture";
import { withSession } from "../src/server/db/repository";
import { calendarDefaults, editsFor } from "../src/domain/roadmap";
it.skipIf(process.env.RUN_HOSTED_DB_TESTS !== "1")(
  "accepts and shifts a hosted roadmap with immutable history and stable IDs",
  async () => {
    const f = await hostedRoadmapFixture();
    try {
      const v = await withSession(f.db, f.token, (r) => r.roadmap().get(f.id));
      expect(v.version.plan.sessions).toHaveLength(24);
      const active = await withSession(f.db, f.token, (r) =>
        r.roadmap().save(f.id, editsFor(v.version.plan), randomUUID(), true),
      );
      const a = await withSession(f.db, f.token, (r) =>
        r.roadmap().get(active),
      );
      expect(a.version.status).toBe("accepted");
      const c = calendarDefaults(
        a.version.plan,
        "2027-01-11",
        "2027-04-04",
        "shift",
        a.today,
      );
      const preview = await withSession(f.db, f.token, (r) =>
        r.roadmap().calendar(active, c, randomUUID()),
      );
      const p = await withSession(f.db, f.token, (r) =>
        r.roadmap().get(preview),
      );
      expect(p.conflicts).toEqual([]);
      const accepted = await withSession(f.db, f.token, (r) =>
        r.roadmap().save(preview, editsFor(p.version.plan), randomUUID(), true),
      );
      const final = await withSession(f.db, f.token, (r) =>
        r.roadmap().get(accepted),
      );
      expect(final.version.plan.sessions[0].date).toBe("2027-01-11");
      expect(final.version.plan.sessions[0].id).toBe(
        a.version.plan.sessions[0].id,
      );
      expect(final.history).toHaveLength(4);
    } catch (e) {
      throw new Error(
        "Hosted roadmap verification failed: " +
          ((e as { code?: string }).code ?? "assertion"),
      );
    } finally {
      await f.cleanup();
    }
  },
  60000,
);
