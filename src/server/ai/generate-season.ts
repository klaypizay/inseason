import { withSession, type Database } from "../db/repository";
import {
  generationRequest,
  type GenerationRequest,
} from "../../domain/planning";
import { runGeneration, type SeasonProvider } from "./season-provider";
export async function executeSeason(
  database: Database,
  token: string | undefined,
  id: string,
  provider: SeasonProvider,
) {
  const claimed = await withSession(database, token, (r) =>
    r.planning().claim(id, provider.name, provider.model),
  );
  if (!claimed) return { id };
  const result = await runGeneration(
    provider,
    claimed.action,
    claimed.context,
    (attempt) =>
      withSession(database, token, (r) => r.planning().attempt(id, attempt)),
  );
  try {
    await withSession(database, token, (r) =>
      r.planning().finish(id, result.content, result.metrics, result.errorCode),
    );
  } catch {
    try {
      await withSession(database, token, (r) =>
        r.planning().finish(id, null, result.metrics, "save_failed"),
      );
    } catch {}
  }
  return { id };
}
export async function generateSeason(
  database: Database,
  token: string | undefined,
  input: GenerationRequest,
  provider: SeasonProvider,
  dailyQuota = 30,
) {
  const request = generationRequest.parse(input);
  const started = await withSession(database, token, (r) =>
    r.planning().begin(request, provider.name, provider.model, dailyQuota),
  );
  return executeSeason(database, token, started.id, provider);
}
