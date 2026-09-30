import { LibraryDetails } from "../../../components/roadmap-library";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { database } from "../../../server/db/runtime";
import { withSession } from "../../../server/db/repository";
import { sessionToken } from "../../../server/auth/session";
import { Unauthorized, NotFound } from "../../../domain/errors";
import { RoadmapEditor } from "../../../components/roadmap-editor";
export const dynamic = "force-dynamic";
export const metadata = { title: "Review your season roadmap | InSeason" };
export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let view: import("../../../domain/roadmap").RoadmapView;
  let library;
  try {
    view = await withSession(database, await sessionToken(), (r) =>
      r.roadmap().get(id),
    );
    library = view.version.generationId
      ? await withSession(database, await sessionToken(), (r) =>
          r.library().item(view.version.generationId!),
        )
      : null;
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
      <RoadmapEditor key={id} initial={view} />
    </main>
  );
}
