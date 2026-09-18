"use server";
import { z } from "zod";
import { database } from "../db/runtime";
import { withSession } from "../db/repository";
import { sessionToken } from "../auth/session";
import { configuredProvider, dailyQuota } from "../ai/config";
import { executeSeason } from "../ai/generate-season";
import { generationRequest, type GenerationView } from "../../domain/planning";
import { NotFound, Unauthorized } from "../../domain/errors";
import { SetupRuleError } from "../db/onboarding";
function safeMessage(error: unknown) {
  if (
    error instanceof Unauthorized ||
    error instanceof NotFound ||
    error instanceof SetupRuleError
  )
    return error.message;
  return "Unable to prepare this draft. Check configuration or try again. Your saved work is unchanged.";
}
export async function prepareDraft(
  input: unknown,
): Promise<{ id?: string; error?: string }> {
  try {
    const request = generationRequest.parse(input),
      provider = configuredProvider();
    const result = await withSession(database, await sessionToken(), (r) =>
      r.planning().begin(request, provider.name, provider.model, dailyQuota()),
    );
    return { id: result.id };
  } catch (error) {
    return { error: safeMessage(error) };
  }
}
export async function executeDraft(id: string): Promise<{ error?: string }> {
  try {
    await executeSeason(
      database,
      await sessionToken(),
      z.uuid().parse(id),
      configuredProvider(),
    );
    return {};
  } catch (error) {
    return { error: safeMessage(error) };
  }
}
export async function draftStatus(
  id: string,
): Promise<{ view?: GenerationView; error?: string }> {
  try {
    return {
      view: await withSession(database, await sessionToken(), (r) =>
        r.planning().get(z.uuid().parse(id)),
      ),
    };
  } catch (error) {
    return { error: safeMessage(error) };
  }
}
