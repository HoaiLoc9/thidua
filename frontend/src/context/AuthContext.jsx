import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { setAuthToken } from "../api/client";

const AuthContext = createContext(null);

function loadAuthState() {
  const raw = sessionStorage.getItem("thidua_auth");
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
  const [authLoading, setAuthLoading] = useState(Boolean(initial.token));

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const clearAuth = useCallback(() => {
    sessionStorage.removeItem("thidua_auth");
    setToken(null);
    setUser(null);
    setAuthToken(null);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    const state = { token: data.token, user: data.user };
    sessionStorage.setItem("thidua_auth", JSON.stringify(state));
    setToken(data.token);
    setUser(data.user);
    setAuthToken(data.token);
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    const state = { token: data.token, user: data.user };
    sessionStorage.setItem("thidua_auth", JSON.stringify(state));
    setToken(data.token);
    setUser(data.user);
    setAuthToken(data.token);
  };

  const refreshMe = useCallback(async () => {
    if (!token) return null;
    try {
      const { data } = await api.get("/auth/me");
      const state = { token, user: data };
      sessionStorage.setItem("thidua_auth", JSON.stringify(state));
      setUser(data);
      return data;
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuth();
      }
      throw error;
    }
  }, [clearAuth, token]);

  useEffect(() => {
    let ignore = false;

    async function verifyStoredToken() {
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        await refreshMe();
      } catch (error) {
        console.error("Stored token is invalid:", error);
      } finally {
        if (!ignore) {
          setAuthLoading(false);
        }
      }
    }

    verifyStoredToken();

    return () => {
      ignore = true;
    };
  }, [refreshMe, token]);

  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && token) {
          clearAuth();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, [clearAuth, token]);

  const updateCurrentUser = async (payload) => {
    const { data } = await api.put("/auth/me", payload);
    const state = { token, user: data };
    sessionStorage.setItem("thidua_auth", JSON.stringify(state));
    setUser(data);
    return data;
  };

  const logout = clearAuth;

  const value = useMemo(
    () => ({
      token,
      user,
      authLoading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      refreshMe,
      updateCurrentUser,
      logout,
    }),
    [authLoading, refreshMe, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
