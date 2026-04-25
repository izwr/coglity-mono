import { Link, useLocation } from "react-router-dom";
import { useBreadcrumbs, type Crumb } from "../context/BreadcrumbsContext";
import { Fragment } from "react";

function IconSearch() {
  return (
    <svg className="ico" width="14" height="14" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg className="ico" width="16" height="16" viewBox="0 0 24 24">
      <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9zM10 21a2 2 0 004 0" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg className="ico" width="16" height="16" viewBox="0 0 24 24">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { crumbs } = useBreadcrumbs();
  const location = useLocation();

  // Fallback when a page hasn't set crumbs yet
  const resolved = crumbs.length > 0 ? crumbs : defaultCrumbsFor(location.pathname);

  return (
    <div className="topbar">
      <button className="mobile-menu-trigger" onClick={onMenuClick} aria-label="Open menu">
        <IconMenu />
      </button>
      <div className="crumbs">
        {resolved.map((c, i) => {
          const last = i === resolved.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <span className="sep">/</span>}
              {last || !c.to ? (
                <span className={last ? "cur" : ""}>{c.label}</span>
              ) : (
                <Link to={c.to}>{c.label}</Link>
              )}
            </Fragment>
          );
        })}
      </div>
      <div className="topbar-spacer" />
      <div className="search">
        <IconSearch />
        <input placeholder="Search tests, runs, bots…" readOnly onFocus={(e) => e.target.blur()} />
        <span className="kbd">⌘K</span>
      </div>
      <button className="iconbtn" title="Notifications">
        <IconBell />
      </button>
    </div>
  );
}

function defaultCrumbsFor(pathname: string): Crumb[] {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return [{ label: "Dashboard" }];
  const labels: Record<string, string> = {
    dashboard: "Dashboard",
    "test-cases": "Test cases",
    "test-suites": "Suites",
    "scheduled-test-suites": "Runs",
    "bot-connections": "Bots",
    "knowledge-sources": "Knowledge",
    bugs: "Bugs",
    tags: "Tags",
    reporting: "Reports",
    search: "Search",
    generate: "Generate",
  };
  return segs.map((s, i) => ({
    label: labels[s] ?? s,
    to: i === segs.length - 1 ? undefined : "/" + segs.slice(0, i + 1).join("/"),
  }));
}
