"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SetupView } from "../domain/onboarding";
import { createStarterJourney } from "../server/journey/actions";

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

export function QuickStartForm({ initial }: { initial: SetupView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    teamName: initial.data.teamName,
    sport: initial.data.reports.teamType || "Basketball",
    ageBand: initial.data.reports.ageBand || "",
    skill: initial.data.reports.skill || "Mixed",
    goal: initial.data.reports.goals || "",
    practiceDate: initial.data.start || tomorrow(),
    practiceTime: initial.data.availability[0]?.time || "18:00",
    minutes: initial.data.availability[0]?.minutes || 60,
    playerCount: initial.data.playerCount || 10,
    space: initial.data.court === "unknown" ? "shared" : initial.data.court,
    hoops: initial.data.hoops ?? 1,
    equipment: initial.data.reports.equipment || "",
    timezone:
      initial.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const steps = ["Your team", "Experience", "Main goal", "First practice"];
  const update = (key: string, value: string | number) =>
    setData((current) => ({ ...current, [key]: value }));
  const valid = [
    data.teamName.trim() && data.sport,
    data.ageBand.trim() && data.skill,
    data.goal.trim().length >= 3,
    data.practiceDate &&
      data.practiceTime &&
      data.minutes >= 20 &&
      data.playerCount > 0,
  ][step];

  return (
    <div className="quick-start-layout">
      <ol className="quick-start-progress" aria-label="Quick-start progress">
        {steps.map((label, index) => (
          <li
            key={label}
            className={index === step ? "current" : index < step ? "done" : ""}
          >
            <span>{index < step ? "✓" : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <section className="card quick-start-card">
        <p className="eyebrow">QUICK START · {step + 1} OF 4</p>
        {step === 0 && (
          <>
            <h2>Who are you coaching?</h2>
            <label>
              Team name
              <input
                autoFocus
                maxLength={100}
                value={data.teamName}
                onChange={(e) => update("teamName", e.target.value)}
                placeholder="Lincoln 7th Grade"
              />
            </label>
            <label>
              Sport
              <select
                value={data.sport}
                onChange={(e) => update("sport", e.target.value)}
              >
                {["Basketball", "Soccer", "Volleyball", "Other"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <h2>What fits this team?</h2>
            <label>
              Age or grade
              <input
                autoFocus
                maxLength={80}
                value={data.ageBand}
                onChange={(e) => update("ageBand", e.target.value)}
                placeholder="12–13 years old or 7th grade"
              />
            </label>
            <label>
              Current experience
              <select
                value={data.skill}
                onChange={(e) => update("skill", e.target.value)}
              >
                {["New to the sport", "Developing", "Experienced", "Mixed"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <h2>What matters most right now?</h2>
            <p>
              One plain-language goal is enough. You can refine the full roadmap
              later.
            </p>
            <label>
              Main team goal
              <textarea
                autoFocus
                rows={5}
                maxLength={600}
                value={data.goal}
                onChange={(e) => update("goal", e.target.value)}
                placeholder="Build confidence with spacing, passing and making simple decisions together."
              />
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Tell us about Practice 1.</h2>
            <p>Confirm these planning estimates. You can change them later.</p>
            <div className="field-grid">
              <label>
                Date
                <input
                  type="date"
                  value={data.practiceDate}
                  onChange={(e) => update("practiceDate", e.target.value)}
                />
              </label>
              <label>
                Start time
                <input
                  type="time"
                  value={data.practiceTime}
                  onChange={(e) => update("practiceTime", e.target.value)}
                />
              </label>
              <label>
                Minutes
                <input
                  type="number"
                  min={20}
                  max={240}
                  value={data.minutes}
                  onChange={(e) => update("minutes", Number(e.target.value))}
                />
              </label>
              <label>
                Players expected
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={data.playerCount}
                  onChange={(e) =>
                    update("playerCount", Number(e.target.value))
                  }
                />
              </label>
              <label>
                Space
                <select
                  value={data.space}
                  onChange={(e) => update("space", e.target.value)}
                >
                  {[
                    ["full", "Full space"],
                    ["half", "Half space"],
                    ["shared", "Shared space"],
                    ["none", "No dedicated court or field"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {data.sport === "Basketball"
                  ? "Hoops available"
                  : "Basketball hoops (not used)"}
                <input
                  type="number"
                  min={0}
                  max={20}
                  disabled={data.sport !== "Basketball"}
                  value={data.sport === "Basketball" ? data.hoops : 0}
                  onChange={(e) => update("hoops", Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              Other equipment <span className="small">optional</span>
              <input
                maxLength={600}
                value={data.equipment}
                onChange={(e) => update("equipment", e.target.value)}
                placeholder="Balls, cones, pinnies, nets…"
              />
            </label>
            <div className="starter-explainer">
              <strong>What happens next</strong>
              <span>
                InSeason will create and use a 12-week starter roadmap, then
                prepare Practice 1 as a draft for you to review.
              </span>
            </div>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="quick-start-actions">
          {step > 0 && (
            <button
              className="secondary"
              type="button"
              disabled={pending}
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              className="action-button"
              type="button"
              disabled={!valid}
              onClick={() => setStep(step + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              className="action-button"
              type="button"
              disabled={!valid || pending}
              onClick={() => {
                setError("");
                start(async () => {
                  const result = await createStarterJourney({
                    ...data,
                    hoops: data.sport === "Basketball" ? data.hoops : 0,
                  });
                  if (result.error) setError(result.error);
                  else if (result.href)
                    router.push(
                      result.href +
                        (result.notice
                          ? `${result.href.includes("?") ? "&" : "?"}notice=${encodeURIComponent(result.notice)}`
                          : ""),
                    );
                });
              }}
            >
              {pending
                ? "Creating your roadmap and Practice 1…"
                : "Create starter plan"}
            </button>
          )}
        </div>
      </section>
      <p className="quick-start-footnote">
        You can add season dates, roster details, events and observations later.
        InSeason will label assumptions and drafts for you to review.
      </p>
    </div>
  );
}
