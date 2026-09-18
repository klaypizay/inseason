import { RoadmapLibrary } from "../../components/roadmap-library";
import Link from "next/link";
import { redirect } from "next/navigation";
import { database } from "../../server/db/runtime";
import { withSession } from "../../server/db/repository";
import { sessionToken } from "../../server/auth/session";
import { Unauthorized } from "../../domain/errors";
import { GenerateButtons } from "../../components/generate-buttons";
export const dynamic = "force-dynamic";
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
        <Link href="/today">← Today</Link>
        <Link href="/setup">Team settings</Link>
      </div>
      <p className="eyebrow">YOUR SEASON</p>
      <h1>Your season, one step at a time.</h1>
      <section
        className="card planning-guide"
        aria-labelledby="planning-guide-title"
      >
        <h2 id="planning-guide-title">How planning works</h2>
        <ol>
          <li>
            <strong>Set up your team.</strong> Add your season dates, players,
            practice times and events in Settings → Team.
          </li>
          <li>
            <strong>Understand your team (optional).</strong> An assessment
            summarizes strengths, needs and possible priorities from your
            inputs. It is advice; it does not activate a plan.
          </li>
          <li>
            <strong>Create a roadmap draft.</strong> A roadmap proposes phases,
            weekly teaching priorities and practice dates for your season. You
            can start here without an assessment.
          </li>
          <li>
            <strong>Review, edit, then accept.</strong> Accepting means “use
            this roadmap for my team.” It becomes your active plan for weekly
            planning and replaces the previous active roadmap. Earlier versions
            remain in history.
          </li>
          <li>
            <strong>Plan each week.</strong> Turn the active roadmap’s
            priorities into weekly objectives and practice assignments.
          </li>
        </ol>
        <p className="small">
          <strong>Demo data is not a planning step.</strong> “Synthetic” means
          sample team or season data used for testing. “Example output” means a
          prewritten demonstration rather than a live AI result. Neither label
          means a roadmap has been accepted.
        </p>
      </section>
      {result.roadmap?.currentId && (
        <section className="card">
          <h2>Your active roadmap</h2>
          <p>
            This is the roadmap you chose to use. Review checkpoints, plan each
            week, or preview changes before accepting an updated version.
          </p>
          <Link
            className="button-link"
            href={"/roadmaps/" + result.roadmap.currentId}
          >
            Open active roadmap
          </Link>
          {result.roadmap.nextWeekId && (
            <p>
              <Link href={"/weeks/" + result.roadmap.nextWeekId}>
                Plan the next teaching week →
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
          Choose an optional assessment to understand team needs, or create a
          roadmap to plan the season. Both use your saved team inputs. New
          drafts never replace your active roadmap until you accept one.
        </p>
        {(process.env.COACH_AI_PROVIDER ?? "fixture") === "fixture" && (
          <p className="small">
            Example mode · these buttons create prewritten demonstrations, not
            live AI results.
          </p>
        )}
        {!data.complete && (
          <p>
            Finish <Link href="/setup">team setup</Link> first. You can keep
            editing your inputs at any time.
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
      <RoadmapLibrary items={result.runs} folders={result.folders} />
    </main>
  );
}
