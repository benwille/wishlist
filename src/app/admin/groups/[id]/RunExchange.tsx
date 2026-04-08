"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Assignment = { giverName: string; receiverName: string };

export default function RunExchange({ groupId, memberCount }: { groupId: number; memberCount: number }) {
  const router = useRouter();
  const [year, setYear] = useState(new Date().getFullYear());
  const [preview, setPreview] = useState<Assignment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function generatePreview() {
    setLoading(true);
    setError("");
    setPreview(null);
    setSaved(false);

    const res = await fetch(`/api/exchange/groups/${groupId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, preview: true }),
    });

    if (res.ok) {
      const data = (await res.json()) as { assignments: Assignment[] };
      setPreview(data.assignments);
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Failed to generate assignments");
    }
    setLoading(false);
  }

  async function confirmSave() {
    setLoading(true);
    setError("");

    const res = await fetch(`/api/exchange/groups/${groupId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, preview: false }),
    });

    if (res.ok) {
      setSaved(true);
      setPreview(null);
      router.refresh();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Failed to save assignments");
    }
    setLoading(false);
  }

  if (memberCount < 2) {
    return <p className="text-sm text-muted">Need at least 2 members to run an exchange.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <label htmlFor="year" className="text-sm font-medium">Year:</label>
        <input id="year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <button onClick={generatePreview} disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-accent">{error}</p>}
      {saved && <p className="mb-4 text-sm text-primary">Assignments saved for {year}!</p>}

      {preview && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Preview — {year}</h3>
          <div className="space-y-1 mb-4">
            {preview.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-primary-light/50 px-3 py-2 text-sm">
                <span className="font-medium">{a.giverName}</span>
                <span className="text-muted">→</span>
                <span>{a.receiverName}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={confirmSave} disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
              Save assignments
            </button>
            <button onClick={() => setPreview(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background">
              Cancel
            </button>
            <button onClick={generatePreview} disabled={loading}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background">
              Reshuffle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
