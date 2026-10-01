"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { editsFor } from "../../domain/roadmap";
import { database } from "../db/runtime";
import { withSession } from "../db/repository";
import { sessionToken } from "../auth/session";
import {
  configuredProvider,
  configuredWeekProvider,
  dailyQuota,
} from "../ai/config";
import { executeSeason } from "../ai/generate-season";
import { executeWeek } from "../ai/generate-week";

const quickStartSchema = z.strictObject({
  teamName: z.string().trim().min(1).max(100),
  sport: z.enum(["Basketball", "Soccer", "Volleyball", "Other"]),
  ageBand: z.string().trim().min(1).max(80),
  skill: z.enum(["New to the sport", "Developing", "Experienced", "Mixed"]),
  goal: z.string().trim().min(3).max(600),
  practiceDate: z.iso.date(),
  practiceTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  minutes: z.number().int().min(20).max(240),
  playerCount: z.number().int().min(1).max(50),
  space: z.enum(["full", "half", "shared", "none"]),
  hoops: z.number().int().min(0).max(20),
  equipment: z.string().trim().max(600),
  timezone: z
    .string()
    .max(80)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
});

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (value: string, days: number) => {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
};

export async function createStarterJourney(input: unknown): Promise<{
  href?: string;
  notice?: string;
  error?: string;
}> {
  try {
    const value = quickStartSchema.parse(input);
    const today = iso(new Date());
    if (value.practiceDate < today)
      return {
        error: "Choose today or a future date for your first practice.",
      };

    const token = await sessionToken();
    const setup = await withSession(database, token, (repo) =>
      repo.onboarding().load(),
    );
    if (setup.data.complete)
      return {
        error:
          "Your starter setup is already complete. Open Team setup to make changes.",
      };

    const end = addDays(value.practiceDate, 83);
    const weekday = new Date(value.practiceDate + "T00:00:00Z").getUTCDay();
    const saved = await withSession(database, token, (repo) =>
      repo.onboarding().save({
        ...setup.data,
        complete: true,
        teamName: value.teamName,
        title: `${value.teamName} season`,
        reports: {
          ...setup.data.reports,
          teamType: value.sport,
          ageBand: value.ageBand,
          skill: value.skill,
          goals: value.goal,
          equipment: value.equipment,
        },
        start: value.practiceDate,
        end,
        timezone: value.timezone,
        playerCount: value.playerCount,
        hoops: value.hoops,
        court: value.space,
        phases: [{ type: "in_season", start: value.practiceDate, end }],
        availability: [
          {
            weekday,
            time: value.practiceTime,
            minutes: value.minutes,
            start: value.practiceDate,
            end,
          },
        ],
        events: [],
        players: [],
      }),
    );
    const teamId = saved.data.teamId!;
    const seasonId = saved.data.seasonId!;
    const provider = configuredProvider();
    const run = await withSession(database, token, (repo) =>
      repo.planning().begin(
        {
          teamId,
          seasonId,
          action: "draftRoadmap",
          idempotencyKey: randomUUID(),
        },
        provider.name,
        provider.model,
        dailyQuota(),
      ),
    );
    await executeSeason(database, token, run.id, provider);
    const generated = await withSession(database, token, (repo) =>
      repo.planning().get(run.id),
    );
    if (generated.status !== "succeeded" || !generated.draft)
      return {
        href: "/season",
        notice:
          "Your team details are saved. The starter roadmap needs another try.",
      };

    const roadmapDraft = await withSession(database, token, (repo) =>
      repo.roadmap().open(run.id, randomUUID()),
    );
    const roadmapView = await withSession(database, token, (repo) =>
      repo.roadmap().get(roadmapDraft),
    );
    const roadmapId = await withSession(database, token, (repo) =>
      repo
        .roadmap()
        .save(
          roadmapDraft,
          editsFor(roadmapView.version.plan),
          randomUUID(),
          true,
        ),
    );
    const summary = await withSession(database, token, (repo) =>
      repo.roadmap().summary(seasonId),
    );
    if (!summary.nextWeekId || !summary.nextSession)
      return {
        href: `/roadmaps/${roadmapId}`,
        notice:
          "Your starter roadmap is ready. Add a future practice to prepare Practice 1.",
      };

    const week = await withSession(database, token, (repo) =>
      repo.week().get(summary.nextWeekId!),
    );
    try {
      const weekProvider = configuredWeekProvider();
      const practiceRun = await withSession(database, token, (repo) =>
        repo
          .week()
          .begin(
            summary.nextWeekId!,
            week.reviewId,
            roadmapId,
            randomUUID(),
            weekProvider.name,
            weekProvider.model,
            dailyQuota(),
            {
              sessionId: summary.nextSession!.id,
              brief:
                "Create a practical first session that builds confidence and supports the main team goal.",
            },
          ),
      );
      await executeWeek(database, token, practiceRun, weekProvider);
    } catch {
      return {
        href: `/weeks/${summary.nextWeekId}?session=${summary.nextSession.id}`,
        notice:
          "Your starter roadmap is in use. Practice 1 is ready for you to generate or build manually.",
      };
    }
    revalidatePath("/today");
    revalidatePath("/season");
    return {
      href: `/weeks/${summary.nextWeekId}?session=${summary.nextSession.id}`,
    };
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        error: error.issues[0]?.message ?? "Check your quick-start answers.",
      };
    return {
      error:
        "We couldn’t finish your starter plan. Anything already saved is still available from Today.",
    };
  }
}
