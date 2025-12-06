"use client";

import { useEffect } from "react";

// Reload the page if a Next.js chunk fails to load (usually due to a stale cache after deploy)
export function ChunkErrorReload() {
  useEffect(() => {
    const reload = () => {
      // Use full reload to clear the stale runtime/chunks
      window.location.reload();
    };

    const handleRejectedChunk = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string };
      if (!reason) return;

      const message = reason.message || "";
      if (reason.name === "ChunkLoadError" || message.includes("Loading chunk") || message.includes("ChunkLoadError")) {
        console.warn("[Chunks] Chunk load failed, forcing reload");
        reload();
      }
    };

    const handleScriptError = (event: ErrorEvent) => {
      const target = event.target as HTMLElement | null;
      const src = (target as HTMLScriptElement | null)?.src || "";
      if (target?.tagName === "SCRIPT" && src.includes("/_next/static/chunks")) {
        console.warn("[Chunks] Script tag error for Next chunk, forcing reload");
        reload();
      }
    };

    window.addEventListener("unhandledrejection", handleRejectedChunk);
    window.addEventListener("error", handleScriptError, true);

    return () => {
      window.removeEventListener("unhandledrejection", handleRejectedChunk);
      window.removeEventListener("error", handleScriptError, true);
    };
  }, []);

  return null;
}
