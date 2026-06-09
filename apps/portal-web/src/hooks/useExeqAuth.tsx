import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  clearExeqSession,
  exeqLogin,
  hasExeqSession,
  saveExeqSession
} from "../lib/exeq-api";
import { STORAGE_EXEQ_EMAIL } from "../lib/storageKeys";

type ExeqAuthContextValue = {
  email: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  establishSession: (token: string, userEmail: string) => void;
  logout: () => void;
  error: string | null;
  isSubmitting: boolean;
  clearError: () => void;
};

const ExeqAuthContext = createContext<ExeqAuthContextValue | null>(null);

export function ExeqAuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(STORAGE_EXEQ_EMAIL));
  const [authenticated, setAuthenticated] = useState(() => hasExeqSession());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const establishSession = useCallback((token: string, userEmail: string) => {
    saveExeqSession(token, userEmail);
    setEmail(userEmail);
    setAuthenticated(true);
    setError(null);
  }, []);

  const login = useCallback(async (loginEmail: string, password: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await exeqLogin({ email: loginEmail.trim(), password });
      establishSession(res.access_token, loginEmail.trim());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha no login";
      setError(msg);
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  }, [establishSession]);

  const logout = useCallback(() => {
    clearExeqSession();
    setEmail(null);
    setAuthenticated(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const on401 = (): void => {
      logout();
    };
    window.addEventListener("exeq:unauthorized", on401);
    return () => window.removeEventListener("exeq:unauthorized", on401);
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

  return <ExeqAuthContext.Provider value={value}>{children}</ExeqAuthContext.Provider>;
}

export function useExeqAuth(): ExeqAuthContextValue {
  const ctx = useContext(ExeqAuthContext);
  if (!ctx) {
    throw new Error("useExeqAuth fora de ExeqAuthProvider");
  }
  return ctx;
}
