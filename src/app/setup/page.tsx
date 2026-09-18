import Link from "next/link";
import { redirect } from "next/navigation";
import { Unauthorized } from "../../domain/errors";
import { database } from "../../server/db/runtime";
import { withSession } from "../../server/db/repository";
import { sessionToken } from "../../server/auth/session";
import { SetupForm } from "../../components/setup-form";
export const dynamic = "force-dynamic";
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
      <Link href="/today">← Today</Link>
      <p className="eyebrow">TEAM SETTINGS</p>
      <h1>A season that fits your team.</h1>
      <p className="lede">
        Start with what you know. Save at any step and come back later.
      </p>
      <SetupForm initial={view} />
    </main>
  );
}
