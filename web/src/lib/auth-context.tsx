import * as React from "react";
import { api, setAccessToken, setOnUnauthorized, AppApiError } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const clearSession = React.useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  React.useEffect(() => {
    setOnUnauthorized(() => clearSession());
    return () => setOnUnauthorized(null);
  }, [clearSession]);

  // Al cargar la app no hay token en memoria (se perdió al recargar a
  // propósito, ver lib/api.ts): no hay forma de recuperar sesión sin
  // volver a iniciar sesión, así que solo terminamos el loading inicial.
  React.useEffect(() => {
    setLoading(false);
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const result = await api.post<{ accessToken: string; user: User }>("/auth/login", { email, password }, 90_000);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // si falla el logout en el server, igual limpiamos la sesión local
    } finally {
      clearSession();
    }
  }, [clearSession]);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof AppApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}
