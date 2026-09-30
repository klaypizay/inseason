import Link from "next/link";
import { redirect } from "next/navigation";
import { RoadmapLibrary } from "../../components/roadmap-library";
import { withSession } from "../../server/db/repository";
import { database } from "../../server/db/runtime";
import { sessionToken } from "../../server/auth/session";
import { Unauthorized } from "../../domain/errors";
export const metadata = { title: "Saved plans | InSeason" };
export default async function LibraryPage() {
  let result;
  try {
    result = await withSession(database, await sessionToken(), async (r) => {
      const setup = await r.onboarding().load();
      return {
        seasonId: setup.data.seasonId,
        folders: await r.library().folders(),
        practices: setup.data.seasonId
          ? await r.week().savedPractices(setup.data.seasonId)
          : [],
        items: setup.data.seasonId
          ? await r.library().list(setup.data.seasonId)
          : [],
      };
    });
  } catch (e) {
    if (e instanceof Unauthorized) redirect("/login");
    throw e;
  }
  return (
    <main id="main">
      <p className="eyebrow">YOUR WORKSPACE</p>
      <h1>Saved plans</h1>
      <p>
        Reopen a practice to take it to the court, or revisit your season
        roadmap and team assessments. Drafts are saved for review. Plans marked
        “In use” or “Ready to coach” are the versions you’ve chosen to use.
      </p>
      {result.practices.length > 0 && (
        <section className="card">
          <h2>Practice plans</h2>
          <ul>
            {result.practices.map((p) => (
              <li key={p.sessionId}>
                <Link href={"/weeks/" + p.weekId + "?session=" + p.sessionId}>
                  {p.title}
                </Link>{" "}
                · {p.status === "accepted" ? "Ready to coach" : "Draft"}
              </li>
            ))}
          </ul>
        </section>
      )}
      <RoadmapLibrary
        seasonId={result.seasonId ?? undefined}
        items={result.items}
        folders={result.folders}
      />
    </main>
  );
}
