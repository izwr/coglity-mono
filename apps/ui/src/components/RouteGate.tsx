import { Navigate, Outlet } from "react-router-dom";
import { useCan, type Action } from "../context/permissions";

export function RouteGate({ action }: { action: Action }) {
  const allowed = useCan(action);
  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
