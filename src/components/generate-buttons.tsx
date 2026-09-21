"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepareDraft } from "../server/planning/actions";
import type { GenerationAction } from "../domain/planning";
import { AIGenerationOverlay } from "./ai-generation-overlay";
export function GenerateButtons({
  teamId,
  seasonId,
  disabled = false,
}: {
  teamId: string;
  seasonId: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition(),
    [error, setError] = useState("");
  const [kind, setKind] = useState<GenerationAction>("draftRoadmap");
  const router = useRouter();
  function start(action: GenerationAction) {
    setKind(action);
    setError("");
    startTransition(async () => {
      try {
        const result = await prepareDraft({
          teamId,
          seasonId,
          action,
          idempotencyKey: crypto.randomUUID(),
        });
        if (result.id) router.push("/drafts/" + result.id);
        else setError(result.error ?? "Try again.");
      } catch {
        setError(
          "Connection interrupted. Try again; existing drafts are safe.",
        );
      }
    });
  }
  return (
    <div>
      <AIGenerationOverlay
        active={pending && !error}
        title={
          kind === "assessSeason"
            ? "Preparing your team assessment…"
            : "Building your season roadmap…"
        }
        description={
          kind === "assessSeason"
            ? "Turning your team notes into clear priorities and suggestions."
            : "Bringing your team’s goals and schedule into a week-by-week plan."
        }
      />
      <div className="button-row">
        <button
          disabled={disabled || pending}
          onClick={() => start("draftRoadmap")}
        >
          Create roadmap draft
        </button>
      </div>
      <details className="planning-disclosure">
        <summary>Optional: get a team assessment</summary>
        <p>
          Unsure what to focus on? We’ll review the strengths, challenges and
          goals you’ve shared and suggest priorities, possible season goals and
          questions to explore at practice. Update your team notes and run an
          assessment again as the season unfolds. Use the advice to adjust your
          roadmap; assessments don’t change it automatically. You can also go
          straight to creating a roadmap.
        </p>
        <button
          className="secondary"
          disabled={disabled || pending}
          onClick={() => start("assessSeason")}
        >
          Assess team needs
        </button>
      </details>
      {pending && <p role="status">Preparing your draft…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
