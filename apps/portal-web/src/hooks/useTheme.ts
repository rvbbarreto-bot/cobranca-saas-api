import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "portal-theme";

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "dark" ? "dark" : "light";
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", mode);
}

export function useTheme(): {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === "light" ? "dark" : "light"));
  }, []);

  return { theme, setTheme, toggleTheme };
}

/** Aplica tema salvo antes do primeiro paint (importar em main.tsx). */
export function initThemeFromStorage(): void {
  applyTheme(readStoredTheme());
}
