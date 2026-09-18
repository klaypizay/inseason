import { z } from "zod";
import {
  available,
  blocked,
  PlanRuleError,
  type Plan,
  type Session,
} from "./roadmap";
import type { PlanningContext } from "./planning";
const text = z.string().trim().min(1).max(600);
export const objectiveSchema = z.strictObject({
  id: z.uuid(),
  goalId: z.uuid(),
  description: text,
  successCriteria: text,
  locked: z.boolean(),
});
export const weekContentSchema = z.strictObject({
  rationale: text,
  assumptions: z.array(text).max(6),
  objectives: z.array(objectiveSchema).min(1).max(3),
  allocations: z
    .array(
      z.strictObject({
        sessionId: z.uuid(),
        objectiveIds: z.array(z.uuid()).max(3),
        manual: z.boolean().default(false),
      }),
    )
    .max(32),
});
export type WeekContent = z.infer<typeof weekContentSchema>;
export type WeekContext = {
  roadmapId: string;
  contextVersion: number;
  timezone: string;
  today: string;
  week: Plan["weeks"][number];
  goals: Plan["goals"];
  sessions: Session[];
  events: Omit<Plan["events"][number], "title">[];
  coach: Pick<PlanningContext, "sources" | "participation"> & {
    season: Omit<PlanningContext["season"], "playerCount" | "hoops"> & {
      playerCount: number | null;
      hoops: number | null;
    };
  };
};
export type WeekVersion = {
  id: string;
  number: number;
  status: "draft" | "accepted";
  roadmapId: string;
  contextVersion: number;
  context: WeekContext;
  content: WeekContent;
  created: string;
};
export type WeekView = {
  context: WeekContext;
  version: WeekVersion | null;
  currentId: string | null;
  reviewId: string | null;
  editable: boolean;
  stale: boolean;
  history: { id: string; number: number; status: string }[];
  runs: {
    id: string;
    status: string;
    error: string | null;
    attempts: number;
    provider: string;
  }[];
};
export function eligibleSessions(plan: Plan, weekId: string) {
  return plan.sessions.filter(
    (s) =>
      s.weekId === weekId &&
      s.status !== "canceled" &&
      (s.status === "completed" ||
        ((!!s.override || available(s, plan.availability)) &&
          !plan.events.some((e) => blocked(s, e)))),
  );
}
export function manualWeek(
  context: WeekContext,
  uuid: () => string,
): WeekContent {
  const objective = {
    id: uuid(),
    goalId:
      context.goals.find((g) => g.phaseId === context.week.phaseId)?.id ??
      context.goals[0].id,
    description: context.week.emphasis,
    successCriteria: context.week.checkpoint,
    locked: false,
  };
  return {
    rationale:
      "Start with the accepted weekly emphasis, then adjust what you will teach and observe.",
    assumptions: [
      "Teaching suggestions are not observations or evidence of player ability.",
    ],
    objectives: [objective],
    allocations: context.sessions.map((s) => ({
      sessionId: s.id,
      manual: false,
      objectiveIds:
        s.status === "scheduled" && s.date >= context.today
          ? [objective.id]
          : [],
    })),
  };
}
export function protectedObjectiveIds(
  context: WeekContext,
  previous: WeekContent,
) {
  const fixed = new Set(
    context.sessions
      .filter((s) => s.status === "completed" || s.date < context.today)
      .map((s) => s.id),
  );
  return new Set(
    previous.allocations
      .filter((a) => fixed.has(a.sessionId))
      .flatMap((a) => a.objectiveIds),
  );
}
export function validateWeek(
  input: unknown,
  context: WeekContext,
  previous?: WeekContent,
): WeekContent {
  const next = weekContentSchema.parse(input);
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (
    !unique(next.objectives.map((o) => o.id)) ||
    !unique(next.allocations.map((a) => a.sessionId)) ||
    next.objectives.some(
      (o) => !context.goals.some((g) => g.id === o.goalId),
    ) ||
    next.allocations.length !== context.sessions.length ||
    next.allocations.some(
      (a) =>
        !context.sessions.some((s) => s.id === a.sessionId) ||
        !unique(a.objectiveIds) ||
        a.objectiveIds.some((id) => !next.objectives.some((o) => o.id === id)),
    )
  )
    throw new PlanRuleError(
      "Use goals and practice slots from this accepted roadmap week.",
    );
  if (previous) {
    const protectedIds = protectedObjectiveIds(context, previous);
    for (const old of previous.objectives) {
      const o = next.objectives.find((o) => o.id === old.id);
      if (
        (old.locked || protectedIds.has(old.id)) &&
        (!o ||
          o.goalId !== old.goalId ||
          o.description !== old.description ||
          o.successCriteria !== old.successCriteria)
      )
        throw new PlanRuleError(
          "Locked objectives and objectives used by past or completed sessions cannot change. Save an unlock first for future work.",
        );
    }
    for (const s of context.sessions.filter(
      (s) => s.status === "completed" || s.date < context.today,
    )) {
      const before =
        previous.allocations.find((a) => a.sessionId === s.id)?.objectiveIds ??
        [];
      const after = next.allocations.find(
        (a) => a.sessionId === s.id,
      )!.objectiveIds;
      if (
        JSON.stringify([...before].sort()) !== JSON.stringify([...after].sort())
      )
        throw new PlanRuleError(
          "Past and completed practice assignments stay unchanged.",
        );
    }
  }
  return next;
}
export function refreshWeek(
  previous: WeekContent,
  context: WeekContext,
): WeekContent {
  // Explicit refresh retains teaching content while reconciling only available calendar slots.
  const fixed = protectedObjectiveIds(context, previous);
  if (
    previous.objectives.some(
      (o) =>
        !context.goals.some((g) => g.id === o.goalId) &&
        (o.locked || fixed.has(o.id)),
    )
  )
    throw new PlanRuleError(
      "A protected objective references a removed goal. Restore that goal in roadmap review first.",
    );
  const next = {
    ...previous,
    objectives: previous.objectives.map((o) => ({
      ...o,
      goalId: context.goals.some((g) => g.id === o.goalId)
        ? o.goalId
        : context.goals[0].id,
    })),
    allocations: context.sessions.map(
      (s) =>
        previous.allocations.find((a) => a.sessionId === s.id) ?? {
          sessionId: s.id,
          manual: false,
          objectiveIds: [],
        },
    ),
  };
  return validateWeek(next, context, previous);
}
export const generatedWeekSchema = z.strictObject({
  rationale: text,
  assumptions: z.array(text).max(6),
  objectives: z
    .array(
      z.strictObject({
        slot: z.number().int().min(1).max(3),
        goalId: z.uuid(),
        description: text,
        successCriteria: text,
      }),
    )
    .min(1)
    .max(3),
  allocations: z
    .array(
      z.strictObject({
        sessionId: z.uuid(),
        objectiveSlots: z.array(z.number().int().min(1).max(3)).max(3),
      }),
    )
    .max(32),
});
export type WeekGenerationContext = {
  context: WeekContext;
  previous: WeekContent;
};
export function generatedWeek(
  value: unknown,
  input: WeekGenerationContext,
  uuid: () => string,
) {
  const output = generatedWeekSchema.parse(value),
    { context, previous } = input;
  if (
    new Set(output.objectives.map((o) => o.slot)).size !==
      output.objectives.length ||
    output.objectives.some((o) => !context.goals.some((g) => g.id === o.goalId))
  )
    throw new PlanRuleError(
      "The generated objectives referenced an unavailable goal.",
    );
  const protectedIds = protectedObjectiveIds(context, previous);
  const fixed = previous.objectives
    .map((o, i) => ({ ...o, slot: i + 1 }))
    .filter((o) => o.locked || protectedIds.has(o.id));
  const slots = [
    ...new Set([
      ...output.objectives.map((o) => o.slot),
      ...fixed.map((o) => o.slot),
      ...previous.objectives.flatMap((o, i) =>
        previous.allocations.some(
          (a) => a.manual && a.objectiveIds.includes(o.id),
        )
          ? [i + 1]
          : [],
      ),
    ]),
  ].sort();
  const objectives = slots.map((slot) => {
    const keep = fixed.find((o) => o.slot === slot);
    if (keep) {
      const { slot: ignored, ...o } = keep;
      void ignored;
      return o;
    }
    const o = output.objectives.find((o) => o.slot === slot);
    if (!o) return previous.objectives[slot - 1];
    return {
      id: previous.objectives[slot - 1]?.id ?? uuid(),
      goalId: o.goalId,
      description: o.description,
      successCriteria: o.successCriteria,
      locked: false,
    };
  });
  if (
    output.allocations.some(
      (a) =>
        a.objectiveSlots.some((slot) => !slots.includes(slot)) ||
        new Set(a.objectiveSlots).size !== a.objectiveSlots.length,
    )
  )
    throw new PlanRuleError(
      "The generated allocation referenced an unavailable objective.",
    );
  const allocations = output.allocations.map((a) => {
    const override = previous.allocations.find(
      (x) => x.sessionId === a.sessionId && x.manual,
    );
    if (override) return override;
    const s = context.sessions.find((s) => s.id === a.sessionId);
    if (s && (s.status === "completed" || s.date < context.today))
      return (
        previous.allocations.find((x) => x.sessionId === s.id) ?? {
          sessionId: s.id,
          manual: false,
          objectiveIds: [],
        }
      );
    return {
      sessionId: a.sessionId,
      manual: false,
      objectiveIds: a.objectiveSlots.map(
        (slot) => objectives[slots.indexOf(slot)].id,
      ),
    };
  });
  return validateWeek(
    {
      rationale: output.rationale,
      assumptions: output.assumptions,
      objectives,
      allocations,
    },
    context,
    previous,
  );
}
