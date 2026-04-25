import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Crumb = { label: string; to?: string };

interface Ctx {
  crumbs: Crumb[];
  setCrumbs: (c: Crumb[]) => void;
}

const BreadcrumbsContext = createContext<Ctx | null>(null);

export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  return (
    <BreadcrumbsContext.Provider value={{ crumbs, setCrumbs }}>
      {children}
    </BreadcrumbsContext.Provider>
  );
}

export function useBreadcrumbs() {
  const ctx = useContext(BreadcrumbsContext);
  if (!ctx) throw new Error("useBreadcrumbs must be used within BreadcrumbsProvider");
  return ctx;
}

export function useSetBreadcrumbs(crumbs: Crumb[]) {
  const { setCrumbs } = useBreadcrumbs();
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    setCrumbs(crumbs);
    return () => setCrumbs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
