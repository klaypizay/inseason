import { z } from "zod";
import { PlanRuleError } from "./roadmap";
import type { WeekContext } from "./week";
const note = z.string().trim().min(1).max(400);
export const practiceBlockSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1).max(100),
  minutes: z.number().int().min(1).max(300),
  setup: note,
  cues: note,
  simpler: note,
  purpose: note,
  players: z.number().int().min(1).max(100),
  hoops: z.number().int().min(0).max(20),
  locked: z.boolean(),
});
export const practiceSchema = z.strictObject({
  sessionId: z.uuid(),
  title: z.string().trim().min(1).max(100),
  blocks: z.array(practiceBlockSchema).min(1).max(10),
});
export type PracticePlan = z.infer<typeof practiceSchema>;
export const practiceIntentSchema = z
  .strictObject({
    sessionId: z.uuid(),
    brief: z.string().trim().max(600),
    blockId: z.uuid().optional(),
  })
  .refine((intent) => !intent.blockId || intent.brief.length > 0, {
    message: "Describe the change you want for this drill.",
    path: ["brief"],
  });
export type PracticeIntent = z.infer<typeof practiceIntentSchema>;
export function practiceRevisionTarget(
  plans: PracticePlan[],
  intent: PracticeIntent,
) {
  if (!intent.blockId) return;
  const plan = plans.find((p) => p.sessionId === intent.sessionId);
  const block = plan?.blocks.find((b) => b.id === intent.blockId);
  if (!plan || !block)
    throw new PlanRuleError("Choose a drill from this saved practice.");
  if (block.locked)
    throw new PlanRuleError("Unlock this drill before asking AI to revise it.");
  return { plan, block };
}
export function validatePractices(
  plans: PracticePlan[],
  context: WeekContext,
  previous: PracticePlan[] = [],
) {
  if (new Set(plans.map((p) => p.sessionId)).size !== plans.length)
    throw new PlanRuleError("Keep one practice plan per session.");
  for (const plan of plans) {
    const session = context.sessions.find((s) => s.id === plan.sessionId);
    const saved = previous.find((p) => p.sessionId === plan.sessionId);
    // JSONB reorders object keys. Compare schema-normalized values so storage
    // cannot make an unchanged locked block look like a content edit.
    const old = saved ? practiceSchema.parse(saved) : undefined;
    if (!session)
      throw new PlanRuleError("Choose a practice from this roadmap week.");
    if (session.status === "completed" || session.date < context.today) {
      if (JSON.stringify(plan) !== JSON.stringify(old))
        throw new PlanRuleError(
          "Past and completed practice plans stay unchanged.",
        );
      continue;
    }
    if (plan.blocks.reduce((n, b) => n + b.minutes, 0) !== session.minutes)
      throw new PlanRuleError(
        `Practice blocks must total ${session.minutes} minutes, including breaks and transitions.`,
      );
    if (new Set(plan.blocks.map((b) => b.id)).size !== plan.blocks.length)
      throw new PlanRuleError("Practice blocks need unique identifiers.");
    const { playerCount, hoops } = context.coach.season;
    if (!playerCount || hoops === null)
      throw new PlanRuleError(
        "Confirm player count and hoops in Team setup before planning practice.",
      );
    if (plan.blocks.some((b) => b.players > playerCount || b.hoops > hoops))
      throw new PlanRuleError(
        "A practice block needs more players or hoops than your team setup provides.",
      );
    for (const fixed of old?.blocks.filter((b) => b.locked) ?? []) {
      const next = plan.blocks.find((b) => b.id === fixed.id);
      if (
        !next ||
        plan.blocks.indexOf(next) !== old!.blocks.indexOf(fixed) ||
        JSON.stringify({ ...fixed, locked: false }) !==
          JSON.stringify({ ...next, locked: false })
      )
        throw new PlanRuleError("Unlock and save a block before changing it.");
    }
  }
  for (const old of previous) {
    const session = context.sessions.find((s) => s.id === old.sessionId);
    if (
      !plans.some((p) => p.sessionId === old.sessionId) &&
      session &&
      (session.status === "completed" ||
        session.date < context.today ||
        old.blocks.some((b) => b.locked))
    )
      throw new PlanRuleError(
        "Saved protected practice content cannot be removed.",
      );
  }
}
