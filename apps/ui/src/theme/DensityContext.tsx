import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Density = 'comfortable' | 'compact';

interface DensityContextValue {
  density: Density;
  toggle: () => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<Density>(() => {
    const stored = localStorage.getItem('coglity-density');
    return stored === 'compact' ? 'compact' : 'comfortable';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    localStorage.setItem('coglity-density', density);
  }, [density]);

  const toggle = () => setDensity((d) => (d === 'comfortable' ? 'compact' : 'comfortable'));

  return <DensityContext.Provider value={{ density, toggle }}>{children}</DensityContext.Provider>;
}

export function useDensity() {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error('useDensity must be used within DensityProvider');
  return ctx;
}
