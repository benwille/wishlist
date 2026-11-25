"use client";

import { useState } from "react";

export default function ShareLinkButton({ existingToken }: { existingToken: string | null }) {
  const [shareUrl, setShareUrl] = useState<string | null>(
    existingToken ? `https://theholidaywishlist.com/share/${existingToken}` : null
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateLink(action?: "replace" | "disable") {
    if (action && !window.confirm(action === "replace" ? "Replace this link? The old shared link will stop working. Existing gift claims will be kept." : "Turn off public sharing? Visitors won't be able to open your list or change guest claims until you share it again. Existing claims will be kept.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/share-link", { method: action === "disable" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: action === "disable" ? undefined : JSON.stringify({ action }) });
      if (!res.ok) throw new Error("Couldn't update sharing. Please try again.");
      const data = (await res.json()) as { url?: string };
      setShareUrl(data.url ?? null); setCopied(false);
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn't update sharing."); }
    finally { setLoading(false); }
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!shareUrl) {
    return (
      <div>
      <button
        onClick={() => generateLink()}
        disabled={loading}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-accent-light hover:text-accent transition-colors disabled:opacity-60"
      >
        {loading ? "Generating..." : "Share your list"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-accent">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
      <input
        readOnly
        value={shareUrl}
        className="w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted"
      />
      <button
        onClick={copyLink}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      </div>
      <p className="text-sm text-muted">Anyone with this link can view your list and claim gifts without signing up.</p>
      <div className="flex gap-4 text-sm">
        <button disabled={loading} onClick={() => generateLink("replace")} className="text-primary underline disabled:opacity-50">Replace link</button>
        <button disabled={loading} onClick={() => generateLink("disable")} className="text-accent underline disabled:opacity-50">Turn off sharing</button>
      </div>
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
    </div>
  );
}
