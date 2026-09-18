"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  protectedObjectiveIds,
  type WeekContent,
  type WeekView,
} from "../domain/week";
import {
  beginWeek,
  executeWeeklyDraft,
  refreshWeekDraft,
  saveWeek,
} from "../server/week/actions";
export function WeekEditor({
  initial,
  seed,
}: {
  initial: WeekView;
  seed: WeekContent;
}) {
  const router = useRouter();
  const [content, setContent] = useState(seed),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition();
  const { context, version } = initial,
    week = context.week;
  const display = version?.context ?? context;
  const current = !!version && version.id === initial.currentId;
  const run = initial.runs.find(
    (r) => r.status === "queued" || r.status === "running",
  );
  const canEdit = initial.editable && !initial.stale && !run;
  const protectedIds = protectedObjectiveIds(context, seed);
  useEffect(() => {
    if (run?.status !== "queued") return;
    let alive = true;
    void executeWeeklyDraft(run.id)
      .then((r) => {
        if (!alive) return;
        if (r.error) setError(r.error);
        router.refresh();
      })
      .catch(() => {
        if (alive)
          setError(
            "Connection interrupted. Refresh to check the saved attempt.",
          );
      });
    return () => {
      alive = false;
    };
  }, [run?.id, run?.status, router]);
  useEffect(() => {
    if (!run || dirty) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [run, dirty, router]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(next: WeekContent) {
    setContent(next);
    setDirty(true);
  }
  function act(work: () => Promise<{ id?: string; error?: string }>) {
    startTransition(async () => {
      setError("");
      try {
        const r = await work();
        if (r.error) setError(r.error);
        else {
          setDirty(false);
          router.replace("/weeks/" + week.id);
          router.refresh();
        }
      } catch {
        setError("Connection interrupted. Keep your edits here and retry.");
      }
    });
  }
  const objective = (
    id: string,
    changes: Partial<WeekContent["objectives"][number]>,
  ) =>
    update({
      ...content,
      objectives: content.objectives.map((o) =>
        o.id === id ? { ...o, ...changes } : o,
      ),
    });
  return (
    <>
      <p className="eyebrow">
        WEEKLY PLANNER · {current ? "ACCEPTED" : "COACH REVIEW"}
        {version ? ` · VERSION ${version.number}` : ""}
      </p>
      <h1>A clear purpose for this week.</h1>
      <p>
        {display.week.start} to {display.week.end} · {display.timezone}
      </p>
      <p>{display.week.emphasis}</p>
      <p role="status">
        {pending
          ? "Saving your week…"
          : dirty
            ? "Unsaved changes — save before leaving."
            : current
              ? "This accepted weekly plan is saved."
              : version
                ? "Weekly draft saved. Review before accepting."
                : "Start with the roadmap emphasis, or generate a weekly draft."}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {initial.stale && (
        <section className="card draft-section">
          <h2>The roadmap has changed</h2>
          <p>
            This version remains linked to its original roadmap. Refresh a draft
            to review its goals and practice assignments against the current
            calendar.
          </p>
          <button
            disabled={!initial.editable || pending}
            onClick={() =>
              act(() =>
                refreshWeekDraft(
                  week.id,
                  initial.reviewId,
                  context.roadmapId,
                  crypto.randomUUID(),
                ),
              )
            }
          >
            Refresh from accepted roadmap
          </button>
        </section>
      )}
      {!initial.editable && (
        <p className="error">
          This view is historical, past, or awaiting an updated accepted
          roadmap.{" "}
          <Link href={"/weeks/" + week.id}>Open latest weekly review</Link>.
        </p>
      )}
      <section className="card draft-section">
        <h2>Teaching objectives</h2>
        <p className="small">
          Choose one to three priorities. These are teaching recommendations,
          not claims about player ability.
        </p>
        <div className="button-row">
          <button
            disabled={!canEdit || dirty || pending || !!run}
            onClick={() =>
              act(() =>
                beginWeek(
                  week.id,
                  initial.reviewId,
                  context.roadmapId,
                  crypto.randomUUID(),
                ),
              )
            }
          >
            {version
              ? "Regenerate unlocked objectives"
              : "Generate weekly objectives"}
          </button>
          {dirty && (
            <span className="small">Save your edits before generating.</span>
          )}
        </div>
        {run && (
          <p role="status">
            Preparing a draft… attempt {Math.max(run.attempts, 1)} of at most 3.
            You can return to this week to check progress.
          </p>
        )}
        {initial.runs[0]?.status === "failed" && (
          <p role="alert" className="error">
            The last attempt could not be saved
            {initial.runs[0].error === "stale_context"
              ? " because the week or roadmap changed"
              : ""}
            . Your saved content is intact. Edit manually or retry generation.
          </p>
        )}
        {initial.runs[0]?.provider === "fixture" && (
          <p className="small">Demo example · not a live AI plan.</p>
        )}
        {content.objectives.map((o, i) => {
          const old = seed.objectives.find((x) => x.id === o.id),
            fixed = protectedIds.has(o.id);
          const disabled = !canEdit || pending || !!old?.locked || fixed;
          return (
            <fieldset className="row-card" key={o.id}>
              <legend>
                Objective {i + 1}
                {o.locked ? " · Locked" : ""}
                {fixed ? " · Used by a past/completed session" : ""}
              </legend>
              <label>
                Teaching objective {i + 1}
                <textarea
                  maxLength={600}
                  disabled={disabled}
                  value={o.description}
                  onChange={(e) =>
                    objective(o.id, { description: e.target.value })
                  }
                />
              </label>
              <label>
                Observable check {i + 1}
                <textarea
                  maxLength={600}
                  disabled={disabled}
                  value={o.successCriteria}
                  onChange={(e) =>
                    objective(o.id, { successCriteria: e.target.value })
                  }
                />
              </label>
              <label>
                Season goal {i + 1}
                <select
                  disabled={disabled}
                  value={o.goalId}
                  onChange={(e) => objective(o.id, { goalId: e.target.value })}
                >
                  {(version && initial.stale
                    ? version.context.goals
                    : context.goals
                  ).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.description}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={o.locked}
                  disabled={!canEdit || pending || fixed}
                  onChange={(e) =>
                    objective(o.id, { locked: e.target.checked })
                  }
                />
                Lock objective {i + 1}
              </label>
              {old?.locked && (
                <p className="small">
                  To edit locked teaching text, uncheck the lock and save first.
                </p>
              )}
              <button
                className="secondary"
                disabled={disabled || content.objectives.length <= 1}
                onClick={() =>
                  update({
                    ...content,
                    objectives: content.objectives.filter((x) => x.id !== o.id),
                    allocations: content.allocations.map((a) => ({
                      ...a,
                      objectiveIds: a.objectiveIds.filter((id) => id !== o.id),
                    })),
                  })
                }
              >
                Remove objective {i + 1}
              </button>
            </fieldset>
          );
        })}
        <button
          className="secondary"
          disabled={!canEdit || pending || content.objectives.length >= 3}
          onClick={() =>
            update({
              ...content,
              objectives: [
                ...content.objectives,
                {
                  id: crypto.randomUUID(),
                  goalId: context.goals[0].id,
                  description: "",
                  successCriteria: "",
                  locked: false,
                },
              ],
            })
          }
        >
          Add objective
        </button>
      </section>
      <section className="card draft-section">
        <h2>Practices & competition</h2>
        <p className="small">
          Assign priorities to the accepted calendar slots. Empty assignments
          mean no selected teaching objective for that practice.
        </p>
        {!display.sessions.length && (
          <p>
            No team practices this week. Objectives can guide coach observation
            at competition; no extra sessions are created.
          </p>
        )}
        {display.events.map((e) => (
          <p key={e.id}>
            <strong>{e.type.replaceAll("_", " ")}</strong> · {e.start} to{" "}
            {e.end}
            {e.time ? ` · ${e.time}` : ""}
            {e.blocksPractice ? " · Blocks practice" : ""}
          </p>
        ))}
        {display.sessions.map((s) => (
          <fieldset className="row-card" key={s.id}>
            <legend>
              {s.date} · {s.time} · {s.minutes} min · {s.status}
            </legend>
            {s.override && (
              <p className="small">
                Coach-approved calendar override: {s.override}
              </p>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={
                  content.allocations.find((a) => a.sessionId === s.id)
                    ?.manual ?? false
                }
                disabled={
                  !canEdit ||
                  pending ||
                  s.status === "completed" ||
                  s.date < context.today
                }
                onChange={(e) =>
                  update({
                    ...content,
                    allocations: content.allocations.map((a) =>
                      a.sessionId === s.id
                        ? { ...a, manual: e.target.checked }
                        : a,
                    ),
                  })
                }
              />
              Keep these assignments when regenerating
            </label>
            {content.allocations.find((a) => a.sessionId === s.id)?.manual && (
              <p className="small">
                Coach-assigned priorities · preserved during regeneration.
              </p>
            )}
            {content.objectives.map((o, i) => (
              <label className="check" key={o.id}>
                <input
                  type="checkbox"
                  checked={
                    content.allocations
                      .find((a) => a.sessionId === s.id)
                      ?.objectiveIds.includes(o.id) ?? false
                  }
                  disabled={
                    !canEdit ||
                    pending ||
                    s.status === "completed" ||
                    s.date < context.today
                  }
                  onChange={(e) =>
                    update({
                      ...content,
                      allocations: content.allocations.map((a) =>
                        a.sessionId === s.id
                          ? {
                              ...a,
                              manual: true,
                              objectiveIds: e.target.checked
                                ? [...a.objectiveIds, o.id]
                                : a.objectiveIds.filter((id) => id !== o.id),
                            }
                          : a,
                      ),
                    })
                  }
                />
                Objective {i + 1}: {o.description || "Untitled"}
              </label>
            ))}
          </fieldset>
        ))}
        <Link href={"/roadmaps/" + context.roadmapId + "#calendar-review"}>
          Review dates, availability, or an explicit calendar override
        </Link>
      </section>
      <section className="card draft-section">
        <h2>Why this week?</h2>
        <label>
          Weekly explanation
          <textarea
            disabled={!canEdit || pending}
            maxLength={600}
            value={content.rationale}
            onChange={(e) => update({ ...content, rationale: e.target.value })}
          />
        </label>
        <label>
          Weekly assumptions (one per line, up to six)
          <textarea
            disabled={!canEdit || pending}
            value={content.assumptions.join("\n")}
            onChange={(e) =>
              update({
                ...content,
                assumptions: e.target.value.split("\n").filter(Boolean),
              })
            }
          />
        </label>
        <p className="small">
          Goal links refer to{" "}
          <Link href={"/roadmaps/" + (version?.roadmapId ?? context.roadmapId)}>
            the accepted roadmap used for this version
          </Link>
          . No observation of a player is implied.
        </p>
        <div className="button-row save-bar">
          <button
            disabled={!canEdit || pending}
            onClick={() =>
              act(() =>
                saveWeek(
                  week.id,
                  initial.reviewId,
                  context.roadmapId,
                  content,
                  crypto.randomUUID(),
                  false,
                ),
              )
            }
          >
            Save weekly draft
          </button>
          <button
            disabled={!canEdit || pending}
            onClick={() =>
              act(() =>
                saveWeek(
                  week.id,
                  initial.reviewId,
                  context.roadmapId,
                  content,
                  crypto.randomUUID(),
                  true,
                ),
              )
            }
          >
            Accept weekly plan
          </button>
        </div>
      </section>
      <section className="card draft-section">
        <h2>Weekly history</h2>
        {!initial.history.length && <p>No saved weekly versions yet.</p>}
        <ul>
          {initial.history.map((v) => (
            <li key={v.id}>
              <Link href={"/weeks/" + week.id + "?version=" + v.id}>
                Version {v.number} · {v.status}
              </Link>
              {v.id === initial.currentId ? " · Active" : ""}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
