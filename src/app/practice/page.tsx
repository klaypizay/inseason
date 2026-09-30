import { redirect } from "next/navigation";
import Link from "next/link";
import { withSession } from "../../server/db/repository";
import { database } from "../../server/db/runtime";
import { sessionToken } from "../../server/auth/session";
import { Unauthorized } from "../../domain/errors";
export const metadata = { title: "Next practice | InSeason" };
export default async function PracticePage() {
  let next;
  try {
    next = await withSession(database, await sessionToken(), async (r) => {
      const setup = await r.onboarding().load();
      return setup.data.seasonId
        ? (await r.roadmap().summary(setup.data.seasonId)).nextWeekId
        : null;
    });
  } catch (e) {
    if (e instanceof Unauthorized) redirect("/login");
    throw e;
  }
  if (next) redirect("/weeks/" + next);
  return (
    <main id="main">
      <p className="eyebrow">NEXT PRACTICE</p>
      <h1>Start with your season roadmap.</h1>
      <p>
        Each practice uses the teaching focus and schedule from your chosen
        roadmap. Open your roadmap, choose Use this roadmap, then select a week
        to build its practice. If you already have a roadmap in use, check that
        it has an upcoming practice scheduled.
      </p>
      <Link className="button-link" href="/season">
        Open season roadmap →
      </Link>
    </main>
  );
}
