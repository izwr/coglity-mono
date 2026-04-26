import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useCurrentOrg } from "../context/OrgContext";
import { useCanAdminAnyProject } from "../context/permissions";
import { Select } from "./ui/Select";

type NavItemDef = {
  to: string;
  label: string;
  count?: string;
  d: string;
  end?: boolean;
};

type NavSection = {
  title: string;
  items: NavItemDef[];
};

export type SidebarVariant = "workspace" | "org" | "preferences";

const workspace: NavItemDef[] = [
  { to: "/dashboard",  label: "Dashboard",  d: "M3 12l9-8 9 8M5 10v10h14V10" },
  { to: "/test-suites", label: "Suites",    d: "M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z" },
  { to: "/bot-connections", label: "Bots & Agents", d: "M12 4v3M6 9h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2zM9 14h.01M15 14h.01" },
];

const testing: NavItemDef[] = [
  { to: "/test-cases",             label: "Test cases", d: "M4 6h16M4 12h16M4 18h10" },
  { to: "/test-cases/generate",    label: "New test case", d: "M4 20l4-1 10-10a2.5 2.5 0 00-3.5-3.5L4.5 15.5 4 20z" },
  { to: "/scheduled-test-suites",  label: "Runs", d: "M5 3l14 9-14 9V3z" },
  { to: "/bugs",                   label: "Bugs", d: "M12 2a6 6 0 00-6 6v2a6 6 0 0012 0V8a6 6 0 00-6-6zM4 12h16M4 17h16M12 8v10" },
  { to: "/reporting",              label: "Reports", d: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
];

const library: NavItemDef[] = [
  { to: "/knowledge-sources", label: "Knowledge", d: "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" },
  { to: "/tags",              label: "Tags",      d: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01" },
  { to: "/search",            label: "Search",    d: "M11 11m-7 0a7 7 0 1014 0 7 7 0 10-14 0M20 20l-3-3" },
];

const preferencesNav: NavSection[] = [
  {
    title: "Personal",
    items: [
      { to: "/preferences/profile", label: "Profile", d: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" },
      { to: "/preferences/prompts", label: "Prompts", d: "M4 6h16M4 12h16M4 18h10" },
    ],
  },
];

function NavItem({ item }: { item: NavItemDef }) {
  const { pathname } = useLocation();
  const isActive = (() => {
    if (item.end) return pathname === item.to;
    if (item.to === "/test-cases/generate") return pathname === "/test-cases/generate";
    if (item.to === "/test-cases") return pathname === "/test-cases" || (pathname.startsWith("/test-cases/") && pathname !== "/test-cases/generate");
    return pathname === item.to || pathname.startsWith(item.to + "/");
  })();

  return (
    <NavLink to={item.to} className={`sidebar-link${isActive ? " active" : ""}`}>
      <svg className="ico" viewBox="0 0 24 24"><path d={item.d} /></svg>
      <span className="label">{item.label}</span>
      {item.count && <span className="count">{item.count}</span>}
    </NavLink>
  );
}

function WorkspaceNav() {
  const { org } = useCurrentOrg();
  const canAdminAnyProject = useCanAdminAnyProject();

  return (
    <>
      <div className="sidebar-section">Workspace</div>
      {workspace.map((item) => <NavItem key={item.to} item={item} />)}

      <div className="sidebar-section">Testing</div>
      {testing.map((item) => <NavItem key={item.to} item={item} />)}

      <div className="sidebar-section">Library</div>
      {library.map((item) => <NavItem key={item.to} item={item} />)}

      {org && canAdminAnyProject && (
        <>
          <div className="sidebar-section">Project</div>
          <NavLink to={`/orgs/${org.organizationId}/projects`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            <span className="label">Projects</span>
          </NavLink>
        </>
      )}
    </>
  );
}

function OrgNav() {
  const { org } = useCurrentOrg();
  if (!org) return null;
  const orgId = org.organizationId;

  return (
    <>
      <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
        <svg className="ico" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        <span className="label">Back to workspace</span>
      </NavLink>

      <div className="sidebar-section">Organization</div>
      <NavLink to={`/orgs/${orgId}/teams`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
        <svg className="ico" viewBox="0 0 24 24"><path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H2v-2a4 4 0 013-3.87M16 3.13a4 4 0 010 7.75M8 3.13a4 4 0 010 7.75M12 14a4 4 0 100-8 4 4 0 000 8z" /></svg>
        <span className="label">Teams</span>
      </NavLink>
      <NavLink to={`/orgs/${orgId}/projects`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
        <svg className="ico" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
        <span className="label">Projects</span>
      </NavLink>
      <NavLink to={`/orgs/${orgId}/settings`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
        <svg className="ico" viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zM19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.03 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1.11-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 005 15a1.7 1.7 0 00-1.56-1.03H3a2 2 0 110-4h.09A1.7 1.7 0 005 8.94a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9.5a1.7 1.7 0 001.03-1.56V3a2 2 0 114 0v.09c0 .67.39 1.27 1.03 1.56a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9c.29.64.89 1.03 1.56 1.03H21a2 2 0 110 4h-.09c-.67 0-1.27.39-1.56 1.03z" /></svg>
        <span className="label">Org settings</span>
      </NavLink>

      <div className="sidebar-section">People</div>
      <NavLink to={`/orgs/${orgId}/members`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
        <svg className="ico" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" /></svg>
        <span className="label">Members</span>
      </NavLink>
      <NavLink to={`/orgs/${orgId}/invites`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
        <svg className="ico" viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 4l8 8 8-8" /></svg>
        <span className="label">Invites</span>
      </NavLink>
    </>
  );
}

function PreferencesNav() {
  return (
    <>
      {preferencesNav.map((section) => (
        <div key={section.title}>
          <div className="sidebar-section">{section.title}</div>
          {section.items.map((item) => <NavItem key={item.to} item={item} />)}
        </div>
      ))}
    </>
  );
}

function ProfileDropdown() {
  const { user, logout } = useAuth();
  const { org } = useCurrentOrg();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;

  const initials = user.displayName
    ? user.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div className="profile-dropdown" ref={ref}>
      <button
        type="button"
        className="workspace"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="avatar">{initials}</div>
        <div className="meta">
          <div className="n">{user.displayName}</div>
          <div className="s">{user.email.split("@")[0]} · {org?.orgRole ?? "member"}</div>
        </div>
        <svg className="ico chev" viewBox="0 0 24 24" width="14" height="14"><path d="M8 10l4 4 4-4" /></svg>
      </button>

      {open && (
        <div className="profile-menu" role="menu">
          <button className="profile-menu-item" onClick={() => go("/preferences/profile")}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" /></svg>
            <span>Preferences</span>
          </button>
          {org && org.orgRole === "super_admin" && (
            <button className="profile-menu-item" onClick={() => go(`/orgs/${org.organizationId}/settings`)}>
              <svg className="ico" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
              <span>Organization settings</span>
            </button>
          )}
          <div className="profile-menu-sep" />
          <button className="profile-menu-item danger" onClick={logout}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
  variant = "workspace",
}: {
  open?: boolean;
  onClose?: () => void;
  variant?: SidebarVariant;
}) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const { org, setCurrentOrgId } = useCurrentOrg();

  const title = variant === "preferences" ? "Preferences" : variant === "org" ? "Organization" : null;

  return (
    <aside className={`sidebar${open ? " open" : ""}`} onClick={() => onClose?.()}>
      <div className="sidebar-brand">
        <img className="sidebar-mark" src="/logo.svg" alt="Coglity" />
        <div className="sidebar-wordmark">Cog<em>lity</em></div>
      </div>

      {title && (
        <div className="sidebar-subtitle">{title}</div>
      )}

      {variant === "workspace" && user && user.organizations.length > 0 && (
        <div className="sidebar-switchers" onClick={(e) => e.stopPropagation()}>
          <Select
            compact
            value={org ? { value: org.organizationId, label: org.organizationName } : null}
            onChange={(opt) => opt && setCurrentOrgId(opt.value)}
            options={user.organizations.map((m) => ({ value: m.organizationId, label: m.organizationName }))}
            placeholder="Select organization"
          />
        </div>
      )}

      <nav className="sidebar-nav" onClick={(e) => e.stopPropagation()}>
        {variant === "workspace" && <WorkspaceNav />}
        {variant === "org" && <OrgNav />}
        {variant === "preferences" && <PreferencesNav />}
      </nav>

      <div className="sidebar-footer" onClick={(e) => e.stopPropagation()}>
        <button
          className="theme-toggle"
          onClick={toggle}
          title={theme === "light" ? "Switch to dark" : "Switch to light"}
        >
          <svg className="ico" viewBox="0 0 24 24">
            {theme === "light" ? (
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            ) : (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </>
            )}
          </svg>
          <span className="label">{theme === "light" ? "Light mode" : "Dark mode"}</span>
          <span className="theme-toggle-knob" />
        </button>

        <ProfileDropdown />
      </div>
    </aside>
  );
}