"use client";
import { useDateFormat, useTimeFormat } from "./preferences-provider";
import Link from "next/link";
import { useWeekGeneration } from "./use-week-generation";
import { AIGenerationOverlay } from "./ai-generation-overlay";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  protectedObjectiveIds,
  type WeekContent,
  type WeekView,
} from "../domain/week";
import { beginWeek, refreshWeekDraft, saveWeek } from "../server/week/actions";
export function WeekEditor({
  initial,
  seed,
}: {
  initial: WeekView;
  seed: WeekContent;
}) {
  const date = useDateFormat();
  const time = useTimeFormat();
  const router = useRouter();
  const [content, setContent] = useState(seed),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [generating, setGenerating] = useState(false),
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
  useWeekGeneration(run, !dirty, setError);
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
  function act(
    work: () => Promise<{ id?: string; error?: string }>,
    ai = false,
  ) {
    if (ai) setGenerating(true);
    setError("");
    startTransition(async () => {
      try {
        const r = await work();
        if (r.error) {
          setGenerating(false);
          setError(r.error);
        } else {
          setDirty(false);
          router.replace("/weeks/" + week.id + "?advanced=1", {
            scroll: false,
          });
          router.refresh();
        }
      } catch {
        setGenerating(false);
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
      <AIGenerationOverlay
        active={(generating || !!run) && !error}
        title="Preparing your weekly priorities…"
        description="Connecting this week’s teaching goals to your season roadmap and available practices."
      />
      <p className="eyebrow">
        WEEKLY PRIORITIES · {current ? "IN USE" : "FOR YOUR REVIEW"}
        {version ? ` · VERSION ${version.number}` : ""}
      </p>
      <h1>A clear purpose for this week.</h1>
      <p>
        {date(display.week.start)} to {date(display.week.end)} ·{" "}
        {display.timezone}
      </p>
      <p>{display.week.emphasis}</p>
      <p role="status">
        {pending
          ? "Saving your week…"
          : dirty
            ? "Unsaved changes — save before leaving."
            : current
              ? "These weekly priorities are saved and in use."
              : version
                ? "Your weekly draft is saved. Review it, then choose Use these weekly priorities."
                : "Your roadmap gives this week a starting focus. Adjust the priorities below or ask us to suggest them."}
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
            This plan was based on an earlier roadmap. Update the draft to bring
            in your current roadmap and schedule, then check that the weekly
            goals still fit.
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
            Update draft from current roadmap
          </button>
        </section>
      )}
      {!initial.editable && (
        <p className="error">
          This copy can’t be edited because it is from an earlier version, the
          week has passed, or its roadmap is no longer in use.{" "}
          <Link href={"/weeks/" + week.id}>
            Open the latest plan for this week
          </Link>
          .
        </p>
      )}
      <section className="card draft-section">
        <h2>What you want to teach this week</h2>
        <p className="small">
          Choose one to three priorities and a sign of progress for each. These
          give your practice plans a clear purpose. Use what you see at practice
          to judge whether they fit the team.
        </p>
        <div className="button-row">
          <button
            disabled={!canEdit || dirty || pending || !!run}
            onClick={() =>
              act(
                () =>
                  beginWeek(
                    week.id,
                    initial.reviewId,
                    context.roadmapId,
                    crypto.randomUUID(),
                  ),
                true,
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
            Preparing your weekly priorities. You can return to this week to
            check progress; the finished draft will be saved for review.
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
          <p className="small">
            Prewritten example to help you try weekly planning. These
            suggestions are not personalized to your team.
          </p>
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
                What progress would look like {i + 1}
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
          Choose which teaching priorities each scheduled practice will work on.
          If you leave a practice unchecked, it has no specific weekly priority
          assigned yet.
        </p>
        {!display.sessions.length && (
          <p>
            No team practices this week. Objectives can guide coach observation
            at competition; no extra sessions are created.
          </p>
        )}
        {display.events.map((e) => (
          <p key={e.id}>
            <strong>{e.type.replaceAll("_", " ")}</strong> · {date(e.start)} to{" "}
            {date(e.end)}
            {e.time ? ` · ${time(e.time)}` : ""}
            {e.blocksPractice ? " · Blocks practice" : ""}
          </p>
        ))}
        {display.sessions.map((s) => (
          <fieldset className="row-card" key={s.id}>
            <legend>
              {date(s.date)} · {time(s.time)} · {s.minutes} min · {s.status}
            </legend>
            {s.override && (
              <p className="small">
                Your note about this schedule change: {s.override}
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
          Change practice dates or explain a schedule exception
        </Link>
      </section>
      <section className="card draft-section">
        <h2>Why this plan fits your week</h2>
        <p>
          Generating weekly objectives produces teaching priorities, signs of
          success to look for, and assignments to your available practices.
          These notes explain those choices and what you should check before
          using the plan. You can edit them to reflect your coaching judgment.
        </p>
        <label>
          Why these priorities?
          <textarea
            aria-describedby="weekly-rationale-help"
            disabled={!canEdit || pending}
            maxLength={600}
            value={content.rationale}
            onChange={(e) => update({ ...content, rationale: e.target.value })}
          />
        </label>
        <p id="weekly-rationale-help" className="small">
          Explain how this week’s objectives support your roadmap goals and fit
          the time available. For example: “With one practice before Saturday’s
          game, revisit spacing rather than introduce a new offense.”
        </p>
        <label>
          Things to confirm (one per line, up to six)
          <textarea
            disabled={!canEdit || pending}
            aria-describedby="weekly-assumptions-help"
            value={content.assumptions.join("\n")}
            onChange={(e) =>
              update({
                ...content,
                assumptions: e.target.value.split("\n").filter(Boolean),
              })
            }
          />
        </label>
        <p id="weekly-assumptions-help" className="small">
          These are assumptions or missing information, not verified facts about
          your players. For example: “Attendance is not confirmed” or “Check
          whether the second hoop is available.” Review each item and update
          your team settings or weekly plan if needed.
        </p>
        <p className="small">
          These notes are saved with this plan and help guide new suggestions if
          you regenerate the weekly priorities. Editing the notes alone doesn’t
          change your goals, practice assignments or team settings. Check them
          again after generating new suggestions.
        </p>
        <p className="small">
          The season goals come from{" "}
          <Link href={"/roadmaps/" + (version?.roadmapId ?? context.roadmapId)}>
            the roadmap this weekly plan follows
          </Link>
          .
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
            Use these weekly priorities
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
                Version {v.number} ·{" "}
                {v.status === "accepted" ? "Chosen for coaching" : "Draft"}
              </Link>
              {v.id === initial.currentId ? " · In use" : ""}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
