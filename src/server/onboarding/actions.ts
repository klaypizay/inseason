"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { database } from "../db/runtime";
import { withSession } from "../db/repository";
import { sessionToken } from "../auth/session";
import { NotFound, Unauthorized } from "../../domain/errors";
import { SetupConflict, SetupRuleError } from "../db/onboarding";
import { reportFields, type SetupView } from "../../domain/onboarding";
export async function saveSetup(
  payload: string,
): Promise<{ view?: SetupView; error?: string }> {
  try {
    if (
      typeof payload !== "string" ||
      Buffer.byteLength(payload, "utf8") > 48000
    )
      return {
        error:
          "Setup is too large. Shorten notes or remove unused rows and retry.",
      };
    const value: unknown = JSON.parse(payload);
    const view = await withSession(database, await sessionToken(), (r) =>
      r.onboarding().save(value),
    );
    revalidatePath("/today");
    return { view };
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        error: error.issues
          .slice(0, 5)
          .map((i) => fieldLabel(i.path) + ": " + i.message)
          .join(" · "),
      };
    if (
      error instanceof Unauthorized ||
      error instanceof NotFound ||
      error instanceof SetupConflict ||
      error instanceof SetupRuleError
    )
      return { error: error.message };
    return {
      error:
        "Unable to save right now. Your edits are still here. Try saving again.",
    };
  }
}

function fieldLabel(path: PropertyKey[]) {
  const labels: Record<string, string> = {
    teamName: "Team name",
    title: "Season title",
    start: "Start date",
    end: "End date",
    timezone: "Timezone",
    playerCount: "Player count",
    hoops: "Hoop count",
    court: "Court access",
    phases: "Phase",
    availability: "Practice slot",
    events: "Event",
    players: "Player",
    minutes: "duration (minutes)",
    time: "start time",
    endTime: "end time",
    alias: "alias",
    note: "availability note",
    participation: "participation",
  };
  if (path[0] === "reports")
    return reportFields[path[1] as keyof typeof reportFields] || "Coach report";
  return path
    .map((p) =>
      typeof p === "number" ? String(p + 1) : labels[String(p)] || "Setup",
    )
    .join(" ");
}
