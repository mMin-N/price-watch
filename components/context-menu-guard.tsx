"use client";

import { useEffect } from "react";

type ContextMenuGuardProps = {
  children: React.ReactNode;
};

function shouldSuppressContextMenu(): boolean {
  if (process.env.NEXT_PUBLIC_SUPPRESS_CONTEXT_MENU === "0") return false;
  if (process.env.NEXT_PUBLIC_SUPPRESS_CONTEXT_MENU === "1") return true;
  return process.env.NODE_ENV === "production";
}

/**
 * Suppresses right-click "Inspect element" on page content.
 * Header/avatar (data-user-chrome) is excluded. Does NOT close browser DevTools
 * (F12) — that is controlled by the browser/IDE only.
 */
export function ContextMenuGuard({ children }: ContextMenuGuardProps) {
  useEffect(() => {
    if (!shouldSuppressContextMenu()) return;

    function handleContextMenu(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-user-chrome]")) return;
      event.preventDefault();
    }

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return children;
}
