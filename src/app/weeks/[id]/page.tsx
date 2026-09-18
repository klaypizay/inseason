import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { database } from "../../../server/db/runtime";
import { withSession } from "../../../server/db/repository";
import { sessionToken } from "../../../server/auth/session";
import { Unauthorized, NotFound } from "../../../domain/errors";
import { manualWeek } from "../../../domain/week";
import { WeekEditor } from "../../../components/week-editor";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { id } = await params,
    { version } = await searchParams;
  if (
    !z.uuid().safeParse(id).success ||
    (version && !z.uuid().safeParse(version).success)
  )
    notFound();
  let view;
  try {
    view = await withSession(database, await sessionToken(), (r) =>
      r.week().get(id, version),
    );
  } catch (e) {
    if (e instanceof Unauthorized) redirect("/login");
    if (e instanceof NotFound) notFound();
    throw e;
  }
  return (
    <main id="main">
      <Link href={"/roadmaps/" + view.context.roadmapId}>
        ← Accepted roadmap
      </Link>
      <WeekEditor
        key={
          (view.version?.id ?? "new") +
          view.context.roadmapId +
          view.runs.map((r) => r.id + r.status).join("")
        }
        initial={view}
        seed={view.version?.content ?? manualWeek(view.context, randomUUID)}
      />
    </main>
  );
}
