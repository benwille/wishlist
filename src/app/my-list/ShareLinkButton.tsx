"use client";

import { useState } from "react";

export default function ShareLinkButton({ existingToken }: { existingToken: string | null }) {
  const [shareUrl, setShareUrl] = useState<string | null>(
    existingToken ? `https://theholidaywishlist.com/share/${existingToken}` : null
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateLink() {
    setLoading(true);
    const res = await fetch("/api/users/me/share-link", { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { url: string };
      setShareUrl(data.url);
    }
    setLoading(false);
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!shareUrl) {
    return (
      <button
        onClick={generateLink}
        disabled={loading}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-accent-light hover:text-accent transition-colors disabled:opacity-60"
      >
        {loading ? "Generating..." : "Share your list"}
      </button>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
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
  );
}
