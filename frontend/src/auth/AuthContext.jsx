import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../api/client.js";

const AuthContext = createContext(null);

// Role privilege ordering, mirrored from the backend (security.py).
const ROLE_RANK = { viewer: 1, manager: 2, admin: 3 };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, if a token exists, validate it by fetching the current user.
  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { access_token, user: u } = await api.login(email, password);
    tokenStore.set(access_token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const can = useCallback(
    (minimumRole) => !!user && ROLE_RANK[user.role] >= ROLE_RANK[minimumRole],
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
