"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openRoadmap } from "../server/roadmap/actions";
export function ReviewRoadmapButton({
  generationId,
}: {
  generationId: string;
}) {
  const [pending, start] = useTransition(),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const result = await openRoadmap(
                generationId,
                crypto.randomUUID(),
              );
              if (result.id) router.push("/roadmaps/" + result.id);
              else setError(result.error ?? "Try again.");
            } catch {
              setError(
                "Connection interrupted. Open Season to check saved reviews.",
              );
            }
          })
        }
      >
        {pending ? "Opening review…" : "Review & edit roadmap"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
