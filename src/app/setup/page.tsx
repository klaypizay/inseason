import Link from "next/link";
import { redirect } from "next/navigation";
import { Unauthorized } from "../../domain/errors";
import { database } from "../../server/db/runtime";
import { withSession } from "../../server/db/repository";
import { sessionToken } from "../../server/auth/session";
import { SetupForm } from "../../components/setup-form";
import { QuickStartForm } from "../../components/quick-start-form";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
export const metadata = { title: "Team setup | InSeason" };
export default async function SetupPage() {
  let view;
  try {
    view = await withSession(database, await sessionToken(), (r) =>
      r.onboarding().load(),
    );
  } catch (error) {
    if (error instanceof Unauthorized) redirect("/login");
    throw error;
  }
  return (
    <main id="main">
      <Link href="/today">← Start here</Link>
      <p className="eyebrow">
        {view.data.complete ? "TEAM SETTINGS" : "STARTER PLAN"}
      </p>
      <h1>
        {view.data.complete
          ? "A season that fits your team."
          : "Get to Practice 1 in four steps."}
      </h1>
      <p className="lede">
        Tell us who you coach, what you want the team to learn and when you can
        practice. These details shape your season roadmap and practice plans.
        Start with what you know, save at any step and update your answers as
        you get to know the team.
      </p>
      {view.data.complete ? (
        <SetupForm initial={view} />
      ) : (
        <QuickStartForm initial={view} />
      )}
    </main>
  );
}
