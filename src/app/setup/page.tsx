import Link from "next/link";
import { redirect } from "next/navigation";
import { Unauthorized } from "../../domain/errors";
import { database } from "../../server/db/runtime";
import { withSession } from "../../server/db/repository";
import { sessionToken } from "../../server/auth/session";
import { SetupForm } from "../../components/setup-form";
export const dynamic = "force-dynamic";
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
      <p className="eyebrow">TEAM SETTINGS</p>
      <h1>A season that fits your team.</h1>
      <p className="lede">
        Tell us who you coach, what you want the team to learn and when you can
        practice. These details shape your season roadmap and practice plans.
        Start with what you know, save at any step and update your answers as
        you get to know the team.
      </p>
      <SetupForm initial={view} />
    </main>
  );
}
