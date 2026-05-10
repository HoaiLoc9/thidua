import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { setAuthToken } from "../api/client";

const AuthContext = createContext(null);

function loadAuthState() {
  const raw = localStorage.getItem("thidua_auth");
  if (!raw) return { token: null, user: null };
  try {
    return JSON.parse(raw);
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const initial = loadAuthState();
  setAuthToken(initial.token);
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    const state = { token: data.token, user: data.user };
    localStorage.setItem("thidua_auth", JSON.stringify(state));
    setToken(data.token);
    setUser(data.user);
    setAuthToken(data.token);
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    const state = { token: data.token, user: data.user };
    localStorage.setItem("thidua_auth", JSON.stringify(state));
    setToken(data.token);
    setUser(data.user);
    setAuthToken(data.token);
  };

  const refreshMe = async () => {
    if (!token) return;
    const { data } = await api.get("/auth/me");
    const state = { token, user: data };
    localStorage.setItem("thidua_auth", JSON.stringify(state));
    setUser(data);
  };

  const updateCurrentUser = async (payload) => {
    const { data } = await api.put("/auth/me", payload);
    const state = { token, user: data };
    localStorage.setItem("thidua_auth", JSON.stringify(state));
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("thidua_auth");
    setToken(null);
    setUser(null);
    setAuthToken(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      register,
      refreshMe,
      updateCurrentUser,
      logout,
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
