"use client";

import { useState } from "react";

export default function SendNotificationForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult("");
    setError("");

    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        body: form.get("body"),
        url: form.get("url") || undefined,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { sent: number; failed: number; gone: string[] };
      setResult(`Sent to ${data.sent} device${data.sent !== 1 ? "s" : ""}${data.gone.length ? `, ${data.gone.length} expired` : ""}`);
      (e.target as HTMLFormElement).reset();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Failed to send");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="title" className="block text-sm font-medium">Title</label>
        <input
          id="title"
          name="title"
          required
          defaultValue="Wishlist"
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
        />
      </div>
      <div>
        <label htmlFor="body" className="block text-sm font-medium">Message</label>
        <input
          id="body"
          name="body"
          required
          placeholder="What do you want to say?"
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
        />
      </div>
      <div>
        <label htmlFor="url" className="block text-sm font-medium">Link <span className="text-muted font-normal">(optional)</span></label>
        <input
          id="url"
          name="url"
          placeholder="/my-list"
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {loading ? "Sending..." : "Send to All"}
      </button>
      {result && <p className="text-sm text-primary">{result}</p>}
      {error && <p className="text-sm text-accent">{error}</p>}
    </form>
  );
}
