"use client";
import {
  useDateFormat,
  useDateText,
  useTimeFormat,
} from "./preferences-provider";
import { TimeInput } from "./time-input";
import Link from "next/link";
import { Overlay } from "./overlay";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  calendarDefaults,
  editsFor,
  type CalendarChange,
  type RoadmapView,
} from "../domain/roadmap";
import {
  previewCalendar,
  recoverRoadmap,
  saveRoadmap,
} from "../server/roadmap/actions";
const historyReasons: Record<string, string> = {
  "Review generated roadmap": "First outline ready for review",
  "Coach accepted roadmap": "You chose this roadmap",
  "Coach edited roadmap": "Your edits saved as a draft",
  "Calendar change preview": "Proposed schedule changes",
};
export function RoadmapEditor({ initial }: { initial: RoadmapView }) {
  const date = useDateFormat();
  const dateText = useDateText();
  const time = useTimeFormat();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<"week" | "phase">("week");
  const { version: v, today } = initial,
    p = v.plan;
  const router = useRouter();
  const [edits, setEdits] = useState(() => editsFor(p)),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(
    p.weeks.find((w) => w.end >= today)?.id ?? p.weeks[0].id,
  );
  const [dates, setDates] = useState({
      start: p.start,
      end: p.end,
      mode: "shift" as "shift" | "keep",
    }),
    [calendar, setCalendar] = useState<CalendarChange | null>(null);
  const editable =
    initial.reviewId === v.id && initial.contextVersion === v.contextVersion;
  const week = p.weeks.find((w) => w.id === selected) ?? p.weeks[0],
    phase = p.phases.find((x) => x.id === week.phaseId)!;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(next: typeof edits) {
    setEdits(next);
    setDirty(true);
  }
  function run(work: () => Promise<{ id?: string; error?: string }>) {
    startTransition(async () => {
      setError("");
      try {
        const result = await work();
        if (result.id) {
          setDirty(false);
          router.push("/roadmaps/" + result.id, { scroll: false });
          router.refresh();
        } else setError(result.error ?? "Unable to save.");
      } catch {
        setError(
          "Connection interrupted. Keep your edits here, then retry or check version history.",
        );
      }
    });
  }
  const save = (accept: boolean) =>
    run(() => saveRoadmap(v.id, edits, crypto.randomUUID(), accept));
  const changeCalendar = (next: CalendarChange) => {
    setCalendar(next);
    setDirty(true);
  };
  const sessions = p.sessions.filter((s) => s.weekId === week.id);
  const active = v.id === initial.currentId;
  return (
    <>
      <p className="eyebrow">
        {active
          ? "ROADMAP IN USE"
          : v.status === "accepted"
            ? "PREVIOUSLY USED ROADMAP"
            : "ROADMAP REVIEW"}{" "}
        · VERSION {v.number}
      </p>
      <h1>
        {active
          ? "Your season, with a clear next step."
          : "Review your season roadmap."}
      </h1>
      <p>
        {date(p.start)} to {date(p.end)} · {p.timezone} · {p.weeks.length}{" "}
        teaching weeks ·{" "}
        {p.sessions.filter((s) => s.status === "scheduled").length} scheduled
        sessions
      </p>
      <p role="status">
        {pending
          ? "Saving your review…"
          : dirty
            ? "Unsaved changes — save before leaving this page."
            : active
              ? "You’re using this roadmap to guide your practice plans. You can still adjust future weeks as your team develops."
              : "Review what your team will work on each week. Edit anything that doesn’t fit, then choose Use this roadmap to begin planning practices."}
      </p>
      {error && (
        <p role="alert" className="error">
          {dateText(error)}
        </p>
      )}
      {!editable && (
        <p className="error">
          This copy is from an earlier review or uses older team settings.{" "}
          <Link
            href={
              "/roadmaps/" + (initial.reviewId ?? initial.currentId ?? v.id)
            }
          >
            Open the latest review
          </Link>{" "}
          or reuse its teaching ideas from Saved versions below.
        </p>
      )}
      {!!initial.conflicts.length && (
        <section className="card draft-section" role="alert">
          <h2>Check these dates before using this roadmap</h2>
          <ul>
            {initial.conflicts.map((x, i) => (
              <li key={i}>{dateText(x)}</li>
            ))}
          </ul>
          <p>
            Open Change dates or practice availability below to move or cancel
            affected practices, adjust weeks or edit events. The schedule you’re
            currently using has not changed.
          </p>
        </section>
      )}
      {editable && (
        <div className="save-bar button-row review-actions">
          <p>
            {dirty
              ? "Unsaved review edits"
              : active
                ? "Your roadmap is in use."
                : "Scan, adjust, then use your roadmap"}
          </p>
          {active && !dirty ? (
            <Link className="button-link" href={"/weeks/" + week.id}>
              Plan practice →
            </Link>
          ) : (
            <>
              <button
                disabled={pending || calendar !== null}
                onClick={() => save(false)}
              >
                Save draft edits
              </button>
              <button
                disabled={
                  pending || calendar !== null || initial.conflicts.length > 0
                }
                onClick={() => save(true)}
              >
                Use this roadmap
              </button>
            </>
          )}
        </div>
      )}
      <section className="week-board" aria-labelledby="week-board-title">
        <h2 id="week-board-title" className="board-title">
          Your season at a glance
        </h2>
        <p className="small">
          Each card shows what to teach and a sign of progress to watch for.
          Select any week to edit it without losing your place. Choose Use this
          roadmap when the outline fits your team; you don’t need to open every
          card.
        </p>
        {p.phases.map((group) => (
          <section className="week-phase" key={group.id}>
            <h3 className="eyebrow">
              {group.type.replaceAll("_", " ")} · {date(group.start)} to{" "}
              {date(group.end)}
            </h3>
            <div className="week-grid">
              {p.weeks
                .filter((w) => w.phaseId === group.id)
                .map((w) => {
                  const draft = edits.weeks.find((x) => x.id === w.id)!;
                  const count = p.sessions.filter(
                    (s) => s.weekId === w.id && s.status === "scheduled",
                  ).length;
                  return (
                    <button
                      type="button"
                      className="week-card week-select"
                      key={w.id}
                      aria-label={`Review week ${p.weeks.indexOf(w) + 1}`}
                      aria-pressed={selected === w.id}
                      aria-haspopup="dialog"
                      onClick={() => {
                        setSelected(w.id);
                        setEditorTab("week");
                        setEditorOpen(true);
                      }}
                    >
                      <span className="week-card-heading">
                        Week {p.weeks.indexOf(w) + 1}
                      </span>
                      <span className="small">
                        {date(w.start)} → {date(w.end)}
                      </span>
                      <span className="week-badges">
                        <span>{count} scheduled</span>
                        {draft.locked && <span>Locked</span>}
                        {w.start <= today && w.end >= today && (
                          <span>This week</span>
                        )}
                        {w.end < today && <span>Past</span>}
                      </span>
                      <span className="week-emphasis">{draft.emphasis}</span>
                      <span className="week-checkpoint">
                        <strong>What to look for</strong>
                        {draft.checkpoint}
                      </span>
                      <span className="week-open">
                        {selected === w.id
                          ? "Selected · review week"
                          : "Review week →"}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </section>
      <section className="card draft-section">
        <h2>Plan a practice for your selected week</h2>
        <p>
          <strong>
            {date(week.start)} to {date(week.end)}:
          </strong>{" "}
          {week.emphasis}
        </p>
        <p>Watch for: {week.checkpoint}</p>
        <p>Why: {phase.rationale}</p>
        {active && (
          <Link className="button-link" href={"/weeks/" + week.id}>
            Prepare this week’s practice
          </Link>
        )}
        <p className="small">
          Choose a week above. Once you’re using this roadmap, we can turn that
          week’s priorities into timed activities and instructions for each
          scheduled practice.
        </p>
      </section>
      <details className="card draft-section planning-disclosure">
        <summary>Why this roadmap fits your team</summary>
        <p>
          These notes explain the suggested teaching order and the details to
          confirm. Edit them if your understanding of the team changes. Saving
          these notes alone does not rewrite the weekly priorities.
        </p>
        <label>
          Why these priorities and this order?
          <textarea
            maxLength={600}
            disabled={!editable || calendar !== null || pending}
            value={edits.rationale}
            onChange={(e) => update({ ...edits, rationale: e.target.value })}
          />
        </label>
        <label>
          Things to confirm (one per line, up to six)
          <textarea
            disabled={!editable || calendar !== null || pending}
            value={edits.assumptions.join("\n")}
            onChange={(e) =>
              update({
                ...edits,
                assumptions: e.target.value.split("\n").filter(Boolean),
              })
            }
          />
        </label>
        {v.generationId && (
          <Link href={"/drafts/" + v.generationId + "?source=1"}>
            See the original outline and the team notes behind it
          </Link>
        )}
        <p className="small">
          Use what you see at practice to check whether these suggestions fit.
          Your plan describes what to teach; it doesn’t measure what players can
          already do.
        </p>
      </details>
      <Overlay
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={`Review week ${p.weeks.indexOf(week) + 1}`}
      >
        <p className="small">
          Closing this window keeps your edits on this page. Choose Save draft
          edits to save them for later, or Use this roadmap to make the updated
          outline the one your practice planning follows.
        </p>
        <div className="button-row">
          <button
            className="secondary"
            disabled={p.weeks.indexOf(week) === 0}
            onClick={() => setSelected(p.weeks[p.weeks.indexOf(week) - 1].id)}
          >
            Previous week
          </button>
          <button
            className="secondary"
            disabled={p.weeks.indexOf(week) === p.weeks.length - 1}
            onClick={() => setSelected(p.weeks[p.weeks.indexOf(week) + 1].id)}
          >
            Next week
          </button>
          <button
            className="secondary"
            aria-pressed={editorTab === "week"}
            onClick={() => setEditorTab("week")}
          >
            Week details
          </button>
          <button
            className="secondary"
            aria-pressed={editorTab === "phase"}
            onClick={() => setEditorTab("phase")}
          >
            Phase priorities
          </button>
        </div>
        <nav className="button-row" aria-label="Phases">
          {p.phases.map((x) => (
            <button
              className="secondary"
              key={x.id}
              onClick={() =>
                setSelected(p.weeks.find((w) => w.phaseId === x.id)!.id)
              }
              aria-pressed={x.id === phase.id}
            >
              {x.type.replaceAll("_", " ")}
            </button>
          ))}
        </nav>
        <label>
          Teaching week
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {p.weeks.map((w, i) => (
              <option key={w.id} value={w.id}>
                Week {i + 1}: {date(w.start)} to {date(w.end)}
                {w.locked ? " · locked" : ""}
              </option>
            ))}
          </select>
        </label>
        {editorTab === "phase" && (
          <>
            <h3>
              {phase.type.replaceAll("_", " ")} · {date(phase.start)} to{" "}
              {date(phase.end)}
            </h3>
            <label>
              Why this phase?
              <textarea
                disabled={!editable || calendar !== null || pending}
                maxLength={600}
                value={edits.phases.find((x) => x.id === phase.id)!.rationale}
                onChange={(e) =>
                  update({
                    ...edits,
                    phases: edits.phases.map((x) =>
                      x.id === phase.id
                        ? { ...x, rationale: e.target.value }
                        : x,
                    ),
                  })
                }
              />
            </label>
            <h3>Phase goals</h3>
            {p.goals
              .filter((g) => g.phaseId === phase.id)
              .map((g, i) => {
                const draft = edits.goals.find((x) => x.id === g.id)!;
                return (
                  <fieldset className="row-card" key={g.id}>
                    <legend>
                      Goal {i + 1}
                      {g.locked ? " · locked" : ""}
                    </legend>
                    <label>
                      Goal description
                      <textarea
                        maxLength={600}
                        disabled={
                          !editable || calendar !== null || pending || g.locked
                        }
                        value={draft.description}
                        onChange={(e) =>
                          update({
                            ...edits,
                            goals: edits.goals.map((x) =>
                              x.id === g.id
                                ? { ...x, description: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      What progress would look like
                      <textarea
                        maxLength={600}
                        disabled={
                          !editable || calendar !== null || pending || g.locked
                        }
                        value={draft.successCriteria}
                        onChange={(e) =>
                          update({
                            ...edits,
                            goals: edits.goals.map((x) =>
                              x.id === g.id
                                ? { ...x, successCriteria: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.locked}
                        disabled={!editable || calendar !== null || pending}
                        onChange={(e) =>
                          update({
                            ...edits,
                            goals: edits.goals.map((x) =>
                              x.id === g.id
                                ? { ...x, locked: e.target.checked }
                                : x,
                            ),
                          })
                        }
                      />
                      Lock this goal and its progress check
                    </label>
                  </fieldset>
                );
              })}
          </>
        )}
        {editorTab === "week" && (
          <>
            <h3>
              Week {p.weeks.indexOf(week) + 1} · {date(week.start)} to{" "}
              {date(week.end)}
            </h3>
            <p className="small">
              Lock a week to keep its teaching focus and progress check from
              changing. To edit a locked week in the roadmap you use, uncheck
              the lock and choose Use this roadmap first. Calendar changes are
              reviewed separately.
            </p>
            <label>
              What to teach this week
              <textarea
                maxLength={600}
                disabled={
                  !editable ||
                  calendar !== null ||
                  pending ||
                  week.locked ||
                  week.start < today
                }
                value={edits.weeks.find((x) => x.id === week.id)!.emphasis}
                onChange={(e) =>
                  update({
                    ...edits,
                    weeks: edits.weeks.map((x) =>
                      x.id === week.id ? { ...x, emphasis: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <label>
              What progress to look for this week
              <textarea
                maxLength={600}
                disabled={
                  !editable ||
                  calendar !== null ||
                  pending ||
                  week.locked ||
                  week.start < today
                }
                value={edits.weeks.find((x) => x.id === week.id)!.checkpoint}
                onChange={(e) =>
                  update({
                    ...edits,
                    weeks: edits.weeks.map((x) =>
                      x.id === week.id
                        ? { ...x, checkpoint: e.target.value }
                        : x,
                    ),
                  })
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                disabled={
                  !editable ||
                  calendar !== null ||
                  pending ||
                  week.start < today
                }
                checked={edits.weeks.find((x) => x.id === week.id)!.locked}
                onChange={(e) =>
                  update({
                    ...edits,
                    weeks: edits.weeks.map((x) =>
                      x.id === week.id ? { ...x, locked: e.target.checked } : x,
                    ),
                  })
                }
              />
              Lock this week&apos;s focus and progress check
            </label>
            <h3>This week&apos;s calendar</h3>
            {sessions.length ? (
              <ul>
                {sessions.map((s) => (
                  <li key={s.id}>
                    {date(s.date)} · {time(s.time)} · {s.minutes} minutes ·{" "}
                    {s.status}
                    {s.override ? " · schedule note: " + s.override : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No practice is scheduled this week. The weekly focus can still
                help you notice progress during games.
              </p>
            )}
            {p.events
              .filter((e) => e.start <= week.end && e.end >= week.start)
              .map((e) => (
                <p key={e.id}>
                  {e.type} · {e.title || "Untitled event"} · {date(e.start)} to{" "}
                  {date(e.end)}
                  {e.blocksPractice ? " · blocks practice" : ""}
                </p>
              ))}
          </>
        )}
        <button onClick={() => setEditorOpen(false)}>
          Keep edits &amp; close
        </button>
      </Overlay>
      {editable && (
        <details
          className="card draft-section planning-disclosure"
          id="calendar-review"
        >
          <summary>Change dates or practice availability</summary>
          <p>
            See how a date change affects future weeks and practices before
            using the new schedule. Past and completed practices stay in place.
            Games and tournaments keep their dates unless you edit them here.
            Save any teaching edits before starting a date preview.
          </p>
          <div className="field-grid">
            <label>
              New season start
              <input
                type="date"
                value={dates.start}
                onChange={(e) => setDates({ ...dates, start: e.target.value })}
              />
            </label>
            <label>
              New season end
              <input
                type="date"
                value={dates.end}
                onChange={(e) => setDates({ ...dates, end: e.target.value })}
              />
            </label>
          </div>
          <label>
            When the start changes
            <select
              value={dates.mode}
              onChange={(e) =>
                setDates({ ...dates, mode: e.target.value as "shift" | "keep" })
              }
            >
              <option value="shift">
                Move future weeks and practices by the same number of days
              </option>
              <option value="keep">Keep existing plan dates</option>
            </select>
          </label>
          <button
            className="secondary"
            disabled={pending || dirty || !dates.start || !dates.end}
            onClick={() => {
              try {
                setCalendar(
                  calendarDefaults(
                    p,
                    dates.start,
                    dates.end,
                    dates.mode,
                    today,
                  ),
                );
                setDirty(true);
              } catch {
                setError("Enter valid season dates.");
              }
            }}
          >
            Prepare date preview
          </button>
          {calendar && (
            <div>
              <p role="status">
                This is a preview. Check the affected weeks and practices, then
                choose Save calendar preview. Your current schedule changes only
                when you choose Use this roadmap on the saved preview.
              </p>
              <details>
                <summary>When your regular practice schedule applies</summary>
                {calendar.availability.map((r, i) => (
                  <div className="row-card" key={r.id ?? i}>
                    <p>
                      Weekday {r.weekday} · {time(r.time)} · {r.minutes} minutes
                    </p>
                    <label>
                      Available from (blank means season start)
                      <input
                        type="date"
                        value={r.start ?? ""}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            availability: calendar.availability.map((x, j) =>
                              i === j
                                ? { ...x, start: e.target.value || null }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Available through (blank means season end)
                      <input
                        type="date"
                        value={r.end ?? ""}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            availability: calendar.availability.map((x, j) =>
                              i === j
                                ? { ...x, end: e.target.value || null }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
              </details>
              <details open>
                <summary>Phase dates</summary>
                {calendar.phases.map((x, i) => (
                  <div className="row-card" key={x.id}>
                    <h3>{p.phases[i].type.replaceAll("_", " ")}</h3>
                    <label>
                      Phase start
                      <input
                        type="date"
                        value={x.start}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            phases: calendar.phases.map((y) =>
                              y.id === x.id
                                ? { ...y, start: e.target.value }
                                : y,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Phase end
                      <input
                        type="date"
                        value={x.end}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            phases: calendar.phases.map((y) =>
                              y.id === x.id ? { ...y, end: e.target.value } : y,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
              </details>
              <details>
                <summary>Adjust or remove future weeks</summary>
                <p>
                  If you shorten the season, choose where affected weeks belong
                  or select Remove. If you add dates, any new weeks will need
                  teaching priorities before they’re ready to use.
                </p>
                {calendar.weeks.map((x, i) => {
                  const old = p.weeks.find((w) => w.id === x.id)!;
                  return (
                    <div className="row-card" key={x.id}>
                      <h3>
                        Week {i + 1}: {old.emphasis}
                      </h3>
                      <p>
                        Was {date(old.start)} to {date(old.end)}
                      </p>
                      <label>
                        Week start
                        <input
                          type="date"
                          value={x.start}
                          disabled={old.start < today}
                          onChange={(e) =>
                            changeCalendar({
                              ...calendar,
                              weeks: calendar.weeks.map((y) =>
                                y.id === x.id
                                  ? { ...y, start: e.target.value }
                                  : y,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Week end
                        <input
                          type="date"
                          value={x.end}
                          disabled={old.start < today}
                          onChange={(e) =>
                            changeCalendar({
                              ...calendar,
                              weeks: calendar.weeks.map((y) =>
                                y.id === x.id
                                  ? { ...y, end: e.target.value }
                                  : y,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={x.remove}
                          disabled={old.start < today || old.locked}
                          onChange={(e) =>
                            changeCalendar({
                              ...calendar,
                              weeks: calendar.weeks.map((y) =>
                                y.id === x.id
                                  ? { ...y, remove: e.target.checked }
                                  : y,
                              ),
                            })
                          }
                        />
                        Remove this future week from the new outline
                      </label>
                    </div>
                  );
                })}
              </details>
              <details>
                <summary>Move or cancel practices</summary>
                {calendar.sessions.map((x) => {
                  const old = p.sessions.find((s) => s.id === x.id)!;
                  const fixed = old.date < today || old.status !== "scheduled";
                  return (
                    <fieldset className="row-card" key={x.id} disabled={fixed}>
                      <legend>
                        {date(old.date)} {time(old.time)} · {old.status}
                        {fixed ? " · saved history, cannot move" : ""}
                      </legend>
                      <label>
                        Practice date
                        <input
                          type="date"
                          value={x.date}
                          onChange={(e) =>
                            changeCalendar({
                              ...calendar,
                              sessions: calendar.sessions.map((y) =>
                                y.id === x.id
                                  ? { ...y, date: e.target.value }
                                  : y,
                              ),
                            })
                          }
                        />
                      </label>
                      <TimeInput
                        label="Practice start time"
                        required
                        value={x.time}
                        onChange={(value) =>
                          changeCalendar({
                            ...calendar,
                            sessions: calendar.sessions.map((y) =>
                              y.id === x.id ? { ...y, time: value } : y,
                            ),
                          })
                        }
                      />
                      <label>
                        Outside your usual practice schedule? Add a reason
                        <input
                          maxLength={200}
                          value={x.override}
                          onChange={(e) =>
                            changeCalendar({
                              ...calendar,
                              sessions: calendar.sessions.map((y) =>
                                y.id === x.id
                                  ? { ...y, override: e.target.value }
                                  : y,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={x.cancel}
                          onChange={(e) =>
                            changeCalendar({
                              ...calendar,
                              sessions: calendar.sessions.map((y) =>
                                y.id === x.id
                                  ? { ...y, cancel: e.target.checked }
                                  : y,
                              ),
                            })
                          }
                        />
                        Cancel this practice (keep its history)
                      </label>
                    </fieldset>
                  );
                })}
              </details>
              <details>
                <summary>Fixed games, tournaments & unavailable dates</summary>
                <p>
                  These events keep their dates when you move the season. Edit
                  an event here only if its date or details have changed.
                </p>
                {calendar.events.map((x) => (
                  <fieldset className="row-card" key={x.id}>
                    <legend>{x.title || x.type}</legend>
                    <label>
                      Event title
                      <input
                        maxLength={100}
                        value={x.title}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            events: calendar.events.map((y) =>
                              y.id === x.id
                                ? { ...y, title: e.target.value }
                                : y,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Event type
                      <select
                        value={x.type}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            events: calendar.events.map((y) =>
                              y.id === x.id
                                ? {
                                    ...y,
                                    type: e.target.value as typeof x.type,
                                  }
                                : y,
                            ),
                          })
                        }
                      >
                        <option value="game">Game</option>
                        <option value="tournament">Tournament</option>
                        <option value="unavailable">Unavailable</option>
                      </select>
                    </label>
                    <label>
                      Event start
                      <input
                        type="date"
                        value={x.start}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            events: calendar.events.map((y) =>
                              y.id === x.id
                                ? { ...y, start: e.target.value }
                                : y,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Event end
                      <input
                        type="date"
                        value={x.end}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            events: calendar.events.map((y) =>
                              y.id === x.id ? { ...y, end: e.target.value } : y,
                            ),
                          })
                        }
                      />
                    </label>
                    <TimeInput
                      label="Event start time (blank for all day)"
                      value={x.time}
                      onChange={(value) =>
                        changeCalendar({
                          ...calendar,
                          events: calendar.events.map((y) =>
                            y.id === x.id ? { ...y, time: value } : y,
                          ),
                        })
                      }
                    />
                    <TimeInput
                      label="Event end time"
                      value={x.endTime}
                      onChange={(value) =>
                        changeCalendar({
                          ...calendar,
                          events: calendar.events.map((y) =>
                            y.id === x.id ? { ...y, endTime: value } : y,
                          ),
                        })
                      }
                    />
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={x.blocksPractice}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            events: calendar.events.map((y) =>
                              y.id === x.id
                                ? { ...y, blocksPractice: e.target.checked }
                                : y,
                            ),
                          })
                        }
                      />
                      Blocks practice
                    </label>
                    <button
                      className="secondary"
                      onClick={() =>
                        changeCalendar({
                          ...calendar,
                          events: calendar.events.filter((y) => y.id !== x.id),
                        })
                      }
                    >
                      Remove this event
                    </button>
                  </fieldset>
                ))}
                <button
                  className="secondary"
                  disabled={calendar.events.length >= 30}
                  onClick={() =>
                    changeCalendar({
                      ...calendar,
                      events: [
                        ...calendar.events,
                        {
                          id: crypto.randomUUID(),
                          title: "",
                          type: "tournament",
                          start: calendar.start,
                          end: calendar.start,
                          time: "",
                          endTime: "",
                          blocksPractice: true,
                        },
                      ],
                    })
                  }
                >
                  Add calendar event
                </button>
              </details>
              <div className="button-row">
                <button
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      previewCalendar(v.id, calendar, crypto.randomUUID()),
                    )
                  }
                >
                  Save calendar preview
                </button>
                <button
                  className="secondary"
                  disabled={pending}
                  onClick={() => {
                    setCalendar(null);
                    setDirty(false);
                  }}
                >
                  Discard unsaved calendar preview
                </button>
              </div>
            </div>
          )}
        </details>
      )}
      <details className="card draft-section planning-disclosure">
        <summary>Saved versions & reuse an earlier plan</summary>
        <p>
          Reuse teaching ideas from this saved version in a new draft with your
          current dates and events. Locked content and past weeks stay
          protected. Your saved versions remain available, and your current
          roadmap stays in use until you choose the new one.
        </p>
        <button
          className="secondary"
          disabled={pending || dirty}
          onClick={() =>
            run(() =>
              recoverRoadmap(
                v.id,
                initial.currentId,
                initial.reviewId,
                crypto.randomUUID(),
              ),
            )
          }
        >
          Reuse version {v.number} as a new draft
        </button>
        <ul>
          {initial.history.map((h) => (
            <li key={h.id}>
              <Link href={"/roadmaps/" + h.id}>Version {h.number}</Link> ·{" "}
              {h.status === "accepted" ? "Chosen for coaching" : "Draft"} ·{" "}
              {historyReasons[h.reason] ??
                h.reason.replace(
                  "Recovered teaching content from version",
                  "Teaching ideas reused from version",
                )}
              {h.id === initial.currentId ? " · In use" : ""}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
