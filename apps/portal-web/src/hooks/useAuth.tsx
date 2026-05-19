import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { hasSession, portalLogin, saveSession, clearSession } from "../lib/api";
import { STORAGE_EMAIL } from "../lib/storageKeys";
import type { LoginFormValues } from "../lib/schemas";

type AuthContextValue = {
  email: string | null;
  isAuthenticated: boolean;
  login: (values: LoginFormValues) => Promise<void>;
  logout: () => void;
  error: string | null;
  isSubmitting: boolean;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(STORAGE_EMAIL));
  const [authenticated, setAuthenticated] = useState(() => hasSession());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const login = useCallback(async (values: LoginFormValues) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await portalLogin({
        email: values.email,
        tenant_id: values.tenant_id,
        password: values.password
      });
      saveSession(res.access_token, values.tenant_id.trim(), values.email.trim());
      setEmail(values.email.trim());
      setAuthenticated(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha no login";
      setError(msg);
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setEmail(null);
    setAuthenticated(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const on401 = (): void => {
      logout();
    };
    window.addEventListener("portal:unauthorized", on401);
    return () => window.removeEventListener("portal:unauthorized", on401);
  }, [logout]);

  const value = useMemo(
    () => ({
      email,
      isAuthenticated: authenticated,
      login,
      logout,
      error,
      isSubmitting,
      clearError
    }),
    [email, authenticated, login, logout, error, isSubmitting, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth fora de AuthProvider");
  }
  return ctx;
}
