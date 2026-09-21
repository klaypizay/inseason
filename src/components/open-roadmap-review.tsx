"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { openRoadmap } from "../server/roadmap/actions";
export function OpenRoadmapReview({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void openRoadmap(id, crypto.randomUUID())
      .then((result) => {
        if (!alive) return;
        if (result.id) router.replace("/roadmaps/" + result.id);
        else setError(result.error ?? "Unable to open roadmap review.");
      })
      .catch(() => {
        if (alive)
          setError(
            "Connection interrupted. Open Saved plans to continue your review.",
          );
      });
    return () => {
      alive = false;
    };
  }, [id, router]);
  return (
    <p role={error ? "alert" : "status"}>
      {error || "Opening your roadmap for a quick review…"}
    </p>
  );
}
