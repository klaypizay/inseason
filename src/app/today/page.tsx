import Link from "next/link";
import { redirect } from "next/navigation";
import { Unauthorized } from "../../domain/errors";
import { database } from "../../server/db/runtime";
import { withSession } from "../../server/db/repository";
import { sessionToken } from "../../server/auth/session";
import { signOut } from "../../server/auth/actions";
export const dynamic = "force-dynamic";
export default async function Today() {
  let teams;
  try {
    teams = await withSession(database, await sessionToken(), (repo) =>
      repo.teams(),
    );
  } catch (error) {
    if (error instanceof Unauthorized) redirect("/login");
    throw error;
  }
  return (
    <main id="main">
      <div className="toolbar">
        <nav aria-label="Main">
          <span aria-current="page">Today</span>{" "}
          <Link href="/setup">Team settings</Link>{" "}
          <Link href="/season">Season</Link>
        </nav>
        <form action={signOut}>
          <button className="secondary">Sign out</button>
        </form>
      </div>
      <p className="eyebrow">YOUR COACHING HOME</p>
      <h1>Welcome back, coach.</h1>
      <p className="lede">Make room for the next small step.</p>
      <div className="dashboard">
        <section className="card">
          <p className="eyebrow">YOUR TEAM</p>
          <h2>{teams[0]?.name ?? "A fresh start."}</h2>
          <p>
            {teams.length
              ? "Your team workspace is connected and private to your account."
              : "Your account is ready. Add your team and season to get started."}
          </p>
          <Link className="button-link" href="/setup">
            {teams.length ? "Set up or edit your season" : "Create your team"}
          </Link>
          <div className="empty">
            <span aria-hidden="true">◷</span>
            <h3>No practice scheduled yet</h3>
            <p>
              When your season is set up, your next practice will appear here.
            </p>
          </div>
        </section>
        <aside className="card tinted">
          <p className="eyebrow">BUILD A SEASON, ONE STEP AT A TIME</p>
          <h2>Plan. Observe. Adapt.</h2>
          <ol>
            <li>
              <strong>Start with your team.</strong>
              <br />
              What do they need, and what time do you have?
            </li>
            <li>
              <strong>Teach with a purpose.</strong>
              <br />
              Connect each practice to a bigger goal.
            </li>
            <li>
              <strong>Remember what happened.</strong>
              <br />
              Let your observations guide what comes next.
            </li>
          </ol>
          <p className="small">
            Assessment preview · Draft your assessment and season roadmap.
          </p>
        </aside>
      </div>
    </main>
  );
}
