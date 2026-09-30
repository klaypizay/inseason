"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavigationWorkspace = {
  complete: boolean;
  currentId: string | null;
  reviewId: string | null;
  nextWeekId: string | null;
};

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <span className="site-nav-icon" aria-hidden="true">
      {children}
    </span>
  );
}

export function SiteNavigation({
  workspace,
  folders,
}: {
  workspace: NavigationWorkspace | null;
  folders: { id: string; name: string }[];
}) {
  const path = usePathname();
  const section =
    path.startsWith("/roadmaps/") || path.startsWith("/drafts/")
      ? "season"
      : path.startsWith("/weeks/") || path.startsWith("/practice/")
        ? "practice"
        : path.slice(1);
  const roadmap = workspace?.currentId ?? workspace?.reviewId;
  const links = [
    { key: "today", href: "/today", label: "Dashboard", icon: "⌂" },
    {
      key: "season",
      href: roadmap ? `/roadmaps/${roadmap}` : "/season",
      label: "Season roadmap",
      icon: "▦",
    },
    {
      key: "practice",
      href: workspace?.nextWeekId
        ? `/weeks/${workspace.nextWeekId}`
        : "/practice",
      label: "Practice plans",
      icon: "▶",
    },
  ];

  return (
    <nav className="site-navigation" aria-label="Main navigation">
      <p className="nav-group-label">PLAN &amp; COACH</p>
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          aria-current={section === link.key ? "page" : undefined}
          title={link.label}
        >
          <NavIcon>{link.icon}</NavIcon>
          <span className="nav-copy">{link.label}</span>
        </Link>
      ))}

      <p className="nav-group-label">WORKSPACE</p>
      <Link
        href="/library"
        aria-current={section === "library" ? "page" : undefined}
        title="Saved plans"
      >
        <NavIcon>▤</NavIcon>
        <span className="nav-copy">Saved plans</span>
      </Link>
      <Link
        href="/setup"
        aria-current={section === "setup" ? "page" : undefined}
        title="Team setup"
      >
        <NavIcon>◎</NavIcon>
        <span className="nav-copy">Team setup</span>
      </Link>

      <div className="sidebar-folders">
        <div className="sidebar-folder-heading">
          <p className="nav-group-label">FOLDERS</p>
          <Link
            href="/library"
            aria-label="Manage folders"
            title="Manage folders"
          >
            +
          </Link>
        </div>
        <Link href="/library" title="All saved plans">
          <NavIcon>◇</NavIcon>
          <span className="nav-copy">All plans</span>
        </Link>
        {folders.slice(0, 8).map((folder) => (
          <Link key={folder.id} href="/library" title={folder.name}>
            <NavIcon>□</NavIcon>
            <span className="nav-copy folder-name">{folder.name}</span>
          </Link>
        ))}
        {folders.length > 8 && (
          <Link
            href="/library"
            className="more-folders"
            title="View all folders"
          >
            <NavIcon>…</NavIcon>
            <span className="nav-copy">{folders.length - 8} more</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
