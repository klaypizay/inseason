"use client";
import { TimeInput } from "./time-input";
import { useDateFormat } from "./preferences-provider";
import {
  useEffect,
  useId,
  cloneElement,
  useState,
  useTransition,
  type ReactElement,
} from "react";
import {
  reportFields,
  type ReportField,
  type Setup,
  type SetupView,
} from "../domain/onboarding";
import { saveSetup } from "../server/onboarding/actions";

const steps = [
  "Coach & team",
  "Season",
  "Practice schedule",
  "Events schedule",
  "Players (optional)",
  "Team notes & finish",
];
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="setup-field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
export function SetupForm({
  initial,
  mode = "full",
  onDirtyChange,
  onPendingChange,
}: {
  initial: SetupView;
  mode?: "full" | "coach" | "team";
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const date = useDateFormat();
  const [view, setView] = useState(initial);
  const [data, setData] = useState(initial.data);
  const [step, setStep] = useState(0);
  const visibleStep = mode === "coach" ? 0 : step;
  const labels = steps.map((label, i) =>
    i === 0 && mode === "team" ? "Team" : label,
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function change<K extends keyof Setup>(key: K, value: Setup[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setMessage("");
    setError("");
  }
  function report(field: ReportField, options?: string[]) {
    const source = view.sources.find((s) => s.field === field);
    return (
      <div key={field}>
        <Field label={reportFields[field]}>
          {options ? (
            <select
              value={data.reports[field]}
              onChange={(e) =>
                change("reports", { ...data.reports, [field]: e.target.value })
              }
            >
              <option value="">Not sure yet</option>
              {options.map((o) => (
                <option key={o}>{o}</option>
              ))}
              {data.reports[field] &&
                !options.includes(data.reports[field]) && (
                  <option>{data.reports[field]}</option>
                )}
            </select>
          ) : (
            <textarea
              rows={3}
              maxLength={600}
              value={data.reports[field]}
              placeholder="A few words are enough. Leave blank if you’re still getting to know the team."
              onChange={(e) =>
                change("reports", { ...data.reports, [field]: e.target.value })
              }
            />
          )}
        </Field>
        <p className="small">
          {data.reports[field]
            ? "Based on what you’ve shared"
            : "You can add this later"}
          {source && !dirty ? " · Saved " + date(source.reportedAt) : ""}
        </p>
      </div>
    );
  }
  function save(complete: boolean, next = false) {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await saveSetup(JSON.stringify({ ...data, complete }));
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.view) {
          setView(result.view);
          setData(result.view.data);
          setDirty(false);
          setMessage(
            mode !== "full"
              ? "Saved. Your coach and team settings are up to date."
              : complete
                ? "Setup saved. Open Season roadmap to create your team’s week-by-week outline."
                : "Saved. You can safely leave and resume later.",
          );
          if (next) setStep((s) => Math.min(steps.length - 1, s + 1));
        }
      } catch {
        setError(
          "Connection interrupted. Your edits are still here. Try saving again.",
        );
      }
    });
  }
  const input = (key: "teamName" | "title" | "timezone", label: string) => (
    <Field label={label}>
      <input
        value={data[key]}
        maxLength={100}
        onChange={(e) => change(key, e.target.value)}
      />
    </Field>
  );
  const number = (key: "playerCount" | "hoops", label: string, max: number) => (
    <Field label={label}>
      <input
        type="number"
        min={key === "hoops" ? 0 : 1}
        max={max}
        value={data[key] ?? ""}
        placeholder="Unknown"
        onChange={(e) =>
          change(key, e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </Field>
  );
  return (
    <div className="setup-layout">
      <nav
        hidden={mode === "coach"}
        className="setup-steps"
        aria-label="Setup steps"
      >
        {labels.map((label, i) => (
          <button
            type="button"
            className={i === step ? "" : "secondary"}
            aria-current={i === step ? "step" : undefined}
            key={label}
            disabled={pending}
            onClick={() => setStep(i)}
          >
            {i + 1}. {label}
          </button>
        ))}
      </nav>
      <form
        className="card setup-card"
        onSubmit={(e) => {
          e.preventDefault();
          save(data.complete);
        }}
        noValidate
      >
        <fieldset disabled={pending}>
          <legend>
            {mode === "coach" ? "Coaching profile" : labels[step]}
          </legend>
          {visibleStep === 0 && (
            <>
              {mode !== "team" && (
                <>
                  {report("experience", [
                    "First year",
                    "1–3 years",
                    "4+ years",
                  ])}
                  {report("guidance", [
                    "Step-by-step explanations",
                    "Some guidance",
                    "Brief reminders",
                  ])}
                  {report("philosophy")}
                </>
              )}
              {mode !== "coach" && (
                <>
                  <p>
                    Share what you’d like the team to learn. We’ll use your
                    answers to shape the goals, activities and level of guidance
                    in your plans. Player names are optional; use made-up names
                    while trying this preview.
                  </p>
                  {input("teamName", "Team name")}
                  {report("teamType", ["School", "Recreation", "AAU", "Other"])}
                  {report("ageBand", [
                    "8U",
                    "9U",
                    "10U",
                    "11U",
                    "12U",
                    "13U",
                    "14U",
                    "15U",
                    "16U",
                    "17U",
                    "18U",
                  ])}
                  {report("skill", [
                    "New to basketball",
                    "Developing fundamentals",
                    "Mixed experience",
                    "Experienced",
                  ])}
                  {report("goals")}
                </>
              )}
            </>
          )}
          {visibleStep === 1 && (
            <>
              {input("title", "Season name")}
              <div className="field-grid">
                <Field label="Season start">
                  <input
                    type="date"
                    value={data.start ?? ""}
                    onChange={(e) => change("start", e.target.value || null)}
                  />
                </Field>
                <Field label="Last day of the season">
                  <input
                    type="date"
                    value={data.end ?? ""}
                    onChange={(e) => change("end", e.target.value || null)}
                  />
                </Field>
                {input("timezone", "Timezone")}
                <Field label="Week begins">
                  <select
                    value={data.weekStart}
                    onChange={(e) =>
                      change("weekStart", Number(e.target.value))
                    }
                  >
                    {weekdays.map((d, i) => (
                      <option value={i} key={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="small">
                Enter your time zone as a city-based name, such as
                America/Chicago or Europe/London. All practice times use this
                time zone.
              </p>
              <h3>Season phases</h3>
              <p>
                Phases are parts of your season, such as preparation before
                games begin and the main playing season. Keep it simple with one
                phase for the whole season, or add separate phases if your goals
                change during the year.
              </p>
              {!data.phases.length && (
                <button
                  type="button"
                  className="secondary"
                  disabled={!data.start || !data.end}
                  onClick={() =>
                    change("phases", [
                      { type: "in_season", start: data.start!, end: data.end! },
                    ])
                  }
                >
                  Use one phase for the whole season
                </button>
              )}
              {data.phases.map((p, i) => (
                <div className="row-card" key={p.id ?? i}>
                  <h4>Phase {i + 1}</h4>
                  <div className="field-grid">
                    <Field label="Phase type">
                      <select
                        value={p.type}
                        onChange={(e) =>
                          change(
                            "phases",
                            data.phases.map((r, j) =>
                              j === i
                                ? {
                                    ...r,
                                    type: e.target.value as typeof p.type,
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        {[
                          "offseason",
                          "preseason",
                          "in_season",
                          "postseason",
                        ].map((t) => (
                          <option key={t} value={t}>
                            {t.replace("_", "-")}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {(["start", "end"] as const).map((k) => (
                      <Field key={k} label={"Phase " + k}>
                        <input
                          type="date"
                          value={p[k]}
                          onChange={(e) =>
                            change(
                              "phases",
                              data.phases.map((r, j) =>
                                j === i ? { ...r, [k]: e.target.value } : r,
                              ),
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      change(
                        "phases",
                        data.phases.filter((_, j) => i !== j),
                      )
                    }
                  >
                    Remove phase {i + 1}
                  </button>
                </div>
              ))}
              {data.phases.length < 12 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    change("phases", [
                      ...data.phases,
                      {
                        type: "preseason",
                        start: data.start ?? "",
                        end: data.end ?? "",
                      },
                    ])
                  }
                >
                  Add phase
                </button>
              )}
            </>
          )}
          {visibleStep === 2 && (
            <>
              <div className="field-grid">
                {number("playerCount", "Approximate player count", 50)}
                {number("hoops", "Hoops available", 20)}
                <Field label="Court access">
                  <select
                    value={data.court}
                    onChange={(e) =>
                      change("court", e.target.value as Setup["court"])
                    }
                  >
                    {[
                      ["unknown", "Not sure yet"],
                      ["full", "Full court"],
                      ["half", "Half court"],
                      ["shared", "Shared court"],
                      ["none", "No court"],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {report("equipment")}
              <h3>When does your team practice?</h3>
              <p>
                Add your usual practice days, times and lengths so the roadmap
                can fit your schedule. Activity plans come next. If dates aren’t
                settled yet, you can leave this empty and add them later.
              </p>
              {data.availability.map((p, i) => (
                <div className="row-card" key={p.id ?? i}>
                  <h4>Practice slot {i + 1}</h4>
                  <div className="field-grid">
                    <Field label="Day">
                      <select
                        value={p.weekday}
                        onChange={(e) =>
                          change(
                            "availability",
                            data.availability.map((r, j) =>
                              j === i
                                ? { ...r, weekday: Number(e.target.value) }
                                : r,
                            ),
                          )
                        }
                      >
                        {weekdays.map((d, n) => (
                          <option value={n} key={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <TimeInput
                      label="Start time"
                      required
                      value={p.time}
                      onChange={(value) =>
                        change(
                          "availability",
                          data.availability.map((r, j) =>
                            j === i ? { ...r, time: value } : r,
                          ),
                        )
                      }
                    />
                    <Field label="Duration (minutes)">
                      <input
                        type="number"
                        min={1}
                        max={300}
                        value={p.minutes}
                        onChange={(e) =>
                          change(
                            "availability",
                            data.availability.map((r, j) =>
                              j === i
                                ? { ...r, minutes: Number(e.target.value) }
                                : r,
                            ),
                          )
                        }
                      />
                    </Field>
                    {(["start", "end"] as const).map((k) => (
                      <Field
                        key={k}
                        label={"Schedule " + k + " date (optional)"}
                      >
                        <input
                          type="date"
                          value={p[k] ?? ""}
                          onChange={(e) =>
                            change(
                              "availability",
                              data.availability.map((r, j) =>
                                j === i
                                  ? { ...r, [k]: e.target.value || null }
                                  : r,
                              ),
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      change(
                        "availability",
                        data.availability.filter((_, j) => i !== j),
                      )
                    }
                  >
                    Remove practice slot {i + 1}
                  </button>
                </div>
              ))}
              {data.availability.length < 14 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    change("availability", [
                      ...data.availability,
                      {
                        weekday: 1,
                        time: "18:00",
                        minutes: 90,
                        start: null,
                        end: null,
                      },
                    ])
                  }
                >
                  Add practice slot
                </button>
              )}
            </>
          )}
          {visibleStep === 3 && (
            <>
              <h3>Games, tournaments & unavailable dates</h3>
              <p>
                Opponent names are optional. Mark dates that should block team
                practices.
              </p>
              {data.events.map((p, i) => (
                <div className="row-card" key={p.id ?? i}>
                  <h4>Event {i + 1}</h4>
                  <div className="field-grid">
                    <Field label="Event type">
                      <select
                        value={p.type}
                        onChange={(e) =>
                          change(
                            "events",
                            data.events.map((r, j) =>
                              j === i
                                ? {
                                    ...r,
                                    type: e.target.value as typeof p.type,
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        {["game", "tournament", "unavailable"].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Event title (optional)">
                      <input
                        maxLength={100}
                        value={p.title}
                        onChange={(e) =>
                          change(
                            "events",
                            data.events.map((r, j) =>
                              j === i ? { ...r, title: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </Field>
                    {(["start", "end"] as const).map((k) => (
                      <Field key={k} label={"Event " + k}>
                        <input
                          type="date"
                          value={p[k]}
                          onChange={(e) =>
                            change(
                              "events",
                              data.events.map((r, j) =>
                                j === i ? { ...r, [k]: e.target.value } : r,
                              ),
                            )
                          }
                        />
                      </Field>
                    ))}
                    {(["time", "endTime"] as const).map((k) => (
                      <TimeInput
                        key={k}
                        label={
                          k === "time"
                            ? "Event start time (optional)"
                            : "Event end time (optional)"
                        }
                        value={p[k]}
                        onChange={(value) =>
                          change(
                            "events",
                            data.events.map((r, j) =>
                              j === i ? { ...r, [k]: value } : r,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={p.blocksPractice}
                      onChange={(e) =>
                        change(
                          "events",
                          data.events.map((r, j) =>
                            j === i
                              ? { ...r, blocksPractice: e.target.checked }
                              : r,
                          ),
                        )
                      }
                    />
                    No team practice on these dates
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      change(
                        "events",
                        data.events.filter((_, j) => i !== j),
                      )
                    }
                  >
                    Remove event {i + 1}
                  </button>
                </div>
              ))}
              {data.events.length < 30 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    change("events", [
                      ...data.events,
                      {
                        type: "game",
                        title: "",
                        start: data.start ?? "",
                        end: data.start ?? "",
                        time: "",
                        endTime: "",
                        blocksPractice: true,
                      },
                    ])
                  }
                >
                  Add event
                </button>
              )}
            </>
          )}
          {visibleStep === 4 && (
            <>
              <p>
                Your approximate player count is enough to get started. Add a
                roster if it helps you keep track of who can participate.
                Players without a name are saved as “Player 1”, “Player 2”, and
                so on.
              </p>
              <p className="small">
                These are your planning notes about expected participation.
                Confirm availability before practice and leave out medical
                details.
              </p>
              {!data.players.length && (
                <p className="empty">
                  No players added. You can continue without names.
                </p>
              )}
              {data.players.map((p, i) => (
                <div className="row-card" key={p.id ?? i}>
                  <h4>Player {i + 1}</h4>
                  <div className="field-grid">
                    <Field label={"Player " + (i + 1) + " nickname (optional)"}>
                      <input
                        maxLength={80}
                        value={p.alias}
                        onChange={(e) =>
                          change(
                            "players",
                            data.players.map((r, j) =>
                              j === i ? { ...r, alias: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label={"Player " + (i + 1) + " participation"}>
                      <select
                        value={p.participation}
                        onChange={(e) =>
                          change(
                            "players",
                            data.players.map((r, j) =>
                              j === i
                                ? {
                                    ...r,
                                    participation: e.target
                                      .value as typeof p.participation,
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        {["unknown", "available", "limited", "unavailable"].map(
                          (t) => (
                            <option key={t}>{t}</option>
                          ),
                        )}
                      </select>
                    </Field>
                    <Field label={"Player " + (i + 1) + " availability note"}>
                      <input
                        maxLength={200}
                        value={p.note}
                        onChange={(e) =>
                          change(
                            "players",
                            data.players.map((r, j) =>
                              j === i ? { ...r, note: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      change(
                        "players",
                        data.players.filter((_, j) => i !== j),
                      )
                    }
                  >
                    Remove player {i + 1} from roster
                  </button>
                </div>
              ))}
              {data.players.length < 30 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    change("players", [
                      ...data.players,
                      { alias: "", participation: "unknown", note: "" },
                    ])
                  }
                >
                  Add player
                </button>
              )}
            </>
          )}
          {visibleStep === 5 && (
            <>
              <p>
                What have you noticed at practice or in games? A few notes help
                us suggest a more useful season roadmap. If you haven’t met the
                team yet, leave these blank and update them later. You can also
                use these notes for an optional team assessment.
              </p>
              {report("strengths")}
              {report("gaps")}
              {report("questions")}
              <div className="tinted row-card">
                <h3>Your setup</h3>
                <p>
                  {data.teamName || "Team name needed"} ·{" "}
                  {data.reports.ageBand || "Age group not added"} ·{" "}
                  {data.playerCount ?? "Unknown"} players
                </p>
                <p>
                  {data.start ? date(data.start) : "Start date needed"} →{" "}
                  {data.end ? date(data.end) : "End date needed"} ·{" "}
                  {data.timezone}
                </p>
                <p>
                  {data.availability.length} regular practice slots ·{" "}
                  {data.events.length} events · {data.hoops ?? "Unknown"} hoops
                </p>
                <p>
                  Ready? Finish setup, then open Season roadmap. You can return
                  to change any answer as you learn more about your team.
                </p>
              </div>
            </>
          )}
        </fieldset>
        <div className="save-bar">
          <p role="status" aria-live="polite">
            {pending
              ? "Saving…"
              : message ||
                (dirty
                  ? "Unsaved changes"
                  : view.savedAt
                    ? "Saved · " + (data.complete ? "Setup complete" : "Draft")
                    : "Not saved yet")}
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="button-row">
            <button type="submit" disabled={pending}>
              {mode === "coach"
                ? "Save coaching profile"
                : mode === "team"
                  ? "Save team settings"
                  : "Save progress"}
            </button>
            {mode !== "coach" &&
              (step < steps.length - 1 ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={pending}
                  onClick={() => save(data.complete, true)}
                >
                  Save & continue
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => save(true)}
                >
                  Finish setup
                </button>
              ))}
          </div>
        </div>
      </form>
    </div>
  );
}
