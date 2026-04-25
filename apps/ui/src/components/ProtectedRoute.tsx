import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Users with no org memberships must go through onboarding.
  const atOnboarding = location.pathname.startsWith("/onboarding");
  if (user && user.organizations.length === 0 && !atOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
