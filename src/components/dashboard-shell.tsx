"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SettingsButton } from "./preferences-provider";
import { SiteNavigation, type NavigationWorkspace } from "./site-navigation";

function sectionFor(path: string) {
  if (path.startsWith("/roadmaps/") || path.startsWith("/drafts/"))
    return "Season";
  if (path.startsWith("/weeks/") || path.startsWith("/practice/"))
    return "Practice";
  const labels: Record<string, string> = {
    "/today": "Today",
    "/season": "Season",
    "/practice": "Practice",
    "/library": "Saved plans",
    "/setup": "Team setup",
  };
  return labels[path] ?? "InSeason";
}

export function DashboardShell({
  children,
  workspace,
  folders,
  displayName,
}: {
  children: ReactNode;
  workspace: NavigationWorkspace | null;
  folders: { id: string; name: string }[];
  displayName: string;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (displayName || "Coach")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={`dashboard-shell${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " mobile-nav-open" : ""}`}
    >
      <aside
        className="dashboard-sidebar"
        aria-label="Workspace sidebar"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setMobileOpen(false);
        }}
      >
        <div className="sidebar-brand-row">
          <Link className="brand" href="/today" aria-label="InSeason home">
            <span className="brand-mark" aria-hidden="true">
              IS
            </span>
            <span className="brand-copy">
              <strong>InSeason</strong>
              <small>Your team. Your plan.</small>
            </span>
          </Link>
          <button
            className="icon-button sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            ×
          </button>
        </div>
        <SiteNavigation workspace={workspace} folders={folders} />
      </aside>

      <div className="dashboard-stage">
        <header className="dashboard-toolbar">
          <div className="toolbar-leading">
            <button
              className="icon-button sidebar-toggle"
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
              aria-expanded={!collapsed}
              onClick={() => {
                if (window.innerWidth < 1024) setMobileOpen((value) => !value);
                else setCollapsed((value) => !value);
              }}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <span className="toolbar-section">{sectionFor(path)}</span>
            <nav className="toolbar-links" aria-label="Quick navigation">
              <Link href="/today">Today</Link>
              <Link
                href={
                  workspace?.currentId
                    ? `/roadmaps/${workspace.currentId}`
                    : "/season"
                }
              >
                Season
              </Link>
              <Link
                href={
                  workspace?.nextWeekId
                    ? `/weeks/${workspace.nextWeekId}`
                    : "/practice"
                }
              >
                Practice
              </Link>
            </nav>
          </div>
          <div className="toolbar-actions">
            <span className="toolbar-status">Plan ready</span>
            <SettingsButton compact />
            <span className="account-avatar" aria-hidden="true">
              {initials || "C"}
            </span>
          </div>
        </header>
        <div className="site-content">
          {children}
          <footer>
            Plan with your team’s goals in mind. Adjust as they grow.
          </footer>
        </div>
      </div>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
