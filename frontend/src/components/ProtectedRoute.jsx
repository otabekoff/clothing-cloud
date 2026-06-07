import { Navigate, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext.jsx";
import { Loading } from "./states.jsx";

// Gate a route on authentication and (optionally) a minimum role.
// Unauthenticated → /login. Authenticated but under-privileged → /403.
export default function ProtectedRoute({ minRole, children }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (minRole && !can(minRole)) return <Navigate to="/403" replace />;
  return children;
}
