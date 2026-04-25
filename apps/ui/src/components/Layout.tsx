import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar, type SidebarVariant } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BreadcrumbsProvider } from "../context/BreadcrumbsContext";
import { useAuth } from "../context/AuthContext";
import { useCurrentOrg } from "../context/OrgContext";

function variantForPath(pathname: string): SidebarVariant {
  if (pathname.startsWith("/preferences")) return "preferences";
  if (pathname.startsWith("/orgs/")) return "org";
  return "workspace";
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const variant = variantForPath(pathname);
  const { user } = useAuth();
  const { org } = useCurrentOrg();

  const noProjectAccess =
    variant === "workspace" &&
    !!org &&
    org.orgRole !== "super_admin" &&
    org.projects.length === 0;

  return (
    <BreadcrumbsProvider>
      <div className="app-layout">
        <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} variant={variant} />
        {mobileOpen && (
          <div className="sidebar-scrim visible" onClick={() => setMobileOpen(false)} />
        )}
        <div className="main">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="main-content">
            {noProjectAccess ? (
              <div className="page">
                <div className="empty">
                  <div className="title">
                    No <em className="italic-teal">project</em> access in {org!.organizationName} yet.
                  </div>
                  <div className="sub">
                    Ask an organization admin to add you to a project. Once added, your test cases, suites, bugs, and dashboards will appear here.
                    {user && user.organizations.length > 1 && " Or switch to a different organization in the sidebar."}
                  </div>
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </BreadcrumbsProvider>
  );
}