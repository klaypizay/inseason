"use client";
import { useDateFormat, useDateText } from "./preferences-provider";
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
export function RoadmapEditor({ initial }: { initial: RoadmapView }) {
  const date = useDateFormat();
  const dateText = useDateText();
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
          ? "ACTIVE ROADMAP"
          : v.status === "accepted"
            ? "ACCEPTED HISTORY"
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
              ? "This accepted version is saved and active."
              : "Saved version. Review each week, then accept to use this roadmap for weekly planning."}
      </p>
      {error && (
        <p role="alert" className="error">
          {dateText(error)}
        </p>
      )}
      {!editable && (
        <p className="error">
          This is a historical or stale review.{" "}
          <Link
            href={
              "/roadmaps/" + (initial.reviewId ?? initial.currentId ?? v.id)
            }
          >
            Open the latest review
          </Link>{" "}
          or recover its teaching content below.
        </p>
      )}
      {!!initial.conflicts.length && (
        <section className="card draft-section" role="alert">
          <h2>Resolve before acceptance</h2>
          <ul>
            {initial.conflicts.map((x, i) => (
              <li key={i}>{dateText(x)}</li>
            ))}
          </ul>
          <p>
            Open calendar review below to reschedule or cancel affected
            sessions, reassign teaching weeks, or individually edit fixed
            events. Nothing has moved in the active plan.
          </p>
        </section>
      )}
      {editable && (
        <div className="save-bar button-row review-actions">
          <p>
            {dirty ? "Unsaved review edits" : "Review each week, then accept"}
          </p>
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
            Accept roadmap
          </button>
        </div>
      )}
      <section className="week-board" aria-labelledby="week-board-title">
        <h2 id="week-board-title" className="board-title">
          Your season at a glance
        </h2>
        <p className="small">
          Review each phase and week before accepting. Select a card to edit in
          a popup without losing your place. Cards reflect your unsaved edits.
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
                        <strong>Checkpoint</strong>
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
        <h2>What comes next</h2>
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
            Plan this week
          </Link>
        )}
        <p className="small">
          Choose a week above, then detail its teaching objectives and practice
          assignments.
        </p>
      </section>
      <section className="card draft-section">
        <h2>Why this plan?</h2>
        <label>
          Roadmap explanation
          <textarea
            maxLength={600}
            disabled={!editable || calendar !== null || pending}
            value={edits.rationale}
            onChange={(e) => update({ ...edits, rationale: e.target.value })}
          />
        </label>
        <label>
          Planning assumptions (one per line, up to six)
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
          <Link href={"/drafts/" + v.generationId}>
            Read the original generated draft and source context
          </Link>
        )}
        <p className="small">
          Edited teaching text is a coach recommendation, not a new observation
          about a player.
        </p>
      </section>
      <Overlay
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={`Review week ${p.weeks.indexOf(week) + 1}`}
      >
        <p className="small">
          Changes stay in this review when you close. Save draft edits or accept
          the roadmap to save them.
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
                      Observable success criteria
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
                      Lock goal text and success criteria
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
              A lock protects teaching content. Date moves still require
              calendar review. Save and accept an unlock before editing
              protected text in an active plan.
            </p>
            <label>
              Weekly emphasis
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
              Weekly checkpoint
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
              Lock this week&apos;s teaching content
            </label>
            <h3>This week&apos;s calendar</h3>
            {sessions.length ? (
              <ul>
                {sessions.map((s) => (
                  <li key={s.id}>
                    {date(s.date)} · {s.time} · {s.minutes} minutes · {s.status}
                    {s.override ? " · coach override: " + s.override : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No team practice this week. Rest or competition does not imply
                an extra practice.
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
        <section className="card draft-section">
          <h2 id="calendar-review">Review calendar changes</h2>
          <p>
            Preview future moves before accepting. Past/completed sessions stay
            fixed. Games and tournaments keep their dates unless you edit them
            individually. Save teaching edits before opening this review.
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
                Shift eligible future plan dates by the same interval
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
                Proposed changes only. Review each affected item, then save this
                preview. Acceptance is a separate step.
              </p>
              <details>
                <summary>Regular availability effective dates</summary>
                {calendar.availability.map((r, i) => (
                  <div className="row-card" key={r.id ?? i}>
                    <p>
                      Weekday {r.weekday} · {r.time} · {r.minutes} minutes
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
                <summary>Teaching week dates & explicit removals</summary>
                <p>
                  Shortening never silently discards teaching content. Reassign
                  affected dates or select Remove. Uncovered dates get a new
                  week marked for coach planning.
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
                        Explicitly remove this future teaching week
                      </label>
                    </div>
                  );
                })}
              </details>
              <details>
                <summary>Session moves, cancellations & overrides</summary>
                {calendar.sessions.map((x) => {
                  const old = p.sessions.find((s) => s.id === x.id)!;
                  const fixed = old.date < today || old.status !== "scheduled";
                  return (
                    <fieldset className="row-card" key={x.id} disabled={fixed}>
                      <legend>
                        {date(old.date)} {old.time} · {old.status}
                        {fixed ? " · fixed history" : ""}
                      </legend>
                      <label>
                        Session date
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
                      <label>
                        Session time
                        <input
                          type="time"
                          value={x.time}
                          onChange={(e) =>
                            changeCalendar({
                              ...calendar,
                              sessions: calendar.sessions.map((y) =>
                                y.id === x.id
                                  ? { ...y, time: e.target.value }
                                  : y,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Outside regular availability? Explain the coach override
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
                        Cancel this session (keep history)
                      </label>
                    </fieldset>
                  );
                })}
              </details>
              <details>
                <summary>Fixed games, tournaments & unavailable dates</summary>
                <p>
                  These dates do not shift automatically. Changes below
                  explicitly edit the selected event.
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
                    <label>
                      Event start time (blank for all day)
                      <input
                        type="time"
                        value={x.time}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            events: calendar.events.map((y) =>
                              y.id === x.id
                                ? { ...y, time: e.target.value }
                                : y,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Event end time
                      <input
                        type="time"
                        value={x.endTime}
                        onChange={(e) =>
                          changeCalendar({
                            ...calendar,
                            events: calendar.events.map((y) =>
                              y.id === x.id
                                ? { ...y, endTime: e.target.value }
                                : y,
                            ),
                          })
                        }
                      />
                    </label>
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
        </section>
      )}
      <section className="card draft-section">
        <h2>Version history</h2>
        <p>
          Recovery creates a new review using current dates and events. Locked
          content and past weeks stay protected. It never erases an accepted
          version.
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
          Recover version {v.number} as a new draft
        </button>
        <ul>
          {initial.history.map((h) => (
            <li key={h.id}>
              <Link href={"/roadmaps/" + h.id}>Version {h.number}</Link> ·{" "}
              {h.status} · {h.reason}
              {h.id === initial.currentId ? " · active" : ""}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
