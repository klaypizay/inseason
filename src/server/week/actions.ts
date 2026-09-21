"use server";
import { z } from "zod";
import { database } from "../db/runtime";
import { withSession } from "../db/repository";
import { sessionToken } from "../auth/session";
import { PlanRuleError } from "../../domain/roadmap";
import { NotFound, Unauthorized } from "../../domain/errors";
import { configuredWeekProvider, dailyQuota } from "../ai/config";
import { executeWeek } from "../ai/generate-week";
function message(e: unknown) {
  return e instanceof PlanRuleError ||
    e instanceof NotFound ||
    e instanceof Unauthorized
    ? e.message
    : e instanceof z.ZodError
      ? "Check the objectives, goal links and practice assignments. Nothing was saved."
      : "Unable to finish. Your saved week is unchanged; keep your edits and retry.";
}
export async function saveWeek(
  id: string,
  expected: string | null,
  roadmap: string,
  input: unknown,
  request: string,
  accept: boolean,
) {
  try {
    return {
      id: await withSession(database, await sessionToken(), (r) =>
        r.week().save(id, expected, roadmap, input, request, accept),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function refreshWeekDraft(
  id: string,
  expected: string | null,
  roadmap: string,
  request: string,
) {
  try {
    return {
      id: await withSession(database, await sessionToken(), (r) =>
        r.week().refresh(id, expected, roadmap, request),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function beginWeek(
  id: string,
  expected: string | null,
  roadmap: string,
  request: string,
  practiceInput?: unknown,
  draftInput?: unknown,
) {
  try {
    const provider = configuredWeekProvider();
    return {
      id: await withSession(database, await sessionToken(), (r) =>
        r
          .week()
          .begin(
            id,
            expected,
            roadmap,
            request,
            provider.name,
            provider.model,
            dailyQuota(),
            practiceInput,
            draftInput,
          ),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function executeWeeklyDraft(id: string) {
  try {
    await executeWeek(
      database,
      await sessionToken(),
      id,
      configuredWeekProvider(),
    );
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function weeklyDraftStatus(id: string) {
  try {
    return {
      status: await withSession(database, await sessionToken(), (r) =>
        r.week().status(id),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
