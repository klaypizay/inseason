"use server";
import { database } from "../db/runtime";
import { withSession } from "../db/repository";
import { sessionToken } from "../auth/session";
import { PlanRuleError } from "../../domain/roadmap";
import { NotFound, Unauthorized } from "../../domain/errors";
import { z } from "zod";
function message(e: unknown) {
  return e instanceof PlanRuleError ||
    e instanceof NotFound ||
    e instanceof Unauthorized
    ? e.message
    : e instanceof z.ZodError
      ? "Check the dates and required text. Nothing was saved."
      : "Unable to save this review. Your saved plan is unchanged; keep this tab open and retry.";
}
export async function openRoadmap(generationId: string, request: string) {
  try {
    return {
      id: await withSession(database, await sessionToken(), (r) =>
        r.roadmap().open(generationId, request),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function saveRoadmap(
  id: string,
  input: unknown,
  request: string,
  accept: boolean,
) {
  try {
    z.boolean().parse(accept);
    return {
      id: await withSession(database, await sessionToken(), (r) =>
        r.roadmap().save(id, input, request, accept),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function previewCalendar(
  id: string,
  input: unknown,
  request: string,
) {
  try {
    return {
      id: await withSession(database, await sessionToken(), (r) =>
        r.roadmap().calendar(id, input, request),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function recoverRoadmap(
  id: string,
  current: string | null,
  review: string | null,
  request: string,
) {
  try {
    z.uuid().nullable().parse(current);
    z.uuid().nullable().parse(review);
    return {
      id: await withSession(database, await sessionToken(), (r) =>
        r.roadmap().recover(id, current, review, request),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
