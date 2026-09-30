import { LibraryDetails } from "../../../components/roadmap-library";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { database } from "../../../server/db/runtime";
import { withSession } from "../../../server/db/repository";
import { sessionToken } from "../../../server/auth/session";
import { Unauthorized, NotFound } from "../../../domain/errors";
import { DraftView } from "../../../components/draft-view";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const metadata = { title: "Review season suggestions | InSeason" };
export const maxDuration = 240;
export default async function DraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let view;
  let library;
  try {
    view = await withSession(database, await sessionToken(), (r) =>
      r.planning().get(id),
    );
    library = await withSession(database, await sessionToken(), (r) =>
      r.library().item(id),
    );
  } catch (e) {
    if (e instanceof Unauthorized) redirect("/login");
    if (e instanceof NotFound) notFound();
    throw e;
  }
  return (
    <main id="main">
      <Link href="/season">← Season roadmap</Link>
      {library && (
        <LibraryDetails
          key={library.id + ":" + library.revision}
          initial={library}
        />
      )}
      <DraftView
        initial={view}
        showSource={(await searchParams).source === "1"}
      />
    </main>
  );
}
