import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { database } from "../../../server/db/runtime";
import { withSession } from "../../../server/db/repository";
import { sessionToken } from "../../../server/auth/session";
import { Unauthorized, NotFound } from "../../../domain/errors";
import { DraftView } from "../../../components/draft-view";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
export default async function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let view;
  try {
    view = await withSession(database, await sessionToken(), (r) =>
      r.planning().get(id),
    );
  } catch (e) {
    if (e instanceof Unauthorized) redirect("/login");
    if (e instanceof NotFound) notFound();
    throw e;
  }
  return (
    <main id="main">
      <Link href="/season">← Season drafts</Link>
      <DraftView initial={view} />
    </main>
  );
}
