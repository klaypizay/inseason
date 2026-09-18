"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepareDraft } from "../server/planning/actions";
import type { GenerationAction } from "../domain/planning";
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
  const router = useRouter();
  function start(action: GenerationAction) {
    startTransition(async () => {
      setError("");
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
      <div className="button-row">
        <button
          disabled={disabled || pending}
          onClick={() => start("assessSeason")}
        >
          Assess team needs
        </button>
        <button
          className="secondary"
          disabled={disabled || pending}
          onClick={() => start("draftRoadmap")}
        >
          Create roadmap draft
        </button>
      </div>
      {pending && <p role="status">Preparing your draft…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
