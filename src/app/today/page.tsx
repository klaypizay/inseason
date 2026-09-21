import Link from "next/link";
import { redirect } from "next/navigation";
import { Unauthorized } from "../../domain/errors";
import { database } from "../../server/db/runtime";
import { withSession } from "../../server/db/repository";
import { sessionToken } from "../../server/auth/session";
import { signOut } from "../../server/auth/actions";
import {
  DisplayDate,
  DisplayTime,
} from "../../components/preferences-provider";
export const dynamic = "force-dynamic";
export const metadata = { title: "Start here | Season Coach" };
export default async function Today() {
  let result;
  try {
    result = await withSession(database, await sessionToken(), async (r) => {
      const setup = await r.onboarding().load();
      return {
        setup,
        roadmap: setup.data.seasonId
          ? await r.roadmap().summary(setup.data.seasonId)
          : null,
      };
    });
  } catch (e) {
    if (e instanceof Unauthorized) redirect("/login");
    throw e;
  }
  const { setup, roadmap } = result;
  const href = !setup.data.complete
    ? "/setup"
    : !roadmap?.currentId
      ? roadmap?.reviewId
        ? "/roadmaps/" + roadmap.reviewId
        : "/season"
      : roadmap.nextWeekId
        ? "/weeks/" + roadmap.nextWeekId
        : "/season";
  return (
    <main id="main">
      <div className="toolbar">
        <p className="eyebrow">START HERE</p>
        <form action={signOut}>
          <button className="secondary">Sign out</button>
        </form>
      </div>
      <p className="small">
        {setup.data.teamName || "Your coaching workspace"}
      </p>
      <h1>
        {roadmap?.currentId
          ? "Let’s get your next practice ready."
          : "A simple plan. More time to coach."}
      </h1>
      <p className="lede">
        Turn your team’s goals, experience and schedule into a season outline
        and practices you can take straight to the court. You choose what fits
        and can adjust your plans as the season unfolds.
      </p>
      <section className="card next-step">
        <p className="eyebrow">YOUR NEXT STEP</p>
        <h2>
          {!setup.data.complete
            ? "Finish team setup"
            : !roadmap?.currentId
              ? roadmap?.reviewId
                ? "Review your saved roadmap"
                : "Create your season roadmap"
              : roadmap.nextSession
                ? "Prepare your next practice"
                : "Review your season"}
        </h2>
        {roadmap?.nextSession && (
          <p>
            <DisplayDate value={roadmap.nextSession.date} /> ·{" "}
            <DisplayTime value={roadmap.nextSession.time} /> ·{" "}
            {roadmap.nextSession.minutes} minutes
          </p>
        )}
        <p>
          {!setup.data.complete
            ? "Tell us about your team, goals, season dates and practice time. We’ll use those details to build your season outline. It’s okay if you don’t have every answer yet."
            : !roadmap?.currentId
              ? "Get a week-by-week outline of what to teach and what progress to look for. Scan it, edit any week, then choose Use this roadmap to start planning practices."
              : roadmap.nextSession
                ? "Turn your next week’s focus into timed activities, setup instructions and reminders for what to say or demonstrate. Ask for changes in your own words or quick-edit an activity."
                : "No upcoming practice is scheduled. Check your calendar or revisit saved plans."}
        </p>
        <Link className="button-link" href={href}>
          {!setup.data.complete
            ? "Continue setup"
            : !roadmap?.currentId
              ? "Plan my season"
              : roadmap.nextWeekId
                ? "Plan next practice"
                : "Open season"}{" "}
          →
        </Link>
      </section>
      <div className="quick-path">
        <Link href="/season">
          <strong>1 · Season roadmap</strong>
          <span>A week-by-week outline built around your team’s goals.</span>
        </Link>
        <Link href="/practice">
          <strong>2 · Next practice</strong>
          <span>Timed activities and instructions for your next session.</span>
        </Link>
        <Link href="/library">
          <strong>Saved plans</strong>
          <span>Reopen your roadmaps, practices and team assessments.</span>
        </Link>
      </div>
      <details className="planning-disclosure">
        <summary>First time here? A one-minute guide</summary>
        <ol>
          <li>
            <strong>Build an outline for your entire season.</strong> We use
            your team’s goals, ages, experience, schedule and available
            equipment to suggest what to teach each week and what progress to
            look for. This becomes a roadmap for you and your team.
          </li>
          <li>
            <strong>Make the roadmap yours.</strong> Scan the weeks and edit
            anything that doesn’t fit. Choose <strong>Use this roadmap</strong>{" "}
            when you’re ready. A draft is saved for review; the roadmap in use
            is the one your practice planning follows.
          </li>
          <li>
            <strong>Let us design your next practice.</strong> Choose a
            scheduled practice and get timed activities, setup instructions,
            coaching reminders and ways to make activities easier, based on your
            roadmap and team setup. Describe any changes you want in your own
            words, or quick-edit an activity. Then save it for coaching and
            print it or open it on your phone.
          </li>
          <li>
            <strong>Adjust as your team grows.</strong> Update your team notes
            as you learn what works. An optional team assessment helps you
            identify strengths, areas to work on and possible goals. Use that
            advice to edit your roadmap or create a fresh draft. You choose when
            an updated plan replaces the one you use.
          </li>
        </ol>
        <p>
          You don’t need to be an experienced coach or plan every practice
          today. Start with one season outline and one practice. Your saved
          plans are there to revisit throughout the season.
        </p>
      </details>
    </main>
  );
}
