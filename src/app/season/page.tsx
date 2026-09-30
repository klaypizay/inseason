import { RoadmapLibrary } from "../../components/roadmap-library";
import Link from "next/link";
import { redirect } from "next/navigation";
import { database } from "../../server/db/runtime";
import { withSession } from "../../server/db/repository";
import { sessionToken } from "../../server/auth/session";
import { Unauthorized } from "../../domain/errors";
import { GenerateButtons } from "../../components/generate-buttons";
export const dynamic = "force-dynamic";
export const metadata = { title: "Season roadmap | InSeason" };
export const maxDuration = 240;
export default async function SeasonPage() {
  let result;
  try {
    result = await withSession(database, await sessionToken(), async (r) => {
      const setup = await r.onboarding().load();
      const { teamId, seasonId } = setup.data;
      return {
        setup,
        folders: await r.library().folders(),
        roadmap: seasonId ? await r.roadmap().summary(seasonId) : null,
        runs: teamId && seasonId ? await r.library().list(seasonId) : [],
      };
    });
  } catch (e) {
    if (e instanceof Unauthorized) redirect("/login");
    throw e;
  }
  const { data } = result.setup;
  return (
    <main id="main">
      <div className="toolbar">
        <Link href="/today">← Start here</Link>
        <Link href="/setup">Team settings</Link>
      </div>
      <p className="eyebrow">YOUR SEASON</p>
      <h1>Your season roadmap.</h1>
      <p className="lede">
        Build a week-by-week outline for your entire season, shaped by your
        team’s goals, experience and practice schedule. Review what to teach and
        what progress to look for, then use it to guide each practice.
      </p>
      {result.roadmap?.currentId && (
        <section className="card">
          <h2>The roadmap you’re using</h2>
          <p>
            Your practice plans follow this season outline. Open a week to
            prepare its practices, or adjust future weeks as your team’s needs
            change. You review and choose when to use any updated version.
          </p>
          <Link
            className="button-link"
            href={"/roadmaps/" + result.roadmap.currentId}
          >
            Open my roadmap
          </Link>
          {result.roadmap.nextWeekId && (
            <p>
              <Link href={"/weeks/" + result.roadmap.nextWeekId}>
                Prepare next practice →
              </Link>
            </p>
          )}
        </section>
      )}
      {result.roadmap?.reviewId &&
        result.roadmap.reviewId !== result.roadmap.currentId && (
          <p>
            <Link href={"/roadmaps/" + result.roadmap.reviewId}>
              Continue saved roadmap review
            </Link>
          </p>
        )}
      <section className="card draft-section">
        <h2>{data.title}</h2>
        <p>
          We’ll use your saved team details to suggest goals and weekly teaching
          priorities across your season. You’ll get a saved draft to review and
          edit. Creating a draft keeps the roadmap you’re currently using in
          place.
        </p>
        {(process.env.COACH_AI_PROVIDER ?? "fixture") === "fixture" && (
          <p className="small">
            Example mode: try the planning steps with prewritten sample plans.
            These examples are not personalized AI results.
          </p>
        )}
        {!data.complete && (
          <p>
            Finish <Link href="/setup">team setup</Link> first. You can keep
            updating your team details throughout the season.
          </p>
        )}
        {data.teamId && data.seasonId && (
          <GenerateButtons
            teamId={data.teamId}
            seasonId={data.seasonId}
            disabled={!data.complete}
          />
        )}
      </section>
      <details className="planning-disclosure">
        <summary>Saved roadmaps & folders</summary>
        <RoadmapLibrary
          seasonId={data.seasonId ?? undefined}
          items={result.runs}
          folders={result.folders}
        />
      </details>
    </main>
  );
}
