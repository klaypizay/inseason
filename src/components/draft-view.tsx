"use client";
import { ReviewRoadmapButton } from "./review-roadmap-button";
import Link from "next/link";
import { useEffect, useState } from "react";
import { draftStatus, executeDraft } from "../server/planning/actions";
import type { GenerationView, Assessment, Roadmap } from "../domain/planning";
import { reportFields, type ReportField } from "../domain/onboarding";
const errors: Record<string, string> = {
  stale_context:
    "Team settings changed while this draft was being prepared. Generate a fresh draft.",
  invalid_output:
    "The response was incomplete or malformed. No draft was saved.",
  invalid_evidence:
    "The response referenced unsupported evidence. No draft was saved.",
  invalid_calendar:
    "The response did not cover every phase and week. No draft was saved.",
  interrupted: "This attempt was interrupted. You can start a new attempt.",
  timeout: "The provider took too long. You can retry.",
  refused:
    "The provider could not fulfill this request. Review your inputs before retrying.",
  provider_auth:
    "The AI connection needs attention. Your saved inputs and drafts are available.",
  provider_limit:
    "The AI provider is temporarily limiting requests. Try again later.",
};
export function DraftView({ initial }: { initial: GenerationView }) {
  const [view, setView] = useState(initial),
    [error, setError] = useState("");
  const busy = view.status === "queued" || view.status === "running";
  useEffect(() => {
    if (initial.status !== "queued") return;
    void executeDraft(initial.id)
      .then((r) => {
        if (r.error) setError(r.error);
      })
      .catch(() =>
        setError("Connection interrupted. Refresh to check this attempt."),
      );
  }, [initial.id, initial.status]);
  useEffect(() => {
    if (!busy) return;
    let alive = true;
    const timer = setInterval(() => {
      void draftStatus(view.id)
        .then((r) => {
          if (!alive) return;
          if (r.view) setView(r.view);
          if (r.error) setError(r.error);
        })
        .catch(() => {
          if (alive) setError("Unable to check progress. Refresh to retry.");
        });
    }, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [view.id, busy]);
  const payload = view.draft;
  const sources = payload?.context.sources ?? [];
  const evidence = (ids: string[]) =>
    ids.length ? (
      <ul className="small">
        {ids.map((id) => {
          const source = sources.find((s) => s.id === id);
          return (
            <li key={id}>
              Coach report ·{" "}
              {reportFields[source?.field as ReportField] ?? "Source"}:{" "}
              {source?.value} ({source?.reportedAt.slice(0, 10)})
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="small">
        No team evidence claimed; treat this as a question or general
        recommendation.
      </p>
    );
  return (
    <>
      <p className="eyebrow">DRAFT · COACH REVIEW REQUIRED</p>
      <h1>
        {view.action === "assessSeason"
          ? "Season assessment"
          : "Season roadmap"}
      </h1>
      {view.provider === "fixture" && (
        <p className="small">Demo example · not a live AI assessment.</p>
      )}
      {busy && (
        <section className="card" role="status">
          <h2>Preparing your draft…</h2>
          <p>
            {view.attempts > 1
              ? "Retry " + (view.attempts - 1) + " of at most 2."
              : "Checking your context and preparing teaching suggestions."}{" "}
            You can refresh this page to check progress.
          </p>
        </section>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {view.status === "failed" && (
        <section className="card" role="alert">
          <h2>This attempt did not produce a draft.</h2>
          <p>
            {errors[view.errorCode ?? ""] ??
              "Generation could not finish. Your saved work is unchanged."}
          </p>
          <Link className="button-link" href="/season">
            Return to season & retry
          </Link>
        </section>
      )}
      {payload && (
        <>
          {view.contextVersion !== view.currentContextVersion && (
            <p className="error">
              Settings have changed since this draft. Keep it as history and
              generate a fresh draft before review.
            </p>
          )}
          <p>
            Suggested teaching content only. No plan has been accepted and no
            practices have been scheduled.
          </p>
          {payload.action === "assessSeason"
            ? (() => {
                const a = payload.content as Assessment;
                return (
                  <>
                    <section className="card">
                      <h2>What you reported</h2>
                      <p className="small">
                        Known means recorded from you, not independently
                        verified.
                      </p>
                      {sources.map((s) => (
                        <div className="source-row" key={s.id}>
                          <h3>
                            {reportFields[s.field as ReportField] ?? s.field}
                          </h3>
                          <p>{s.value ?? "Unknown — not reported yet."}</p>
                          <p className="small">
                            {s.confidence} ·{" "}
                            {s.value ? "Coach report" : "Unanswered input"} ·{" "}
                            {s.reportedAt.slice(0, 10)}
                          </p>
                        </div>
                      ))}
                    </section>
                    {(["strengths", "gaps"] as const).map((key) => (
                      <section className="card draft-section" key={key}>
                        <h2>
                          {key === "strengths"
                            ? "Possible strengths"
                            : "Gaps to explore"}
                        </h2>
                        {!a[key].length && (
                          <p>Unknown. More coach observations are needed.</p>
                        )}
                        {a[key].map((c, i) => (
                          <div className="source-row" key={i}>
                            <strong>{c.confidence}</strong>
                            <p>{c.text}</p>
                            {evidence(c.evidenceIds)}
                          </div>
                        ))}
                      </section>
                    ))}
                    <section className="card draft-section">
                      <h2>Proposed season goals</h2>
                      {a.goals.map((g, i) => (
                        <div className="source-row" key={i}>
                          <h3>{g.description}</h3>
                          <p>What to observe: {g.successCriteria}</p>
                          {evidence(g.evidenceIds)}
                        </div>
                      ))}
                    </section>
                    <section className="card draft-section">
                      <h2>Open questions</h2>
                      <ul>
                        {a.questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                      <h3>Assumptions</h3>
                      <ul>
                        {a.assumptions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </section>
                  </>
                );
              })()
            : (() => {
                const r = payload.content as Roadmap;
                return (
                  <>
                    <section className="card">
                      <h2>Why this roadmap?</h2>
                      <p>{r.rationale}</p>
                      <h3>Assumptions</h3>
                      <ul>
                        {r.assumptions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                      <p className="small">
                        Dates are inclusive in {payload.context.season.timezone}
                        . Short boundary weeks stay within their phase.
                      </p>
                    </section>
                    {payload.context.phases.map((p) => {
                      const phase = r.phases.find((x) => x.phaseId === p.id)!;
                      return (
                        <section className="card draft-section" key={p.id}>
                          <p className="eyebrow">
                            {p.type.replace("_", "-")} · {p.start} to {p.end}
                          </p>
                          <h2>Phase priorities</h2>
                          <p>{phase.rationale}</p>
                          {phase.goals.map((g, i) => (
                            <div className="source-row" key={i}>
                              <h3>{g.description}</h3>
                              <p>{g.successCriteria}</p>
                              {evidence(g.evidenceIds)}
                            </div>
                          ))}
                          {payload.context.weeks
                            .filter((w) => w.phaseId === p.id)
                            .map((w) => {
                              const week = r.weeks.find(
                                (x) => x.sequence === w.sequence,
                              )!;
                              return (
                                <div className="row-card" key={w.sequence}>
                                  <h3>
                                    Week {w.sequence} · {w.start} to {w.end}
                                  </h3>
                                  <p>{week.emphasis}</p>
                                  <p>
                                    <strong>Checkpoint:</strong>{" "}
                                    {week.checkpoint}
                                  </p>
                                  {evidence(week.evidenceIds)}
                                </div>
                              );
                            })}
                        </section>
                      );
                    })}
                  </>
                );
              })()}
          <section className="card draft-section">
            <h2>Keep the coach in control</h2>
            <p>
              Review the roadmap, edit its teaching priorities, and accept it
              when you are ready.
            </p>
            {payload.action === "draftRoadmap" && (
              <ReviewRoadmapButton generationId={view.id} />
            )}
            <Link href="/setup">Edit team inputs</Link> ·{" "}
            <Link href="/season">Generate another draft</Link>
          </section>
        </>
      )}
    </>
  );
}
