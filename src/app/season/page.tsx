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
      <h1>From team context to a teaching plan.</h1>
      {result.roadmap?.currentId && (
        <section className="card">
          <h2>Your accepted roadmap</h2>
          <p>
            See what comes next, review checkpoints, and preview calendar
            changes.
          </p>
          <Link
            className="button-link"
            href={"/roadmaps/" + result.roadmap.currentId}
          >
            Open accepted roadmap
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
          Generate an assessment or a coarse roadmap. Every result is a draft;
          nothing changes your active plan.
        </p>
        {(process.env.COACH_AI_PROVIDER ?? "fixture") === "fixture" && (
          <p className="small">
            Demo mode · deterministic examples, not a live AI assessment.
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
