"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { executeWeeklyDraft, weeklyDraftStatus } from "../server/week/actions";
import type { WeekView } from "../domain/week";

// Check only the run status, one request at a time. Full-page polling can
// queue behind the generation's database work and cancel its final refresh.
export function useWeekGeneration(
  run: WeekView["runs"][number] | undefined,
  enabled: boolean,
  onError: (message: string) => void,
) {
  const router = useRouter();
  const id = run?.id,
    status = run?.status;
  useEffect(() => {
    if (!enabled || !id) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      try {
        const result = await weeklyDraftStatus(id);
        if (!alive) return;
        if (result.error) onError(result.error);
        else if (result.status !== "queued" && result.status !== "running")
          router.refresh();
        else timer = setTimeout(check, 4000);
      } catch {
        if (alive) onError("Unable to check progress. Reload to retry.");
      }
    };
    if (status === "queued") {
      void executeWeeklyDraft(id)
        .then((result) => {
          if (!alive) return;
          if (result.error) onError(result.error);
          else void check();
        })
        .catch(() => {
          if (alive)
            onError(
              "Connection interrupted. Reload to check the saved attempt.",
            );
        });
    } else timer = setTimeout(check, 4000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id, status, enabled, onError, router]);
}
