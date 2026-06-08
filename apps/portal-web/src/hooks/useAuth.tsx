import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { hasSession, portalLogin, saveSession, clearSession } from "../lib/api";
import { STORAGE_EMAIL } from "../lib/storageKeys";
import type { LoginFormValues } from "../lib/schemas";

type AuthContextValue = {
  email: string | null;
  isAuthenticated: boolean;
  login: (values: LoginFormValues) => Promise<void>;
  establishSession: (token: string, tenantId: string, userEmail: string) => void;
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

  const establishSession = useCallback((token: string, tenantId: string, userEmail: string) => {
    saveSession(token, tenantId, userEmail);
    setEmail(userEmail);
    setAuthenticated(true);
    setError(null);
  }, []);

  const login = useCallback(async (values: LoginFormValues) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await portalLogin({
        email: values.email,
        tenant_id: values.tenant_id,
        password: values.password
      });
      if (res.kind !== "portal") {
        throw new Error("Use a tela de login unificada para este tipo de acesso.");
      }
      establishSession(res.access_token, res.tenant_id, values.email.trim());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha no login";
      setError(msg);
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  }, [establishSession]);

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
    const onInactive = (): void => {
      logout();
      window.dispatchEvent(
        new CustomEvent("portal:toast", {
          detail: "Escritório inativado. Faça login novamente quando for reativado."
        })
      );
    };
    window.addEventListener("portal:unauthorized", on401);
    window.addEventListener("portal:tenant-inactive", onInactive);
    return () => {
      window.removeEventListener("portal:unauthorized", on401);
      window.removeEventListener("portal:tenant-inactive", onInactive);
    };
  }, [logout]);

  const value = useMemo(
    () => ({
      email,
      isAuthenticated: authenticated,
      login,
      establishSession,
      logout,
      error,
      isSubmitting,
      clearError
    }),
    [email, authenticated, login, establishSession, logout, error, isSubmitting, clearError]
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
