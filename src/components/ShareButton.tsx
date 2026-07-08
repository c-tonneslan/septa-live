"use client";

import { useState } from "react";

// Copies the current view as a shareable URL (filters + camera + selection).
// The URL is already kept in sync by App's replaceState writer; this stamps a
// timestamp so a stale selection can be dropped on open.
export default function ShareButton({ getUrl }: { getUrl: () => string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = getUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Insecure-context fallback.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* give up quietly */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={share}
      className="absolute top-3 right-3 z-[500] bg-panel/90 border border-panel-border rounded-md px-3 py-1.5 text-xs font-mono text-muted hover:text-foreground hover:border-accent backdrop-blur transition-colors"
    >
      {copied ? "Copied ✓" : "Share view"}
    </button>
  );
}
