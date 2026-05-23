import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Rola até o elemento com id igual ao hash da URL (ex.: #timeline). */
export function useHashScroll(enabled = true): void {
  const { hash } = useLocation();

  useEffect(() => {
    if (!enabled || !hash || hash.length < 2) {
      return;
    }
    const id = hash.slice(1);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [enabled, hash]);
}
