import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { database } from "../../../server/db/runtime";
import { withSession } from "../../../server/db/repository";
import { sessionToken } from "../../../server/auth/session";
import { Unauthorized, NotFound } from "../../../domain/errors";
import { manualWeek } from "../../../domain/week";
import { PracticePlanner } from "../../../components/practice-planner";
import { notionConnected } from "../../../server/notion";
export const dynamic = "force-dynamic";
export const metadata = { title: "Practice plan | InSeason" };
export const maxDuration = 240;
export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    version?: string;
    session?: string;
    notice?: string;
  }>;
}) {
  const { id } = await params,
    { version, session, notice } = await searchParams;
  if (
    !z.uuid().safeParse(id).success ||
    (version && !z.uuid().safeParse(version).success) ||
    (session && !z.uuid().safeParse(session).success)
  )
    notFound();
  let result;
  try {
    result = await withSession(database, await sessionToken(), async (r) => {
      const view = await r.week().get(id, version);
      const roadmap = await r.roadmap().get(view.context.roadmapId);
      const current =
        roadmap.version.plan.sessions.find((item) => item.id === session) ??
        view.context.sessions[0];
      const nextPractice = roadmap.version.plan.sessions
        .filter(
          (item) =>
            item.status === "scheduled" &&
            (!current || item.date + item.time > current.date + current.time),
        )
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
      return { view, nextPractice };
    });
  } catch (e) {
    if (e instanceof Unauthorized) redirect("/login");
    if (e instanceof NotFound) notFound();
    throw e;
  }
  const { view, nextPractice } = result;
  return (
    <main id="main">
      <Link href={"/roadmaps/" + view.context.roadmapId}>← Season roadmap</Link>
      <PracticePlanner
        key={
          (view.version?.id ?? "new") +
          view.context.roadmapId +
          (session ?? "") +
          view.runs.map((r) => r.id + r.status).join("")
        }
        initial={view}
        selectedSession={session}
        seed={view.version?.content ?? manualWeek(view.context, randomUUID)}
        notionConnected={await notionConnected()}
        notice={notice?.slice(0, 240)}
        nextPractice={
          nextPractice
            ? {
                weekId: nextPractice.weekId,
                sessionId: nextPractice.id,
                date: nextPractice.date,
                time: nextPractice.time,
              }
            : null
        }
      />
    </main>
  );
}
