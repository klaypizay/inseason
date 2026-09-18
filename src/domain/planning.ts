import { z } from "zod";
import { day, reportFields, type Setup } from "./onboarding";
export const generationAction = z.enum(["assessSeason", "draftRoadmap"]);
export type GenerationAction = z.infer<typeof generationAction>;
const text = z.string().trim().min(1).max(600);
const evidence = z.array(z.uuid()).max(12);
const topic = z.enum([...Object.keys(reportFields), "participation"]);
const claim = z.union([
  z.strictObject({
    text,
    topic,
    confidence: z.literal("Likely"),
    evidenceIds: evidence.min(1),
  }),
  z.strictObject({
    text,
    topic,
    confidence: z.literal("Unknown"),
    evidenceIds: evidence.max(0),
  }),
]);
const goal = z.strictObject({
  description: text,
  successCriteria: text,
  evidenceIds: evidence,
});
export const assessmentSchema = z.strictObject({
  strengths: z.array(claim).max(6),
  gaps: z.array(claim).max(6),
  questions: z.array(text).max(6),
  assumptions: z.array(text).max(6),
  goals: z.array(goal).min(1).max(3),
});
export const roadmapSchema = z.strictObject({
  rationale: text,
  assumptions: z.array(text).max(6),
  phases: z
    .array(
      z.strictObject({
        phaseId: z.uuid(),
        rationale: text,
        goals: z.array(goal).min(1).max(3),
      }),
    )
    .min(1)
    .max(12),
  weeks: z
    .array(
      z.strictObject({
        sequence: z.number().int().min(1).max(120),
        emphasis: text,
        checkpoint: text,
        evidenceIds: evidence,
      }),
    )
    .min(1)
    .max(120),
});
export type Assessment = z.infer<typeof assessmentSchema>;
export type Roadmap = z.infer<typeof roadmapSchema>;
export type Source = {
  id: string;
  field: string;
  value: string | null;
  confidence: "Known" | "Unknown";
  reportedAt: string;
};
export type CalendarWeek = {
  sequence: number;
  phaseId: string;
  start: string;
  end: string;
};
export type PlanningContext = {
  seasonId: string;
  contextVersion: number;
  sources: Source[];
  season: {
    start: string;
    end: string;
    timezone: string;
    weekStart: number;
    playerCount: number;
    hoops: number;
    court: string;
  };
  phases: { id: string; type: string; start: string; end: string }[];
  weeks: CalendarWeek[];
  availability: Setup["availability"];
  events: Omit<Setup["events"][number], "title">[];
  participation: {
    available: number;
    limited: number;
    unavailable: number;
    unknown: number;
  };
};
const dateString = (n: number) =>
  new Date(n * 86400000).toISOString().slice(0, 10);
export function calendarWeeks(
  phases: PlanningContext["phases"],
  weekStart: number,
): CalendarWeek[] {
  const weeks: CalendarWeek[] = [];
  for (const phase of [...phases].sort((a, b) =>
    a.start.localeCompare(b.start),
  )) {
    let start = day(phase.start);
    const end = day(phase.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
      throw new Error("Invalid phase dates");
    while (start <= end) {
      const weekday = new Date(start * 86400000).getUTCDay();
      const length = 7 - ((weekday - weekStart + 7) % 7);
      const last = Math.min(end, start + length - 1);
      weeks.push({
        sequence: weeks.length + 1,
        phaseId: phase.id,
        start: dateString(start),
        end: dateString(last),
      });
      start = last + 1;
      if (weeks.length > 120)
        throw new Error("Season is too long for one roadmap.");
    }
  }
  return weeks;
}
export class InvalidGeneration extends Error {
  constructor(
    public code: "invalid_output" | "invalid_evidence" | "invalid_calendar",
  ) {
    super(code);
  }
}
export function validateGenerated(
  action: GenerationAction,
  value: unknown,
  context: PlanningContext,
): Assessment | Roadmap {
  const parsed = (
    action === "assessSeason" ? assessmentSchema : roadmapSchema
  ).safeParse(value);
  if (!parsed.success) throw new InvalidGeneration("invalid_output");
  const allowed = new Set(
    context.sources.filter((s) => s.value !== null).map((s) => s.id),
  );
  const check = (ids: string[], required = false) => {
    if (
      (required && !ids.length) ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !allowed.has(id))
    )
      throw new InvalidGeneration("invalid_evidence");
  };
  if (action === "assessSeason") {
    const result = parsed.data as Assessment;
    for (const c of [...result.strengths, ...result.gaps]) {
      check(c.evidenceIds, c.confidence === "Likely");
      if (
        c.confidence === "Likely" &&
        !context.sources.some(
          (s) =>
            s.field === c.topic &&
            s.value !== null &&
            c.evidenceIds.includes(s.id),
        )
      )
        throw new InvalidGeneration("invalid_evidence");
    }
    for (const g of result.goals) check(g.evidenceIds);
  } else {
    const result = parsed.data as Roadmap;
    if (
      result.phases.length !== context.phases.length ||
      new Set(result.phases.map((p) => p.phaseId)).size !==
        context.phases.length ||
      result.phases.some(
        (p) => !context.phases.some((c) => c.id === p.phaseId),
      ) ||
      result.weeks.length !== context.weeks.length ||
      new Set(result.weeks.map((w) => w.sequence)).size !==
        context.weeks.length ||
      result.weeks.some(
        (w) => !context.weeks.some((c) => c.sequence === w.sequence),
      )
    )
      throw new InvalidGeneration("invalid_calendar");
    for (const p of result.phases)
      for (const g of p.goals) check(g.evidenceIds);
    for (const w of result.weeks) check(w.evidenceIds);
  }
  return parsed.data;
}
export const generationRequest = z.strictObject({
  teamId: z.uuid(),
  seasonId: z.uuid(),
  action: generationAction,
  idempotencyKey: z.uuid(),
});
export type GenerationRequest = z.infer<typeof generationRequest>;
export type GenerationView = {
  id: string;
  seasonId: string;
  action: GenerationAction;
  status: string;
  errorCode: string | null;
  attempts: number;
  contextVersion: number;
  currentContextVersion: number;
  createdAt: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  draft: {
    schemaVersion: 1;
    status: "draft";
    action: GenerationAction;
    context: PlanningContext;
    content: Assessment | Roadmap;
  } | null;
};
