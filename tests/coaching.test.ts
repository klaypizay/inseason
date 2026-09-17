import { it, expect } from "vitest";
import { actions, fixtureCoach } from "../src/server/ai/coaching";
import { fixtureIds } from "../scripts/fixtures.mjs";
const f = fixtureIds[0];
const request = {
  context: {
    programId: f.program,
    seasonId: f.season,
    contextVersion: 1,
    sourceIds: [],
  },
  schemaVersion: 1 as const,
  idempotencyKey: f.run,
};
it("all six fixture actions are deterministic drafts without invented evidence", async () => {
  for (const action of actions) {
    const before = JSON.stringify(request);
    const result = await fixtureCoach[action](request);
    expect(result).toEqual(await fixtureCoach[action](request));
    expect(result.action).toBe(action);
    expect(result.status).toBe("draft");
    expect(result.content.confidence).toBe("Unknown");
    expect(result.content.evidenceIds).toEqual([]);
    expect(JSON.stringify(request)).toBe(before);
  }
});
it("rejects malformed context and unsupported schema versions", async () => {
  await expect(
    fixtureCoach.assessSeason({ ...request, schemaVersion: 2 as 1 }),
  ).rejects.toThrow();
  await expect(
    fixtureCoach.assessSeason({
      ...request,
      context: { ...request.context, programId: "not-an-id" },
    }),
  ).rejects.toThrow();
});
