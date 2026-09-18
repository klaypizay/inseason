import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { hostedRoadmapFixture } from "./support/roadmap-fixture";
import { withSession } from "../src/server/db/repository";
import { editsFor } from "../src/domain/roadmap";
import { manualWeek } from "../src/domain/week";
import { executeWeek } from "../src/server/ai/generate-week";
import { fixtureWeekProvider } from "../src/server/ai/week-provider";
it.skipIf(process.env.RUN_HOSTED_DB_TESTS !== "1")(
  "persists M4 with hosted RLS, generation, acceptance and foreign-owner denial",
  async () => {
    const a = await hostedRoadmapFixture(),
      b = await hostedRoadmapFixture();
    try {
      const review = await withSession(a.db, a.token, (r) =>
        r.roadmap().get(a.id),
      );
      const roadmap = await withSession(a.db, a.token, (r) =>
        r
          .roadmap()
          .save(a.id, editsFor(review.version.plan), randomUUID(), true),
      );
      const week = review.version.plan.weeks[0].id;
      let view = await withSession(a.db, a.token, (r) => r.week().get(week));
      const saved = await withSession(a.db, a.token, (r) =>
        r
          .week()
          .save(
            week,
            null,
            roadmap,
            manualWeek(view.context, randomUUID),
            randomUUID(),
            true,
          ),
      );
      await expect(
        withSession(b.db, b.token, (r) => r.week().get(week)),
      ).rejects.toThrow("unavailable");
      const request = randomUUID();
      const run = await withSession(a.db, a.token, (r) =>
        r
          .week()
          .begin(
            week,
            saved,
            roadmap,
            request,
            "fixture",
            fixtureWeekProvider.model,
            30,
          ),
      );
      expect(
        await withSession(a.db, a.token, (r) =>
          r
            .week()
            .begin(
              week,
              saved,
              roadmap,
              request,
              "fixture",
              fixtureWeekProvider.model,
              30,
            ),
        ),
      ).toBe(run);
      await executeWeek(a.db, a.token, run, fixtureWeekProvider);
      view = await withSession(a.db, a.token, (r) => r.week().get(week));
      expect(view.runs[0].status).toBe("succeeded");
      expect(view.currentId).toBe(saved);
      await withSession(a.db, a.token, (r) =>
        r
          .week()
          .save(
            week,
            view.reviewId,
            roadmap,
            view.version!.content,
            randomUUID(),
            true,
          ),
      );
      view = await withSession(a.db, a.token, (r) => r.week().get(week));
      expect(view.version!.status).toBe("accepted");
      expect(view.version!.content.allocations).toHaveLength(2);
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  },
  60000,
);
