"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function SiteNavigation({
  workspace,
}: {
  workspace: {
    complete: boolean;
    currentId: string | null;
    reviewId: string | null;
    nextWeekId: string | null;
  } | null;
}) {
  const path = usePathname();
  const section =
    path.startsWith("/roadmaps/") || path.startsWith("/drafts/")
      ? "season"
      : path.startsWith("/weeks/")
        ? "practice"
        : path.slice(1);
  const roadmap = workspace?.currentId ?? workspace?.reviewId;
  const links = [
    {
      key: "today",
      href: "/today",
      label: "Start here",
      hint: "Your next step",
      icon: "⌂",
    },
    {
      key: "season",
      href: roadmap ? "/roadmaps/" + roadmap : "/season",
      label: "Season roadmap",
      hint: workspace?.currentId
        ? "Your weekly outline · view or edit"
        : "What to teach throughout the season",
      icon: "1",
    },
    {
      key: "practice",
      href: workspace?.nextWeekId
        ? "/weeks/" + workspace.nextWeekId
        : "/practice",
      label: "Next practice",
      hint: "Activities, timing & coaching tips",
      icon: "2",
    },
  ];
  return (
    <nav className="site-navigation" aria-label="Main navigation">
      <p className="nav-group-label">PLAN & COACH</p>
      {links.map((l) => (
        <Link
          key={l.key}
          href={l.href}
          aria-current={section === l.key ? "page" : undefined}
        >
          <span className="site-nav-icon" aria-hidden="true">
            {l.icon}
          </span>
          <span>
            <strong>{l.label}</strong>
            <small>{l.hint}</small>
          </span>
        </Link>
      ))}
      <p className="nav-group-label">YOUR WORKSPACE</p>
      <Link
        href="/library"
        aria-current={section === "library" ? "page" : undefined}
      >
        <span>
          <strong>Saved plans</strong>
          <small>Roadmaps, practices & assessments</small>
        </span>
      </Link>
      <Link
        href="/setup"
        aria-current={section === "setup" ? "page" : undefined}
      >
        <span>
          <strong>Team setup</strong>
          <small>
            {workspace?.complete
              ? "Ready · edit when needed"
              : "Complete this first"}
          </small>
        </span>
      </Link>
      <details className="nav-help">
        <summary>How your plans work</summary>
        <p>
          Start with your team’s goals and schedule. We’ll help turn them into a
          season outline and clear instructions for each practice.
        </p>
        <ol>
          <li>
            Review what to teach each week. Edit any week, then choose Use this
            roadmap.
          </li>
          <li>
            Build a practice with timed activities and coaching tips. Describe a
            change in your own words or quick-edit an activity.
          </li>
          <li>
            Choose Use this practice to save it for coaching. Print it or reopen
            it on your phone from Saved plans.
          </li>
        </ol>
        <p>
          As the team changes, update Team setup. Optional assessments suggest
          what to work on next; you decide how to adjust your roadmap.
        </p>
      </details>
    </nav>
  );
}
