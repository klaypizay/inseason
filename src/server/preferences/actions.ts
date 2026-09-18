"use server";
import { withSession } from "../db/repository";
import { database } from "../db/runtime";
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
      ? "Check the name and settings, then retry."
      : "Unable to save. Your existing settings are unchanged.";
}
export async function loadPreferences() {
  try {
    return {
      preferences: await withSession(database, await sessionToken(), (r) =>
        r.preferences().get(),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function savePreferences(input: unknown) {
  try {
    return {
      preferences: await withSession(database, await sessionToken(), (r) =>
        r.preferences().save(input),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function saveLibraryItem(id: string, input: unknown) {
  try {
    return {
      item: await withSession(database, await sessionToken(), (r) =>
        r.library().save(id, input),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function loadSettingsSetup() {
  try {
    return {
      view: await withSession(database, await sessionToken(), (r) =>
        r.onboarding().load(),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function manageFolder(input: unknown) {
  try {
    return {
      folders: await withSession(database, await sessionToken(), (r) =>
        r.library().manageFolder(input),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function moveLibraryItems(input: unknown) {
  try {
    return {
      moved: await withSession(database, await sessionToken(), (r) =>
        r.library().move(input),
      ),
    };
  } catch (e) {
    return { error: message(e) };
  }
}
