import "server-only";
import { fixtureSeasonProvider, ProviderFailure } from "./season-provider";
import { openAISeasonProvider } from "./openai-season";
export function configuredProvider() {
  const name = process.env.COACH_AI_PROVIDER ?? "fixture";
  if (name === "fixture") return fixtureSeasonProvider;
  if (name === "openai")
    return openAISeasonProvider(
      process.env.OPENAI_API_KEY ?? "",
      process.env.OPENAI_MODEL ?? "gpt-5.4-mini-2026-03-17",
    );
  throw new ProviderFailure("not_configured");
}
export function dailyQuota() {
  const n = Number(process.env.COACH_AI_DAILY_LIMIT ?? 30);
  if (!Number.isInteger(n) || n < 1 || n > 100)
    throw new ProviderFailure("not_configured");
  return n;
}
