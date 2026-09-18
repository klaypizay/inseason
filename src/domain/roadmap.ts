import { z } from "zod";
import { day, availabilitySchema, type Setup } from "./onboarding";
import type { GenerationView, Roadmap } from "./planning";
const id = z.uuid();
const date = z.iso.date().refine((v) => v >= "2000-01-01" && v <= "2100-12-31");
const text = z.string().trim().min(1).max(600);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const goal = z.strictObject({
  id,
  phaseId: id,
  description: text,
  successCriteria: text,
  locked: z.boolean(),
  contentVersion: z.number().int().positive(),
});
const week = z.strictObject({
  id,
  phaseId: id,
  start: date,
  end: date,
  emphasis: text,
  checkpoint: text,
  locked: z.boolean(),
  contentVersion: z.number().int().positive(),
});
const session = z.strictObject({
  id,
  weekId: id,
  date,
  time,
  minutes: z.number().int().min(1).max(300),
  status: z.enum(["scheduled", "completed", "canceled"]),
  override: z.string().max(200),
  contentVersion: z.number().int().positive(),
});
const event = z.strictObject({
  id,
  type: z.enum(["game", "tournament", "unavailable"]),
  title: z.string().max(100),
  start: date,
  end: date,
  time: time.or(z.literal("")),
  endTime: time.or(z.literal("")),
  blocksPractice: z.boolean(),
});
export const planSchema = z.strictObject({
  schemaVersion: z.literal(1),
  start: date,
  end: date,
  timezone: z.string().max(80),
  weekStart: z.number().int().min(0).max(6),
  rationale: text,
  assumptions: z.array(text).max(6),
  phases: z
    .array(
      z.strictObject({
        id,
        type: z.enum(["offseason", "preseason", "in_season", "postseason"]),
        start: date,
        end: date,
        rationale: text,
      }),
    )
    .min(1)
    .max(12),
  goals: z.array(goal).min(1).max(36),
  weeks: z.array(week).min(1).max(120),
  sessions: z.array(session).max(1500),
  events: z.array(event).max(30),
  availability: z.array(availabilitySchema).max(14),
});
export type Plan = z.infer<typeof planSchema>;
export type Session = Plan["sessions"][number];
export class PlanRuleError extends Error {}
export const shiftDay = (value: string, delta: number) =>
  new Date((day(value) + delta) * 86400000).toISOString().slice(0, 10);
export function localToday(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function blocked(
  s: Pick<Session, "date" | "time" | "minutes">,
  e: Plan["events"][number],
) {
  if (!e.blocksPractice || s.date < e.start || s.date > e.end) return false;
  if (!e.time || !e.endTime || e.start !== e.end) return true;
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return (
    mins(s.time) < mins(e.endTime) && mins(s.time) + s.minutes > mins(e.time)
  );
}
export function available(s: Session, rules: Setup["availability"]) {
  return rules.some(
    (r) =>
      r.weekday === new Date(s.date + "T00:00:00Z").getUTCDay() &&
      r.time === s.time &&
      r.minutes >= s.minutes &&
      (!r.start || s.date >= r.start) &&
      (!r.end || s.date <= r.end),
  );
}
export function fromGeneration(
  view: GenerationView,
  setup: Setup,
  uuid: () => string,
): Plan {
  if (view.draft?.action !== "draftRoadmap")
    throw new PlanRuleError("Choose a saved roadmap draft.");
  const { context } = view.draft,
    content = view.draft.content as Roadmap;
  const plan: Plan = {
    schemaVersion: 1,
    start: context.season.start,
    end: context.season.end,
    timezone: context.season.timezone,
    weekStart: context.season.weekStart,
    rationale: content.rationale,
    assumptions: content.assumptions,
    phases: context.phases.map((p) => ({
      ...p,
      type: p.type as Plan["phases"][number]["type"],
      rationale: content.phases.find((x) => x.phaseId === p.id)!.rationale,
    })),
    goals: content.phases.flatMap((p) =>
      p.goals.map((g) => ({
        id: uuid(),
        phaseId: p.phaseId,
        description: g.description,
        successCriteria: g.successCriteria,
        locked: false,
        contentVersion: 1,
      })),
    ),
    weeks: context.weeks.map((w) => {
      const c = content.weeks.find((x) => x.sequence === w.sequence)!;
      return {
        id: uuid(),
        phaseId: w.phaseId,
        start: w.start,
        end: w.end,
        emphasis: c.emphasis,
        checkpoint: c.checkpoint,
        locked: false,
        contentVersion: 1,
      };
    }),
    sessions: [],
    availability: setup.availability,
    events: setup.events.map((e) => ({ ...e, id: e.id! })),
  };
  const seen = new Set<string>();
  for (let d = plan.start; d <= plan.end; d = shiftDay(d, 1))
    for (const r of setup.availability) {
      if (
        new Date(d + "T00:00:00Z").getUTCDay() !== r.weekday ||
        (r.start && d < r.start) ||
        (r.end && d > r.end)
      )
        continue;
      const s: Session = {
        id: uuid(),
        weekId: plan.weeks.find((w) => d >= w.start && d <= w.end)!.id,
        date: d,
        time: r.time,
        minutes: r.minutes,
        status: "scheduled",
        override: "",
        contentVersion: 1,
      };
      const key = d + " " + r.time;
      if (!seen.has(key) && !plan.events.some((e) => blocked(s, e))) {
        plan.sessions.push(s);
        seen.add(key);
      }
    }
  return planSchema.parse(plan);
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function conflicts(plan: Plan, rules: Setup["availability"]): string[] {
  const out: string[] = [];
  if (plan.end < plan.start || day(plan.end) - day(plan.start) > 731)
    out.push("Use an ordered season range of two years or less.");
  for (const rows of [
    plan.phases,
    plan.goals,
    plan.weeks,
    plan.sessions,
    plan.events,
  ])
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      out.push("Duplicate IDs are not allowed.");
  const phases = [...plan.phases].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  if (
    phases[0]?.start !== plan.start ||
    phases.at(-1)?.end !== plan.end ||
    phases.some(
      (p, i) =>
        p.end < p.start ||
        (i > 0 && p.start !== shiftDay(phases[i - 1].end, 1)),
    )
  )
    out.push(
      "Phase dates must cover the season without gaps or overlap. Adjust phase dates below.",
    );
  for (const p of phases) {
    const weeks = plan.weeks
      .filter((w) => w.phaseId === p.id)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (
      weeks[0]?.start !== p.start ||
      weeks.at(-1)?.end !== p.end ||
      weeks.some(
        (w, i) =>
          w.end < w.start ||
          day(w.end) - day(w.start) > 6 ||
          (i > 0 && w.start !== shiftDay(weeks[i - 1].end, 1)),
      )
    )
      out.push(
        `Weeks in ${p.type.replaceAll("_", " ")} must cover ${p.start} to ${p.end} once, in spans of at most seven days. Reassign or remove affected weeks.`,
      );
  }
  for (const w of plan.weeks)
    if (
      !phases.some(
        (p) => p.id === w.phaseId && w.start >= p.start && w.end <= p.end,
      )
    )
      out.push(
        `Teaching week ${w.start}: reassign its dates or explicitly remove it.`,
      );
  for (const g of plan.goals)
    if (!phases.some((p) => p.id === g.phaseId))
      out.push("A goal references an unavailable phase.");
  for (const r of plan.availability)
    if (
      (r.start && r.start < plan.start) ||
      (r.end && r.end > plan.end) ||
      (r.start && r.end && r.start > r.end)
    )
      out.push(
        "Regular availability dates must fit the season; adjust the effective range in calendar review.",
      );
  for (const e of plan.events)
    if (
      e.start < plan.start ||
      e.end > plan.end ||
      e.end < e.start ||
      (e.start === e.end && e.time && e.endTime && e.endTime <= e.time)
    )
      out.push(`Event ${e.title || e.type}: check its dates and times.`);
  const slots = plan.sessions.filter((s) => s.status !== "canceled");
  for (const s of slots) {
    if (s.date < plan.start || s.date > plan.end)
      out.push(
        `Session ${s.date} ${s.time}: outside the season; reschedule or cancel it. Historical sessions must stay within the season.`,
      );
    if (
      !plan.weeks.some(
        (w) => w.id === s.weekId && s.date >= w.start && s.date <= w.end,
      )
    )
      out.push(`Session ${s.date} ${s.time}: no matching teaching week.`);
    if (
      Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)) + s.minutes >
      1440
    )
      out.push(`Session ${s.date}: must finish on the same day.`);
    if (s.status === "scheduled") {
      for (const e of plan.events)
        if (blocked(s, e))
          out.push(
            `Session ${s.date} ${s.time} conflicts with ${e.title || e.type}. Reschedule or cancel the session, or individually edit the event.`,
          );
      if (!available(s, rules) && !s.override.trim())
        out.push(
          `Session ${s.date} ${s.time}: outside regular availability; reschedule or provide a coach override reason.`,
        );
    }
  }
  const mins = (s: Session) =>
    Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3));
  for (let i = 0; i < slots.length; i++)
    for (let j = i + 1; j < slots.length; j++)
      if (
        slots[i].date === slots[j].date &&
        mins(slots[i]) < mins(slots[j]) + slots[j].minutes &&
        mins(slots[j]) < mins(slots[i]) + slots[i].minutes
      )
        out.push(
          `Sessions overlap on ${slots[i].date}. Reschedule or cancel one.`,
        );
  return [...new Set(out)];
}
export function protect(previous: Plan, next: Plan, today: string) {
  if (
    previous.timezone !== next.timezone ||
    previous.weekStart !== next.weekStart
  )
    throw new PlanRuleError(
      "Timezone and week start cannot change in roadmap review.",
    );
  for (const old of previous.goals) {
    const n = next.goals.find((x) => x.id === old.id);
    if (
      old.locked &&
      (!n ||
        n.description !== old.description ||
        n.successCriteria !== old.successCriteria ||
        n.phaseId !== old.phaseId)
    )
      throw new PlanRuleError(
        "Save and accept an unlock before changing or removing a locked goal.",
      );
  }
  for (const old of previous.weeks) {
    const n = next.weeks.find((x) => x.id === old.id);
    if (old.start < today && !same(old, n))
      throw new PlanRuleError(
        "Past and started teaching weeks must remain unchanged.",
      );
    if (
      old.locked &&
      (!n || n.emphasis !== old.emphasis || n.checkpoint !== old.checkpoint)
    )
      throw new PlanRuleError(
        "Save and accept an unlock before changing or removing a locked week.",
      );
  }
  for (const old of previous.sessions) {
    const n = next.sessions.find((x) => x.id === old.id);
    if (!n)
      throw new PlanRuleError(
        "Keep session history; cancel a future session instead of removing it.",
      );
    if ((old.date < today || old.status !== "scheduled") && !same(old, n))
      throw new PlanRuleError(
        "Past, completed and canceled sessions must remain unchanged.",
      );
    if (n.status === "completed" && old.status !== "completed")
      throw new PlanRuleError(
        "Session completion belongs to the check-in flow.",
      );
  }
}
export const editSchema = z.strictObject({
  rationale: text,
  assumptions: z.array(text).max(6),
  phases: z.array(z.strictObject({ id, rationale: text })).max(12),
  goals: z
    .array(
      z.strictObject({
        id,
        description: text,
        successCriteria: text,
        locked: z.boolean(),
      }),
    )
    .max(36),
  weeks: z
    .array(
      z.strictObject({
        id,
        emphasis: text,
        checkpoint: text,
        locked: z.boolean(),
      }),
    )
    .max(120),
});
export type PlanEdits = z.infer<typeof editSchema>;
export function editsFor(p: Plan): PlanEdits {
  return {
    rationale: p.rationale,
    assumptions: p.assumptions,
    phases: p.phases.map(({ id, rationale }) => ({ id, rationale })),
    goals: p.goals.map(({ id, description, successCriteria, locked }) => ({
      id,
      description,
      successCriteria,
      locked,
    })),
    weeks: p.weeks.map(({ id, emphasis, checkpoint, locked }) => ({
      id,
      emphasis,
      checkpoint,
      locked,
    })),
  };
}
export function applyEdits(p: Plan, input: unknown, today: string): Plan {
  const e = editSchema.parse(input),
    next = structuredClone(p);
  next.rationale = e.rationale;
  next.assumptions = e.assumptions;
  for (const key of ["phases", "goals", "weeks"] as const) {
    if (
      e[key].length !== p[key].length ||
      new Set(e[key].map((x) => x.id)).size !== p[key].length ||
      e[key].some((x) => !p[key].some((y) => y.id === x.id))
    )
      throw new PlanRuleError("The edited items do not match this version.");
  }
  next.phases = next.phases.map((p) => ({
    ...p,
    ...e.phases.find((x) => x.id === p.id)!,
  }));
  next.goals = next.goals.map((g) => {
    const x = e.goals.find((x) => x.id === g.id)!;
    return {
      ...g,
      ...x,
      contentVersion:
        g.contentVersion +
        (g.description !== x.description ||
        g.successCriteria !== x.successCriteria
          ? 1
          : 0),
    };
  });
  next.weeks = next.weeks.map((w) => {
    const x = e.weeks.find((x) => x.id === w.id)!;
    return {
      ...w,
      ...x,
      contentVersion:
        w.contentVersion +
        (w.emphasis !== x.emphasis || w.checkpoint !== x.checkpoint ? 1 : 0),
    };
  });
  protect(p, next, today);
  return planSchema.parse(next);
}
export const calendarSchema = z.strictObject({
  start: date,
  end: date,
  mode: z.enum(["shift", "keep"]),
  phases: z.array(z.strictObject({ id, start: date, end: date })).max(12),
  weeks: z
    .array(z.strictObject({ id, start: date, end: date, remove: z.boolean() }))
    .max(120),
  sessions: z
    .array(
      z.strictObject({
        id,
        date,
        time,
        cancel: z.boolean(),
        override: z.string().max(200),
      }),
    )
    .max(1500),
  events: z.array(event).max(30),
  availability: z.array(availabilitySchema).max(14),
});
export type CalendarChange = z.infer<typeof calendarSchema>;
export function calendarDefaults(
  p: Plan,
  start: string,
  end: string,
  mode: "shift" | "keep",
  today: string,
): CalendarChange {
  const delta = mode === "shift" ? day(start) - day(p.start) : 0;
  return {
    start,
    end,
    mode,
    phases: p.phases.map((x, i) => ({
      id: x.id,
      start: i === 0 ? start : shiftDay(x.start, x.start >= today ? delta : 0),
      end:
        i === p.phases.length - 1
          ? end
          : shiftDay(x.end, x.start >= today ? delta : 0),
    })),
    weeks: p.weeks.map((w) => ({
      id: w.id,
      start: shiftDay(w.start, w.start >= today ? delta : 0),
      end: shiftDay(w.end, w.start >= today ? delta : 0),
      remove: false,
    })),
    sessions: p.sessions.map((s) => ({
      id: s.id,
      date: shiftDay(
        s.date,
        s.date >= today && s.status === "scheduled" ? delta : 0,
      ),
      time: s.time,
      cancel: s.status === "canceled",
      override: s.override,
    })),
    availability: p.availability.map((r) => ({
      ...r,
      start: r.start ? shiftDay(r.start, delta) : null,
      end: r.end ? shiftDay(r.end, delta) : null,
    })),
    events: structuredClone(p.events),
  };
}
export function applyCalendar(
  p: Plan,
  input: unknown,
  today: string,
  uuid: () => string,
): Plan {
  const c = calendarSchema.parse(input),
    next = structuredClone(p);
  next.start = c.start;
  next.end = c.end;
  for (const key of ["phases", "weeks", "sessions"] as const)
    if (
      c[key].length !== p[key].length ||
      new Set(c[key].map((x) => x.id)).size !== p[key].length ||
      c[key].some((x) => !p[key].some((y) => y.id === x.id))
    )
      throw new PlanRuleError("Calendar items must match this version.");
  if (
    c.events.some((e) => !p.events.some((x) => x.id === e.id)) &&
    c.events.length > 30
  )
    throw new PlanRuleError("Too many calendar events.");
  next.phases = next.phases.map((x) => ({
    ...x,
    ...c.phases.find((y) => y.id === x.id)!,
  }));
  next.weeks = next.weeks.flatMap((w) => {
    const x = c.weeks.find((x) => x.id === w.id)!;
    return x.remove ? [] : [{ ...w, start: x.start, end: x.end }];
  });
  // Fill uncovered dates with explicit, empty teaching weeks; never discard existing content.
  for (const phase of next.phases) {
    if (phase.end < phase.start || day(phase.end) - day(phase.start) > 731)
      continue;
    let d = phase.start;
    while (d <= phase.end) {
      const occupied = next.weeks.find(
        (w) => w.phaseId === phase.id && d >= w.start && d <= w.end,
      );
      if (occupied) {
        d = shiftDay(occupied.end, 1);
        continue;
      }
      const nextStart = next.weeks
        .filter((w) => w.phaseId === phase.id && w.start > d)
        .map((w) => w.start)
        .sort()[0];
      const weekday = new Date(d + "T00:00:00Z").getUTCDay();
      const end = [
        phase.end,
        shiftDay(d, 6 - ((weekday - next.weekStart + 7) % 7)),
        ...(nextStart ? [shiftDay(nextStart, -1)] : []),
      ].sort()[0];
      next.weeks.push({
        id: uuid(),
        phaseId: phase.id,
        start: d,
        end,
        emphasis: "Coach to choose this week's emphasis.",
        checkpoint: "Coach to choose an observable checkpoint.",
        locked: false,
        contentVersion: 1,
      });
      d = shiftDay(end, 1);
    }
  }
  next.weeks.sort((a, b) => a.start.localeCompare(b.start));
  next.sessions = next.sessions.map((s) => {
    const x = c.sessions.find((x) => x.id === s.id)!;
    const w = next.weeks.find((w) => x.date >= w.start && x.date <= w.end);
    return {
      ...s,
      date: x.date,
      time: x.time,
      status: x.cancel ? "canceled" : s.status,
      override: x.override,
      weekId:
        s.status !== "scheduled" || s.date < today
          ? s.weekId
          : (w?.id ?? s.weekId),
    };
  });
  next.events = c.events;
  next.availability = c.availability;
  protect(p, next, today);
  return planSchema.parse(next);
}
export type PlanVersion = {
  id: string;
  seasonId: string;
  number: number;
  status: "draft" | "accepted";
  reason: string;
  createdAt: string;
  parentId: string | null;
  baseId: string | null;
  contextVersion: number;
  generationId: string | null;
  plan: Plan;
};
export type RoadmapView = {
  version: PlanVersion;
  currentId: string | null;
  reviewId: string | null;
  contextVersion: number;
  today: string;
  history: {
    id: string;
    number: number;
    status: string;
    reason: string;
    created: string;
  }[];
  conflicts: string[];
};
