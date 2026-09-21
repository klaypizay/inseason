import { z } from "zod";

export const reportFields = {
  experience: "Coaching experience",
  guidance: "How much coaching guidance would help?",
  teamType: "Team type",
  ageBand: "Age group",
  skill: "Approximate skill level",
  goals: "Season goals",
  philosophy: "How would you like to coach?",
  equipment: "Equipment available",
  strengths: "What is working?",
  gaps: "What needs work?",
  questions: "What are you unsure about?",
} as const;
export type ReportField = keyof typeof reportFields;
const report = z.string().trim().max(600);
const date = z.iso
  .date()
  .refine(
    (v) => v >= "2000-01-01" && v <= "2100-12-31",
    "Use a date between 2000 and 2100.",
  );
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalId = z.uuid().optional();
const reports = z.strictObject({
  experience: report,
  guidance: report,
  teamType: report,
  ageBand: report,
  skill: report,
  goals: report,
  philosophy: report,
  equipment: report,
  strengths: report,
  gaps: report,
  questions: report,
});
const phase = z.strictObject({
  id: optionalId,
  type: z.enum(["offseason", "preseason", "in_season", "postseason"]),
  start: date,
  end: date,
});
export const availabilitySchema = z.strictObject({
  id: optionalId,
  weekday: z.number().int().min(0).max(6),
  time,
  minutes: z.number().int().min(1).max(300),
  start: date.nullable(),
  end: date.nullable(),
});
const event = z.strictObject({
  id: optionalId,
  type: z.enum(["game", "tournament", "unavailable"]),
  title: z.string().trim().max(100),
  start: date,
  end: date,
  time: time.or(z.literal("")),
  endTime: time.or(z.literal("")),
  blocksPractice: z.boolean(),
});
const player = z.strictObject({
  id: optionalId,
  alias: z.string().trim().max(80),
  participation: z.enum(["available", "limited", "unavailable", "unknown"]),
  note: z.string().trim().max(200),
});
export const setupSchema = z
  .strictObject({
    teamId: z.uuid().nullable(),
    seasonId: z.uuid().nullable(),
    version: z.number().int().min(0),
    complete: z.boolean(),
    teamName: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(100),
    reports,
    start: date.nullable(),
    end: date.nullable(),
    timezone: z
      .string()
      .max(80)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Enter a time zone such as America/Chicago or Europe/London."),
    weekStart: z.number().int().min(0).max(6),
    playerCount: z.number().int().min(1).max(50).nullable(),
    hoops: z.number().int().min(0).max(20).nullable(),
    court: z.enum(["unknown", "full", "half", "shared", "none"]),
    phases: z.array(phase).max(12),
    availability: z.array(availabilitySchema).max(14),
    events: z.array(event).max(30),
    players: z.array(player).max(30),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if (Boolean(v.teamId) !== Boolean(v.seasonId))
      issue(["teamId"], "Team and season must match.");
    if (v.start && v.end && v.end < v.start)
      issue(["end"], "Season end must be on or after its start.");
    if (v.start && v.end && day(v.end) - day(v.start) > 731)
      issue(["end"], "Use a season of two years or less.");
    for (const key of [
      "phases",
      "availability",
      "events",
      "players",
    ] as const) {
      const ids = v[key].map((x) => x.id).filter(Boolean);
      if (new Set(ids).size !== ids.length)
        issue([key], "Duplicate rows are not allowed.");
    }
    for (const key of ["phases", "availability", "events"] as const) {
      v[key].forEach((row, i) => {
        if (row.start && row.end && row.end < row.start)
          issue([key, i, "end"], "End must be on or after start.");
        if (
          (row.start && v.start && row.start < v.start) ||
          (row.end && v.end && row.end > v.end)
        )
          issue(
            [key, i],
            "Dates must stay within the season. Edit or remove affected rows first.",
          );
      });
    }
    v.availability.forEach((a, i) => {
      const start = a.start ?? v.start,
        end = a.end ?? v.end;
      if (start && end && start > end)
        issue(["availability", i], "Effective dates must overlap the season.");
      const [hours, minutes] = a.time.split(":").map(Number);
      if (hours * 60 + minutes + a.minutes > 1440)
        issue(
          ["availability", i, "time"],
          "A practice slot must finish on the same local date.",
        );
    });
    v.events.forEach((e, i) => {
      if (e.start === e.end && e.time && e.endTime && e.endTime < e.time)
        issue(
          ["events", i, "endTime"],
          "Event end time must follow its start.",
        );
    });
    const phases = [...v.phases].sort((a, b) => a.start.localeCompare(b.start));
    phases.forEach((p, i) => {
      if (i && p.start <= phases[i - 1].end)
        issue(["phases"], "Phases must not overlap.");
    });
    if (v.complete) {
      if (!v.start || !v.end)
        issue(["start"], "Add both season dates to finish setup.");
      if (v.playerCount === null || v.hoops === null || v.court === "unknown")
        issue(
          ["playerCount"],
          "Add player count, court access and hoop count to finish setup.",
        );
      if (
        !phases.length ||
        phases[0].start !== v.start ||
        phases.at(-1)?.end !== v.end ||
        phases.some(
          (p, i) => i > 0 && day(p.start) !== day(phases[i - 1].end) + 1,
        )
      )
        issue(
          ["phases"],
          "Use one phase for the whole season, or add phases that cover every season date without gaps.",
        );
    }
  });
export type Setup = z.infer<typeof setupSchema>;
export type SetupView = {
  data: Setup;
  savedAt: string | null;
  sources: { field: string; confidence: string; reportedAt: string }[];
};
export function day(value: string) {
  return Date.parse(value + "T00:00:00Z") / 86400000;
}
export function blankSetup(): Setup {
  return {
    teamId: null,
    seasonId: null,
    version: 0,
    complete: false,
    teamName: "",
    title: "My season",
    reports: Object.fromEntries(
      Object.keys(reportFields).map((k) => [k, ""]),
    ) as Setup["reports"],
    start: null,
    end: null,
    timezone: "America/Chicago",
    weekStart: 1,
    playerCount: null,
    hoops: null,
    court: "unknown",
    phases: [],
    availability: [],
    events: [],
    players: [],
  };
}
