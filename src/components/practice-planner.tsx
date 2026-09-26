"use client";
import Link from "next/link";
import { useWeekGeneration } from "./use-week-generation";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type WeekContent, type WeekView } from "../domain/week";
import type { PracticePlan } from "../domain/practice";
import { beginWeek, saveWeek } from "../server/week/actions";
import { useDateFormat, useTimeFormat } from "./preferences-provider";
import { WeekEditor } from "./week-editor";
import { Overlay } from "./overlay";
import { AIGenerationOverlay } from "./ai-generation-overlay";
import { exportPracticeToNotion } from "../server/notion/actions";
export function PracticePlanner({
  initial,
  seed,
  selectedSession,
  notionConnected,
}: {
  initial: WeekView;
  seed: WeekContent;
  selectedSession?: string;
  notionConnected: boolean;
}) {
  const query = useSearchParams();
  const time = useTimeFormat();
  const router = useRouter(),
    date = useDateFormat();
  const [content, setContent] = useState(seed),
    [selected, setSelected] = useState(
      (selectedSession &&
      initial.context.sessions.some((s) => s.id === selectedSession)
        ? selectedSession
        : undefined) ??
        initial.context.sessions.find(
          (s) => s.status === "scheduled" && s.date >= initial.context.today,
        )?.id ??
        initial.context.sessions[0]?.id ??
        "",
    );
  const [brief, setBrief] = useState(""),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [editTab, setEditTab] = useState<"manual" | "ai">("manual"),
    [drillBrief, setDrillBrief] = useState(""),
    [generating, setGenerating] = useState(false),
    [advanced, setAdvanced] = useState(query.get("advanced") === "1"),
    [notionBusy, setNotionBusy] = useState(false),
    [pending, start] = useTransition();
  const context = initial.version?.context ?? initial.context;
  const session = context.sessions.find((s) => s.id === selected),
    plan = content.practices?.find((p) => p.sessionId === selected);
  const block = plan?.blocks.find((b) => b.id === editing);
  const savedBlock = seed.practices
    ?.find((p) => p.sessionId === selected)
    ?.blocks.find((b) => b.id === editing);
  const drillLocked = !!(block?.locked || savedBlock?.locked);
  const run = initial.runs.find(
    (r) => r.status === "queued" || r.status === "running",
  );
  const editable =
    initial.editable &&
    !initial.stale &&
    session?.status === "scheduled" &&
    session.date >= initial.context.today;
  const ready =
    !!plan &&
    initial.currentId === initial.version?.id &&
    !dirty &&
    !initial.stale;
  const total = plan?.blocks.reduce((n, b) => n + b.minutes, 0) ?? 0;
  useWeekGeneration(run, !advanced, setError);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function changePlan(next: PracticePlan) {
    setContent({
      ...content,
      practices: [
        ...(content.practices ?? []).filter((p) => p.sessionId !== selected),
        next,
      ],
    });
    setDirty(true);
  }
  function addActivity() {
    if (!plan || plan.blocks.length >= 10) return;
    const donorIndex = [...plan.blocks]
      .map((item, index) => ({ item, index }))
      .reverse()
      .find(({ item }) => item.minutes > 1)?.index;
    if (donorIndex === undefined) {
      setError("Shorten another activity before adding one.");
      return;
    }
    const minutes = Math.min(5, plan.blocks[donorIndex].minutes - 1);
    const id = crypto.randomUUID();
    changePlan({
      ...plan,
      blocks: [
        ...plan.blocks.map((item, index) =>
          index === donorIndex
            ? { ...item, minutes: item.minutes - minutes }
            : item,
        ),
        {
          id,
          title: "New activity",
          minutes,
          setup: "Describe the space, groups, and equipment.",
          cues: "Add the one or two things players should focus on.",
          simpler: "Describe an easier version.",
          purpose: "Explain how this supports the practice focus.",
          players: context.coach.season.playerCount ?? 1,
          hoops: Math.min(1, context.coach.season.hoops ?? 0),
          locked: false,
        },
      ],
    });
    setEditing(id);
    setEditTab("manual");
  }
  function action(
    work: () => Promise<{ id?: string; error?: string }>,
    ai = false,
  ) {
    if (ai) setGenerating(true);
    setError("");
    start(async () => {
      try {
        const result = await work();
        if (result.error) {
          setGenerating(false);
          setError(result.error);
        } else {
          setDirty(false);
          router.refresh();
        }
      } catch {
        setGenerating(false);
        setError("Connection interrupted. Keep your edits and retry.");
      }
    });
  }
  if (advanced)
    return (
      <>
        <button
          className="secondary"
          onClick={() => {
            if (
              window.confirm(
                "Return to the practice view? Save any weekly edits first.",
              )
            ) {
              setAdvanced(false);
              router.replace(
                "/weeks/" + context.week.id + "?session=" + selected,
                { scroll: false },
              );
            }
          }}
        >
          ← Practice view
        </button>
        <WeekEditor initial={initial} seed={seed} />
      </>
    );
  return (
    <div className="practice-workspace">
      <AIGenerationOverlay
        active={(generating || !!run) && !error}
        title="Preparing your practice…"
        description="Shaping your drills around your team and weekly goals. Locked drills stay protected."
      />
      <header className="practice-command-center">
        <div>
          <p className="eyebrow">2 · NEXT PRACTICE</p>
          <h1>{ready ? "Ready to coach." : "Shape your next practice."}</h1>
          <p className="lede">This week’s focus: {context.week.emphasis}</p>
        </div>
        <div className="practice-toolbar no-print">
          <label>
            Practice
            <select
              value={selected}
              disabled={dirty || pending || !!run}
              onChange={(e) => {
                setSelected(e.target.value);
                router.replace(
                  "/weeks/" + context.week.id + "?session=" + e.target.value,
                  { scroll: false },
                );
              }}
            >
              {context.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {date(s.date)} · {time(s.time)} · {s.minutes} min
                </option>
              ))}
            </select>
          </label>
          <span>
            {ready
              ? "✓ Saved for coaching"
              : plan
                ? "Draft · review before use"
                : "Not planned yet"}
          </span>
        </div>
      </header>
      {initial.stale && (
        <p role="alert">
          Your roadmap changed.{" "}
          <button className="secondary" onClick={() => setAdvanced(true)}>
            Review the updated week
          </button>
        </p>
      )}
      {!session && (
        <div className="card">
          <h2>No practices this week</h2>
          <p>
            Your roadmap has no practice scheduled for this week. Review its
            teaching focus, choose another week, or update the roadmap’s
            schedule.
          </p>
          <Link href="/season">Choose another week</Link>
        </div>
      )}
      {session && (
        <>
          <div className="practice-summary">
            <strong className="print-only">
              {date(session.date)} · {time(session.time)} · {session.minutes}{" "}
              minutes
            </strong>
            <p>
              Planning for {context.coach.season.playerCount ?? "unknown"}{" "}
              players · {context.coach.season.hoops ?? "unknown"} hoops ·{" "}
              {context.coach.season.court} court. Confirm who can participate
              before starting.
            </p>
          </div>
          {editable && (
            <details
              className="card quick-request creator-studio no-print"
              open
              key={plan ? "revise" : "build"}
            >
              <summary>
                <span className="creator-studio-kicker">
                  CREATE &amp; REDESIGN
                </span>
                {plan ? "Plan with AI" : "Build your practice with AI"}
              </summary>
              <label htmlFor="practice-brief">
                {plan
                  ? "What would you like to change?"
                  : "Anything different today? (optional)"}
              </label>
              <input
                id="practice-brief"
                maxLength={600}
                value={brief}
                disabled={pending || !!run}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. More ball handling, simpler games, less standing in line"
              />
              <div className="button-row">
                <button
                  disabled={pending || !!run || dirty}
                  onClick={() =>
                    action(
                      () =>
                        beginWeek(
                          context.week.id,
                          initial.reviewId,
                          initial.context.roadmapId,
                          crypto.randomUUID(),
                          { sessionId: selected, brief },
                        ),
                      true,
                    )
                  }
                >
                  {run
                    ? "Preparing your practice…"
                    : plan
                      ? "Redesign this practice"
                      : "Build this practice"}
                </button>
                {plan && (
                  <button
                    className="creator-secondary"
                    disabled={
                      pending || !!run || dirty || plan.blocks.length >= 10
                    }
                    onClick={addActivity}
                  >
                    + Add activity manually
                  </button>
                )}
                {dirty && (
                  <span>Save quick edits before asking for a revision.</span>
                )}
              </div>
              <p className="small">
                We’ll use this week’s focus, your team setup and the time
                available to build a complete practice: activities, minutes,
                setup instructions and reminders for what to say or demonstrate.
                Review the result before choosing Use this practice. Activities
                you’ve locked stay in place when you ask for changes.
              </p>
            </details>
          )}
          {run && (
            <p role="status">
              Building your practice. The finished draft will be saved here for
              you to review. You can return to this page to check its progress.
            </p>
          )}
          {!run && initial.runs[0]?.status === "failed" && (
            <p role="alert">
              The last draft could not be completed. Your saved plan is safe.
              Try a simpler request or use quick edits.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {plan && (
            <>
              <div className="practice-plan-heading">
                <div>
                  <p className="eyebrow">PRACTICE FLOW</p>
                  <h2>{plan.title}</h2>
                </div>
                <strong>
                  {total} / {session.minutes} min
                </strong>
              </div>
              {total !== session.minutes && (
                <p role="alert">
                  Adjust activity times to total {session.minutes} minutes
                  before saving.
                </p>
              )}
              <ol className="practice-timeline" aria-label="Practice flow">
                {plan.blocks.map((b, index) => {
                  const from = plan.blocks
                    .slice(0, index)
                    .reduce((n, x) => n + x.minutes, 0);
                  return (
                    <li key={b.id} className="card practice-block">
                      <div className="practice-block-title">
                        <span className="practice-time">
                          {from}–{from + b.minutes}
                          <small>minutes</small>
                        </span>
                        <div>
                          <p className="practice-step">
                            {index + 1} of {plan.blocks.length}
                          </p>
                          <h3>{b.title}</h3>
                          <p>{b.cues}</p>
                        </div>
                        {editable && (
                          <button
                            className="secondary no-print"
                            disabled={pending || !!run}
                            onClick={() => {
                              setEditing(b.id);
                              setEditTab("manual");
                              setDrillBrief("");
                              setError("");
                            }}
                          >
                            Quick edit
                          </button>
                        )}
                      </div>
                      <div className="practice-drill-lock no-print">
                        <label className="check" htmlFor={b.id + "-lock"}>
                          <input
                            id={b.id + "-lock"}
                            type="checkbox"
                            checked={b.locked}
                            disabled={!editable || pending || !!run}
                            aria-describedby={b.id + "-lock-help"}
                            onChange={(e) =>
                              changePlan({
                                ...plan,
                                blocks: plan.blocks.map((item) =>
                                  item.id === b.id
                                    ? { ...item, locked: e.target.checked }
                                    : item,
                                ),
                              })
                            }
                          />
                          Lock this drill
                        </label>
                        <p className="small" id={b.id + "-lock-help"}>
                          A regenerated practice plan will not affect this
                          drill.
                        </p>
                      </div>
                      <details>
                        <summary>
                          How to run it{b.locked ? " · Locked" : ""}
                        </summary>
                        <p>
                          <strong>Set up:</strong> {b.setup}
                        </p>
                        <p>
                          <strong>Make it easier:</strong> {b.simpler}
                        </p>
                        <p>
                          <strong>Why it helps:</strong> {b.purpose}
                        </p>
                        <p className="small">
                          Needs {b.players} players · {b.hoops} hoops
                        </p>
                      </details>
                    </li>
                  );
                })}
              </ol>
              <div className="save-bar button-row no-print">
                {editable && (
                  <>
                    {dirty && (
                      <button
                        className="secondary"
                        disabled={pending || !!run || total !== session.minutes}
                        onClick={() =>
                          action(() =>
                            saveWeek(
                              context.week.id,
                              initial.reviewId,
                              initial.context.roadmapId,
                              content,
                              crypto.randomUUID(),
                              false,
                            ),
                          )
                        }
                      >
                        Save draft
                      </button>
                    )}
                    {!ready && (
                      <button
                        disabled={
                          pending || !!run || total !== session.minutes || ready
                        }
                        onClick={() =>
                          action(() =>
                            saveWeek(
                              context.week.id,
                              initial.reviewId,
                              initial.context.roadmapId,
                              content,
                              crypto.randomUUID(),
                              true,
                            ),
                          )
                        }
                      >
                        Use this practice
                      </button>
                    )}
                  </>
                )}
                {ready && (
                  <>
                    <button
                      className="secondary"
                      onClick={() => window.print()}
                    >
                      Print / Save PDF
                    </button>
                    {notionConnected ? (
                      <button
                        className="notion-button"
                        disabled={notionBusy}
                        onClick={async () => {
                          setNotionBusy(true);
                          setError("");
                          const result = await exportPracticeToNotion({
                            weekId: context.week.id,
                            sessionId: selected,
                          });
                          setNotionBusy(false);
                          if (result.error) setError(result.error);
                          else if (result.url)
                            window.open(
                              result.url,
                              "_blank",
                              "noopener,noreferrer",
                            );
                        }}
                      >
                        {notionBusy ? "Exporting…" : "Export to Notion"}
                      </button>
                    ) : (
                      <a
                        className="button-link notion-button"
                        href={`/api/notion/connect?week=${context.week.id}`}
                      >
                        Connect Notion
                      </a>
                    )}
                  </>
                )}
                {dirty && <span>Unsaved edits or lock changes</span>}
              </div>
              <p className="small">
                This plan follows your saved weekly priorities and season
                roadmap. Watch how your players respond, then adjust the
                activities and pace to suit them. Choosing Use this practice
                saves this version for coaching; you can return later to make
                changes.
              </p>
            </>
          )}
        </>
      )}
      <details className="planning-disclosure no-print">
        <summary>Weekly focus & advanced options</summary>
        <p>{content.objectives.map((o) => o.description).join(" · ")}</p>
        <p>
          Your roadmap already supplies this week’s teaching priorities. These
          optional controls let you refine those goals and choose which practice
          works on each one. You can build a practice without this extra step.
        </p>
        <button
          className="secondary"
          disabled={dirty || pending || !!run}
          onClick={() => setAdvanced(true)}
        >
          Edit weekly priorities, assignments & history
        </button>
      </details>
      <Overlay
        open={!!block}
        onClose={() => {
          if (!pending) setEditing(null);
        }}
        title="Quick edit drill"
      >
        {block && plan && (
          <div>
            <p>
              <strong>{block.title}</strong> · {block.minutes} minutes
            </p>
            <div
              className="button-row"
              role="tablist"
              aria-label="Drill editing options"
            >
              {(["manual", "ai"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={"drill-tab-" + tab}
                  aria-controls={"drill-panel-" + tab}
                  aria-selected={editTab === tab}
                  tabIndex={editTab === tab ? 0 : -1}
                  className={editTab === tab ? "" : "secondary"}
                  onClick={() => setEditTab(tab)}
                  onKeyDown={(e) => {
                    if (
                      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        e.key,
                      )
                    )
                      return;
                    e.preventDefault();
                    const next =
                      e.key === "Home"
                        ? "manual"
                        : e.key === "End"
                          ? "ai"
                          : editTab === "manual"
                            ? "ai"
                            : "manual";
                    setEditTab(next);
                    document.getElementById("drill-tab-" + next)?.focus();
                  }}
                >
                  {tab === "manual" ? "Edit manually" : "Ask AI"}
                </button>
              ))}
            </div>
            {drillLocked && (
              <p role="status">
                This drill is locked. Close Quick edit, uncheck Lock this drill
                on its card, and save the draft before changing it.
              </p>
            )}
            <div
              role="tabpanel"
              id="drill-panel-manual"
              aria-labelledby="drill-tab-manual"
              hidden={editTab !== "manual"}
            >
              <fieldset
                className="drill-edit-fields"
                disabled={!editable || pending || !!run || drillLocked}
              >
                <label>
                  Drill name
                  <input
                    maxLength={100}
                    value={block.title}
                    onChange={(e) =>
                      changePlan({
                        ...plan,
                        blocks: plan.blocks.map((b) =>
                          b.id === block.id
                            ? { ...b, title: e.target.value }
                            : b,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Minutes
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={block.minutes}
                    onChange={(e) =>
                      changePlan({
                        ...plan,
                        blocks: plan.blocks.map((b) =>
                          b.id === block.id
                            ? { ...b, minutes: Number(e.target.value) }
                            : b,
                        ),
                      })
                    }
                  />
                </label>
                {(
                  [
                    ["setup", "Set up"],
                    ["cues", "Coaching cues"],
                    ["simpler", "Make it easier"],
                    ["purpose", "Why it helps"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label htmlFor={block.id + "-" + key}>{label}</label>
                    <textarea
                      id={block.id + "-" + key}
                      maxLength={400}
                      value={block[key]}
                      onChange={(e) =>
                        changePlan({
                          ...plan,
                          blocks: plan.blocks.map((b) =>
                            b.id === block.id
                              ? { ...b, [key]: e.target.value }
                              : b,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </fieldset>
              <p className="small">
                Keep edits returns you to the practice. Choose Save draft or Use
                this practice there to save your changes.
              </p>
              <button disabled={pending} onClick={() => setEditing(null)}>
                Keep edits
              </button>
            </div>
            <div
              role="tabpanel"
              id="drill-panel-ai"
              aria-labelledby="drill-tab-ai"
              hidden={editTab !== "ai"}
            >
              <p>
                Tell us what you’d like to change. AI will revise only this
                drill, keeping its {block.minutes} minutes and the rest of your
                practice unchanged.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    !editable ||
                    pending ||
                    run ||
                    drillLocked ||
                    !drillBrief.trim() ||
                    total !== session?.minutes
                  )
                    return;
                  action(
                    () =>
                      beginWeek(
                        context.week.id,
                        initial.reviewId,
                        initial.context.roadmapId,
                        crypto.randomUUID(),
                        {
                          sessionId: selected,
                          blockId: block.id,
                          brief: drillBrief,
                        },
                        dirty ? content : undefined,
                      ),
                    true,
                  );
                }}
              >
                <label htmlFor="drill-brief">
                  What would you like to change about this drill?
                </label>
                <textarea
                  id="drill-brief"
                  rows={4}
                  maxLength={600}
                  required
                  value={drillBrief}
                  disabled={!editable || pending || !!run || drillLocked}
                  placeholder="e.g. Make this easier for beginners and give everyone more turns with the ball."
                  onChange={(e) => setDrillBrief(e.target.value)}
                />
                <p className="small">
                  {dirty
                    ? "Your current edits and lock changes will be saved first. "
                    : ""}
                  The revised drill will appear in your practice as a draft to
                  review before use.
                </p>
                {total !== session?.minutes && (
                  <p role="alert">
                    Adjust drill times to total {session?.minutes} minutes
                    before asking AI.
                  </p>
                )}
                <button
                  disabled={
                    !editable ||
                    pending ||
                    !!run ||
                    drillLocked ||
                    !drillBrief.trim() ||
                    total !== session?.minutes
                  }
                >
                  {pending || run
                    ? "Revising drill…"
                    : dirty
                      ? "Save edits & revise drill"
                      : "Revise this drill"}
                </button>
              </form>
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </div>
        )}
      </Overlay>
    </div>
  );
}
