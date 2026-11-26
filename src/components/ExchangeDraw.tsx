"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Assignment = {
  giverId: number;
  receiverId: number;
  giverName: string;
  receiverName: string;
};
const button =
  "rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50";
export default function ExchangeDraw({
  groupId,
  kind,
  enabled,
  memberCount,
  savedYears,
}: {
  groupId: number;
  kind: "adult" | "child";
  enabled: boolean;
  memberCount: number;
  savedYears: number[];
}) {
  const router = useRouter(),
    label = kind === "adult" ? "adult" : "kids’";
  const [year, setYear] = useState(new Date().getFullYear()),
    [preview, setPreview] = useState<Assignment[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const saved = savedYears.includes(year);
  async function run(save: boolean) {
    if (save && !preview) return;
    const replace = save && savedYears.includes(year);
    if (
      replace &&
      !window.confirm(
        `Replace the saved ${label} assignments for ${year}? The other exchange is unchanged.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    if (!save) setPreview(null);
    try {
      const payload =
        kind === "adult"
          ? {
              year,
              preview: !save,
              assignments: save ? preview : undefined,
              replace,
            }
          : {
              year,
              action: save ? "save" : "preview",
              assignments: save ? preview : undefined,
              replace,
            };
      const response = await fetch(
        `/api/exchange/groups/${groupId}/${kind === "adult" ? "run" : "kids"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as {
        error?: string;
        assignments?: Assignment[];
      };
      if (!response.ok) throw new Error(data.error || "Unable to run exchange");
      if (save) {
        setPreview(null);
        router.refresh();
      } else setPreview(data.assignments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to run exchange");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={kind === "adult" ? "Adult draw" : "Kids draw"}
      className="min-w-0 rounded-xl border border-border bg-surface p-5"
    >
      <h3 className="text-lg font-semibold">
        {kind === "adult" ? "Adult draw" : "Kids’ draw"}
      </h3>
      <p className="mt-2 text-sm text-muted">
        {kind === "adult"
          ? "Avoids recipients from the previous two years."
          : "Avoids last year’s recipient and this group’s kids’ exclusions."}
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          {kind === "adult" ? "Adult draw year" : "Kids draw year"}
          <input
            className="mt-1 block w-28 rounded-lg border border-border bg-background px-3 py-2"
            type="number"
            min={2000}
            max={9999}
            value={year}
            disabled={busy}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setPreview(null);
              setError("");
            }}
          />
        </label>
      </div>
      {saved && (
        <div className="mt-3 space-y-2">
          <p role="status" className="font-medium text-primary">
            Assignments saved for {year}.
          </p>
          <a
            className="inline-block text-sm text-primary hover:underline"
            href={`/exchange/${groupId}#assignments-${year}`}
          >
            View assignments
          </a>
        </div>
      )}
      {!enabled ? (
        <p className="mt-3 text-sm text-muted">
          This exchange is disabled. Saved assignments remain available.
        </p>
      ) : memberCount < 2 ? (
        <p className="mt-3 text-sm text-muted">
          Add at least two participants to run this draw.
        </p>
      ) : (
        <>
          <button
            className={`${button} mt-3`}
            disabled={busy}
            onClick={() => void run(false)}
          >
            {saved
              ? `Redraw ${kind === "adult" ? "adult" : "kids’"} draw`
              : `Preview ${kind === "adult" ? "adult" : "kids’"} draw`}
          </button>
          {preview && (
            <div className="mt-4 space-y-3">
              <h4 className="font-semibold">
                {saved ? "Replacement preview" : "Preview"} for {year}
              </h4>
              {saved && (
                <p className="text-sm text-muted">
                  Your saved assignments stay unchanged until you confirm a
                  replacement.
                </p>
              )}
              {preview.map((a) => (
                <p key={a.giverId} className="break-words text-sm">
                  {a.giverName} → {a.receiverName}
                </p>
              ))}
              <div className="flex flex-wrap gap-3">
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => void run(true)}
                >
                  {saved
                    ? `Replace ${kind === "adult" ? "adult" : "kids’"} assignments`
                    : `Save ${kind === "adult" ? "adult" : "kids’"} assignments`}
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => setPreview(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-accent">
          {error}
        </p>
      )}
    </section>
  );
}
