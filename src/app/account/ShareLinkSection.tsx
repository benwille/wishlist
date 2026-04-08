"use client";

import { useState } from "react";

export default function ShareLinkSection({ userId }: { userId: number }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
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

  return (
    <>
      <h2 className="text-lg font-semibold">Public Share Link</h2>
      <p className="mt-1 text-sm text-muted">
        Share a read-only link to your wishlist with anyone — no login required.
      </p>
      {shareUrl ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button onClick={copyLink}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : (
        <button onClick={generateLink} disabled={loading}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
          {loading ? "Generating..." : "Generate share link"}
        </button>
      )}
    </>
  );
}
