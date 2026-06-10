import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { api, redirectToLogin } from '../services/api';
import type { OrgRole, ProjectRole } from './permissions';

export interface ProjectMembership {
  projectId: string;
  projectName: string;
  role: ProjectRole | null; // null for super_admin (implicit access)
}

export interface OrgMembership {
  organizationId: string;
  organizationName: string;
  orgRole: OrgRole;
  projects: ProjectMembership[];
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  organizations: OrgMembership[];
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  login: () => void;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Heartbeat: how often to verify the session is still alive while the tab is focused.
const HEARTBEAT_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<AuthUser | null>(null);
  userRef.current = user;

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/users/me');
      setUser(res.data);
    } catch (err: any) {
      // 401 is the only genuine "your session is gone" signal: drop the user (and redirect to
      // login if they were signed in). For any other failure network blip, 5xx, backend
      // restart keep the current user so the heartbeat (every 60s + on focus/visibility)
      // can't yank a validly-logged-in user, and their in-progress form, to /login.
      if (err?.response?.status === 401) {
        if (userRef.current) redirectToLogin();
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  // Heartbeat while the tab is visible: re-check the session periodically and
  // on focus/visibility change. Catches the "walked away for hours" case so the
  // user sees a clean redirect to login, not a wall of 401s on their next click.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = () => {
      void refresh();
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(check, HEARTBEAT_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        check();
        start();
      } else {
        stop();
      }
    };
    const onFocus = () => {
      check();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const login = () => {
    window.location.href = '/api/auth/login';
  };

  const loginWithGoogle = () => {
    window.location.href = '/api/auth/google/login';
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout failures (network, already-expired session, etc.) shouldn't
      // keep the user stuck on the app. Clear local state either way.
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, refresh, login, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
