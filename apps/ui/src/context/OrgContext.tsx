import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth, type OrgMembership } from "./AuthContext";

interface OrgContextType {
  org: OrgMembership | null;
  setCurrentOrgId: (id: string) => void;
}

const OrgContext = createContext<OrgContextType | null>(null);

const STORAGE_KEY = "coglity.currentOrgId";
const ORG_PATH_RE = /^\/orgs\/([^/]+)/;

function orgIdFromPath(pathname: string): string | null {
  const match = pathname.match(ORG_PATH_RE);
  return match ? match[1] : null;
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const urlOrgId = orgIdFromPath(location.pathname);

  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return window.localStorage.getItem(STORAGE_KEY);
    return null;
  });

  useEffect(() => {
    if (!user) return;
    const validUrl = urlOrgId && user.organizations.find((m) => m.organizationId === urlOrgId);
    if (validUrl) {
      if (currentOrgId !== urlOrgId) setCurrentOrgId(urlOrgId);
      return;
    }
    if (currentOrgId && user.organizations.find((m) => m.organizationId === currentOrgId)) {
      return;
    }
    const sorted = [...user.organizations].sort((a, b) =>
      a.organizationName.localeCompare(b.organizationName),
    );
    if (sorted[0]) setCurrentOrgId(sorted[0].organizationId);
    else setCurrentOrgId(null);
  }, [user, urlOrgId, currentOrgId]);

  useEffect(() => {
    if (currentOrgId) window.localStorage.setItem(STORAGE_KEY, currentOrgId);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [currentOrgId]);

  const org = useMemo(
    () => user?.organizations.find((m) => m.organizationId === currentOrgId) ?? null,
    [user, currentOrgId],
  );

  return (
    <OrgContext.Provider value={{ org, setCurrentOrgId: (id) => setCurrentOrgId(id) }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useCurrentOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useCurrentOrg must be used within OrgProvider");
  return ctx;
}
