"use client";
import { OpenRoadmapReview } from "./open-roadmap-review";
import { AIGenerationOverlay } from "./ai-generation-overlay";
import { useDateFormat } from "./preferences-provider";
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
    "We couldn’t complete a usable draft. Your saved plans are unchanged. Return to Season roadmap and try again.",
  invalid_evidence:
    "The draft included claims we couldn’t connect to your team notes, so we didn’t save it. Your existing plans are unchanged. Please try again.",
  invalid_calendar:
    "The draft missed part of your season schedule, so we didn’t save it. Your existing plans are unchanged. Please try again.",
  interrupted: "This attempt was interrupted. You can start a new attempt.",
  timeout:
    "Preparing the draft took too long. Your saved plans are unchanged. Please try again.",
  refused:
    "We couldn’t create a draft from this request. Check your team notes, then try again.",
  provider_auth:
    "We can’t connect to the planning service right now. You can still open your saved plans. Please try again later.",
  provider_limit:
    "The planning service is busy. Your saved plans are available. Please try again later.",
};
export function DraftView({
  initial,
  showSource = false,
}: {
  initial: GenerationView;
  showSource?: boolean;
}) {
  const date = useDateFormat();
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
              Based on your note ·{" "}
              {reportFields[source?.field as ReportField] ?? "Source"}:{" "}
              {source?.value} ({date(source?.reportedAt)})
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="small">
        A general suggestion to consider. We don’t yet have team notes to
        confirm whether it fits your players.
      </p>
    );
  if (
    !showSource &&
    view.status === "succeeded" &&
    payload?.action === "draftRoadmap" &&
    view.contextVersion === view.currentContextVersion
  )
    return <OpenRoadmapReview id={view.id} />;
  return (
    <>
      <AIGenerationOverlay
        active={busy && !error}
        title={
          view.action === "assessSeason"
            ? "Preparing your team assessment…"
            : "Building your season roadmap…"
        }
        description={
          view.action === "assessSeason"
            ? "Turning your team notes into clear priorities and suggestions."
            : "Bringing your team’s goals and schedule into a week-by-week plan."
        }
      />
      <p className="eyebrow">
        {payload ? "SAVED FOR YOUR REVIEW" : "YOUR SEASON PLAN"}
      </p>
      <h1>
        {view.action === "assessSeason"
          ? "Your team assessment"
          : "Season roadmap"}
      </h1>
      {view.provider === "fixture" && (
        <p className="small">
          Prewritten example to show what you’ll receive. It is not a
          personalized assessment of your team.
        </p>
      )}
      {busy && (
        <section className="card" role="status">
          <h2>Preparing your draft…</h2>
          <p>
            {view.attempts > 1
              ? "Retry " + (view.attempts - 1) + " of at most 2."
              : "Using your team details, goals and schedule to prepare suggestions for you."}{" "}
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
              Your team setup has changed since this was created. This copy is
              still saved; create a fresh draft from Season roadmap to use your
              updated details.
            </p>
          )}
          <p>
            {payload.action === "assessSeason"
              ? "Here are possible strengths, areas to work on and goals based on the notes you’ve shared. Use these suggestions to decide what belongs in your season roadmap. They reflect your reports, not a direct evaluation of your players, and won’t change your plans automatically."
              : "This is the first outline we created from your team setup. Open Review & edit roadmap to adjust any week, then choose Use this roadmap when it fits your team. Your current plan stays in place until you make that choice."}
          </p>
          {payload.action === "assessSeason"
            ? (() => {
                const a = payload.content as Assessment;
                return (
                  <>
                    <section className="card">
                      <h2>The team notes we used</h2>
                      <p className="small">
                        These are the details you shared in Team setup. Update
                        them as you get to know your players so future
                        suggestions stay relevant.
                      </p>
                      {sources.map((s) => (
                        <div className="source-row" key={s.id}>
                          <h3>
                            {reportFields[s.field as ReportField] ?? s.field}
                          </h3>
                          <p>{s.value ?? "You haven’t added this yet."}</p>
                          <p className="small">
                            {s.value ? "Shared by you" : "Not added yet"} ·{" "}
                            {date(s.reportedAt)}
                          </p>
                        </div>
                      ))}
                    </section>
                    {(["strengths", "gaps"] as const).map((key) => (
                      <section className="card draft-section" key={key}>
                        <h2>
                          {key === "strengths"
                            ? "Strengths to build on"
                            : "Areas to work on"}
                        </h2>
                        {!a[key].length && (
                          <p>
                            Add a few observations in Team setup, then run
                            another assessment for more specific suggestions.
                          </p>
                        )}
                        {a[key].map((c, i) => (
                          <div className="source-row" key={i}>
                            <strong>
                              {c.confidence === "Likely"
                                ? "Suggested by your notes · check at practice"
                                : "Something to explore at practice"}
                            </strong>
                            <p>{c.text}</p>
                            {evidence(c.evidenceIds)}
                          </div>
                        ))}
                      </section>
                    ))}
                    <section className="card draft-section">
                      <h2>Goals to consider for your season</h2>
                      {a.goals.map((g, i) => (
                        <div className="source-row" key={i}>
                          <h3>{g.description}</h3>
                          <p>What to observe: {g.successCriteria}</p>
                          {evidence(g.evidenceIds)}
                        </div>
                      ))}
                    </section>
                    <section className="card draft-section">
                      <h2>What to learn about your team next</h2>
                      <ul>
                        {a.questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                      <h3>Things to confirm before planning</h3>
                      <ul>
                        {a.assumptions.map((q) => (
                          <li key={q}>
                            {view.provider === "fixture" &&
                            q ===
                              "This fixture offers general teaching suggestions, not a measured assessment."
                              ? "This prewritten example offers general teaching ideas. Check what fits your players at practice."
                              : q}
                          </li>
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
                    <details className="card roadmap-explanation">
                      <summary>Why this roadmap?</summary>
                      <p>{r.rationale}</p>
                      <h3>Things to confirm about your team</h3>
                      <ul>
                        {r.assumptions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                      <p className="small">
                        Dates include the first and last day shown and use{" "}
                        {payload.context.season.timezone}. A week may be shorter
                        at the start or end of a season phase.
                      </p>
                    </details>
                    <h2 className="board-title">Your season at a glance</h2>
                    <p className="small">
                      Read weeks left to right, grouped by phase. Expand a card
                      for its teaching notes and the team information behind
                      them.
                    </p>
                    {payload.context.phases.map((p) => {
                      const phase = r.phases.find((x) => x.phaseId === p.id)!;
                      return (
                        <section className="week-phase" key={p.id}>
                          <p className="eyebrow">
                            {p.type.replace("_", "-")} · {date(p.start)} to{" "}
                            {date(p.end)}
                          </p>
                          <details className="phase-notes">
                            <summary>
                              Goals for this part of the season & why
                            </summary>
                            <p>{phase.rationale}</p>
                            {phase.goals.map((g, i) => (
                              <div className="source-row" key={i}>
                                <h3>{g.description}</h3>
                                <p>{g.successCriteria}</p>
                                {evidence(g.evidenceIds)}
                              </div>
                            ))}
                          </details>
                          <div className="week-grid">
                            {payload.context.weeks
                              .filter((w) => w.phaseId === p.id)
                              .map((w) => {
                                const week = r.weeks.find(
                                  (x) => x.sequence === w.sequence,
                                )!;
                                return (
                                  <article
                                    className="week-card"
                                    key={w.sequence}
                                  >
                                    <h3>Week {w.sequence}</h3>
                                    <p className="small">
                                      {date(w.start)} → {date(w.end)}
                                    </p>
                                    <p className="week-emphasis">
                                      {week.emphasis}
                                    </p>
                                    <p className="week-checkpoint">
                                      <strong>What to look for</strong>
                                      {week.checkpoint}
                                    </p>
                                    <details className="week-details">
                                      <summary>
                                        Teaching notes & your team reports
                                      </summary>
                                      <p>{week.emphasis}</p>
                                      <p>
                                        <strong>What to look for:</strong>{" "}
                                        {week.checkpoint}
                                      </p>
                                      {evidence(week.evidenceIds)}
                                    </details>
                                  </article>
                                );
                              })}
                          </div>
                        </section>
                      );
                    })}
                  </>
                );
              })()}
          <section className="card draft-section">
            <h2>Your next step</h2>
            <p>
              {payload.action === "assessSeason"
                ? "Choose the suggestions that fit what you see at practice. Add them to your goals or team notes in Team setup, then create a roadmap from those updated details. If you already use a roadmap, open it from the sidebar to edit future weeks."
                : "Review the weekly teaching priorities and edit anything that doesn’t fit. Choose Use this roadmap to make it the outline for your practice planning."}
            </p>
            {payload.action === "draftRoadmap" && (
              <ReviewRoadmapButton generationId={view.id} />
            )}
            <Link href="/setup">Update team notes & goals</Link> ·{" "}
            <Link href="/season">Return to season planning</Link>
          </section>
        </>
      )}
    </>
  );
}
