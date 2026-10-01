import Link from "next/link";
import { redirect } from "next/navigation";
import { Unauthorized } from "../../domain/errors";
import { database } from "../../server/db/runtime";
import { withSession } from "../../server/db/repository";
import { sessionToken } from "../../server/auth/session";
import {
  DisplayDate,
  DisplayTime,
} from "../../components/preferences-provider";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard | InSeason" };

export default async function Today() {
  let result;
  try {
    result = await withSession(database, await sessionToken(), async (repo) => {
      const setup = await repo.onboarding().load();
      const summary = setup.data.seasonId
        ? await repo.roadmap().summary(setup.data.seasonId)
        : null;
      const roadmap = summary?.currentId
        ? await repo.roadmap().get(summary.currentId)
        : null;
      return { setup, summary, roadmap };
    });
  } catch (error) {
    if (error instanceof Unauthorized) redirect("/login");
    throw error;
  }
  const { setup, summary, roadmap } = result;
  if (!setup.data.complete) {
    return (
      <main id="main" className="dashboard-home onboarding-home">
        <p className="eyebrow">WELCOME TO INSEASON</p>
        <h1>Your first practice starts with four quick answers.</h1>
        <p className="lede">
          Tell us who you coach, what matters most and when you practice. We’ll
          create a starter roadmap and take you directly to Practice 1.
        </p>
        <Link className="button-link action-button" href="/setup">
          Start my plan →
        </Link>
        <div className="onboarding-promise">
          <span>
            <strong>1</strong> Team
          </span>
          <span>
            <strong>2</strong> Experience
          </span>
          <span>
            <strong>3</strong> Goal
          </span>
          <span>
            <strong>4</strong> Practice
          </span>
        </div>
      </main>
    );
  }
  const plan = roadmap?.version.plan;
  const today = roadmap?.today;
  const currentWeek =
    plan?.weeks.find(
      (week) => today && week.start <= today && week.end >= today,
    ) ?? plan?.weeks.find((week) => !today || week.end >= today);
  const next = summary?.nextSession;
  const nextHref = summary?.nextWeekId
    ? `/weeks/${summary.nextWeekId}${next ? `?session=${next.id}` : ""}`
    : "/season";
  const weekSessions = currentWeek
    ? (plan?.sessions.filter(
        (session) =>
          session.weekId === currentWeek.id && session.status !== "canceled",
      ) ?? [])
    : [];
  return (
    <main id="main" className="dashboard-home">
      <header className="dashboard-page-heading">
        <div>
          <p className="eyebrow">COACHING DASHBOARD</p>
          <h1>Your next coaching decision.</h1>
          <p className="lede">
            See what matters this week, prepare the next practice and keep the
            season connected.
          </p>
        </div>
        <Link
          className="button-link action-button mobile-primary"
          href={nextHref}
        >
          {next ? "Plan next practice" : "Open season"}
        </Link>
      </header>
      <section className="season-context-strip" aria-label="Season context">
        <Link href="/season" className="context-card">
          <span>SEASON</span>
          <strong>{setup.data.title}</strong>
          <small>
            {plan ? `${plan.weeks.length} teaching weeks` : "Starter roadmap"}
          </small>
        </Link>
        <Link
          href={roadmap ? `/roadmaps/${roadmap.version.id}` : "/season"}
          className="context-card"
        >
          <span>THIS WEEK</span>
          <strong>{currentWeek?.emphasis ?? "Choose this week’s focus"}</strong>
          <small>
            {currentWeek ? (
              <>
                <DisplayDate value={currentWeek.start} /> –{" "}
                <DisplayDate value={currentWeek.end} />
              </>
            ) : (
              "Not scheduled"
            )}
          </small>
        </Link>
        <Link href="/setup" className="context-card">
          <span>TEAM</span>
          <strong>{setup.data.teamName}</strong>
          <small>
            {setup.data.reports.ageBand || "Age not recorded"} ·{" "}
            {setup.data.playerCount ?? "?"} players
          </small>
        </Link>
        <Link href={nextHref} className="context-card context-card-accent">
          <span>NEXT PRACTICE</span>
          <strong>
            {next ? <DisplayDate value={next.date} /> : "Not scheduled"}
          </strong>
          <small>
            {next ? (
              <>
                <DisplayTime value={next.time} /> · {next.minutes} minutes
              </>
            ) : (
              "Review the roadmap calendar"
            )}
          </small>
        </Link>
      </section>
      <div className="dashboard-focus-grid">
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">THIS WEEK</p>
              <h2>
                {currentWeek?.emphasis ??
                  "Build the week around your starter goal"}
              </h2>
            </div>
            {roadmap && (
              <Link href={`/roadmaps/${roadmap.version.id}`}>
                View roadmap →
              </Link>
            )}
          </div>
          <div className="week-summary-grid">
            <article className="compact-card">
              <span className="card-icon">◎</span>
              <div>
                <strong>What to work on</strong>
                <p>{currentWeek?.emphasis ?? setup.data.reports.goals}</p>
              </div>
            </article>
            <article className="compact-card">
              <span className="card-icon">✓</span>
              <div>
                <strong>What to look for</strong>
                <p>
                  {currentWeek?.checkpoint ??
                    "Notice what players can explain and repeat with confidence."}
                </p>
              </div>
            </article>
            <article className="compact-card">
              <span className="card-icon">◷</span>
              <div>
                <strong>Scheduled sessions</strong>
                <p>
                  {weekSessions.length
                    ? `${weekSessions.length} practice${weekSessions.length === 1 ? "" : "s"} this week`
                    : "No practice recorded this week"}
                </p>
              </div>
            </article>
            <article className="compact-card">
              <span className="card-icon">◇</span>
              <div>
                <strong>Known constraints</strong>
                <p>
                  {setup.data.playerCount ?? "Not recorded"} players ·{" "}
                  {setup.data.reports.teamType === "Basketball"
                    ? `${setup.data.hoops ?? "Not recorded"} hoops · `
                    : ""}
                  {setup.data.court.replaceAll("_", " ")}
                </p>
              </div>
            </article>
          </div>
        </section>
        <aside className="next-practice-card">
          <p className="eyebrow">NEXT PRACTICE</p>
          <h2>
            {next ? <DisplayDate value={next.date} /> : "No practice scheduled"}
          </h2>
          {next && (
            <p className="practice-meta">
              <DisplayTime value={next.time} /> · {next.minutes} minutes
            </p>
          )}
          <p>
            {currentWeek?.emphasis ??
              "Connect the next practice to your season goal."}
          </p>
          <span className="status-badge">
            {next ? "Draft or ready to plan" : "Needs schedule"}
          </span>
          <Link className="button-link action-button" href={nextHref}>
            {next ? "Plan next practice" : "Review schedule"}
          </Link>
        </aside>
      </div>
      <section className="dashboard-lower-grid">
        <article className="card">
          <p className="eyebrow">TEAM PULSE</p>
          <h2>What you know so far</h2>
          <p>
            {setup.data.reports.strengths ||
              "No recent observation recorded. Add what worked after Practice 1."}
          </p>
          <p className="small">
            Coach-entered context ·{" "}
            {setup.data.reports.strengths ? "Known" : "Not recorded"}
          </p>
          <Link href="/setup">Add an observation →</Link>
        </article>
        <article className="card adjustment-card">
          <p className="eyebrow">SUGGESTED ADJUSTMENT</p>
          <h2>Keep the first plan simple.</h2>
          <div className="adjustment-grid">
            <span>
              <strong>Keep</strong>Your main team goal
            </span>
            <span>
              <strong>Reinforce</strong>This week’s focus
            </span>
            <span>
              <strong>Watch</strong>What players can repeat
            </span>
            <span>
              <strong>Later</strong>Extra detail that can wait
            </span>
          </div>
          <details>
            <summary>Based on…</summary>
            <p>
              Your saved goal, experience level, schedule and equipment. Update
              these as you learn more.
            </p>
          </details>
        </article>
      </section>
    </main>
  );
}
