"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Person = { id: number; firstName: string; lastName: string };
type Child = Person & { adultIds: number[] };
type Assignment = {
  giverId: number;
  receiverId: number;
  giverName: string;
  receiverName: string;
};
type Saved = {
  year: number;
  giverFirstName: string;
  giverLastName: string;
  receiverFirstName: string;
  receiverLastName: string;
};
const box = "mt-6 space-y-4 rounded-xl border border-border bg-surface p-5";
const input = "rounded-lg border border-border bg-background px-3 py-2";
const button =
  "rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50";
export default function KidsManager({
  groupId,
  records,
  adults,
  memberIds,
  exclusions,
  assignments,
}: {
  groupId: number;
  records: Child[];
  adults: Person[];
  memberIds: number[];
  exclusions: { childId1: number; childId2: number }[];
  assignments: Saved[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [editing, setEditing] = useState<number | null>(null),
    [firstName, setFirst] = useState(""),
    [lastName, setLast] = useState(""),
    [adultIds, setAdults] = useState<number[]>([]);
  const [pair, setPair] = useState(["", ""]),
    [existing, setExisting] = useState("");
  const [year, setYear] = useState(new Date().getFullYear()),
    [preview, setPreview] = useState<Assignment[] | null>(null);
  const members = records.filter((c) => memberIds.includes(c.id));
  const name = (id: number) => {
    const c = records.find((c) => c.id === id);
    return c ? `${c.firstName} ${c.lastName}` : "Unknown";
  };
  async function act(body: object, refresh = true) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/exchange/groups/${groupId}/kids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        assignments?: Assignment[];
      };
      if (!res.ok) throw new Error(data.error || "Unable to save");
      if (refresh) router.refresh();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function saveDraw() {
    const replace = assignments.some((a) => a.year === year);
    if (
      replace &&
      !window.confirm(`Replace the saved kids’ assignments for ${year}?`)
    )
      return;
    const data = await act(
      { action: "save", year, assignments: preview, replace },
      false,
    );
    if (data) {
      setPreview(null);
      setMessage(`Assignments saved for ${year}.`);
      router.refresh();
    }
  }
  return (
    <div aria-busy={busy}>
      {error && (
        <p role="alert" className="mt-4 text-accent">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 text-primary">
          {message}
        </p>
      )}
      <section className={box}>
        <h2 className="text-lg font-semibold">Kids ({members.length})</h2>
        {members.length === 0 && (
          <p className="text-muted">No kids in this exchange yet.</p>
        )}
        {members.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"
          >
            <div>
              <p className="font-medium">{name(c.id)}</p>
              <p className="text-sm text-muted">
                Linked adults:{" "}
                {c.adultIds
                  .map((id) => {
                    const a = adults.find((a) => a.id === id);
                    return a
                      ? `${a.firstName} ${a.lastName}`
                      : "Inactive adult";
                  })
                  .join(", ") || "None"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className={button}
                disabled={busy}
                onClick={() => {
                  setEditing(c.id);
                  setFirst(c.firstName);
                  setLast(c.lastName);
                  setAdults(
                    c.adultIds.filter((id) => adults.some((a) => a.id === id)),
                  );
                }}
              >
                Edit
              </button>
              <button
                className={button}
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Remove ${name(c.id)} from future draws? Saved assignments will remain.`,
                    )
                  )
                    void act({ action: "remove", childId: c.id });
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </section>
      <form
        className={box}
        onSubmit={async (e) => {
          e.preventDefault();
          const data = await act({
            action: editing ? "edit" : "create",
            childId: editing,
            firstName,
            lastName,
            adultIds,
          });
          if (data) {
            setEditing(null);
            setFirst("");
            setLast("");
            setAdults([]);
          }
        }}
      >
        <h2 className="text-lg font-semibold">
          {editing ? "Edit child" : "Add a child"}
        </h2>
        <div className="flex flex-wrap gap-3">
          <label>
            First name{" "}
            <input
              className={input}
              required
              maxLength={100}
              value={firstName}
              onChange={(e) => setFirst(e.target.value)}
            />
          </label>
          <label>
            Last name{" "}
            <input
              className={input}
              required
              maxLength={100}
              value={lastName}
              onChange={(e) => setLast(e.target.value)}
            />
          </label>
        </div>
        <fieldset>
          <legend className="mb-2 font-medium">Linked adults</legend>
          <p className="mb-2 text-sm text-muted">
            Select one or more. Every linked adult can see this child’s
            assignments.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {adults.map((a) => (
              <label key={a.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adultIds.includes(a.id)}
                  onChange={(e) =>
                    setAdults(
                      e.target.checked
                        ? [...adultIds, a.id]
                        : adultIds.filter((id) => id !== a.id),
                    )
                  }
                />
                {a.firstName} {a.lastName}
              </label>
            ))}
          </div>
        </fieldset>
        <button className={button} disabled={busy || !adultIds.length}>
          {editing ? "Save child" : "Add to kids’ exchange"}
        </button>
        {editing && (
          <button
            type="button"
            className={button}
            onClick={() => {
              setEditing(null);
              setFirst("");
              setLast("");
              setAdults([]);
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      {records.some((c) => !memberIds.includes(c.id)) && (
        <form
          className={box}
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: "add", childId: Number(existing) });
          }}
        >
          <label>
            Add an existing child{" "}
            <select
              className={input}
              required
              value={existing}
              onChange={(e) => setExisting(e.target.value)}
            >
              <option value="">Choose child</option>
              {records
                .filter((c) => !memberIds.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {name(c.id)}
                  </option>
                ))}
            </select>
          </label>
          <button className={button} disabled={busy}>
            Add to exchange
          </button>
        </form>
      )}
      <section className={box}>
        <h2 className="text-lg font-semibold">Sibling exclusions</h2>
        <p className="text-sm text-muted">
          Each pair is excluded in both directions.
        </p>
        {exclusions.map((p) => (
          <div
            key={`${p.childId1}-${p.childId2}`}
            className="flex items-center justify-between gap-3"
          >
            <span>
              {name(p.childId1)} / {name(p.childId2)}
            </span>
            <button
              className={button}
              disabled={busy}
              onClick={() => void act({ action: "include", ...p })}
            >
              Remove exclusion
            </button>
          </div>
        ))}
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act({
              action: "exclude",
              childId1: Number(pair[0]),
              childId2: Number(pair[1]),
            });
          }}
        >
          {[0, 1].map((i) => (
            <select
              aria-label={`Excluded child ${i + 1}`}
              key={i}
              className={input}
              required
              value={pair[i]}
              onChange={(e) =>
                setPair(pair.map((v, n) => (n === i ? e.target.value : v)))
              }
            >
              <option value="">Choose child</option>
              {members.map((c) => (
                <option value={c.id} key={c.id}>
                  {name(c.id)}
                </option>
              ))}
            </select>
          ))}
          <button className={button} disabled={busy || pair[0] === pair[1]}>
            Add exclusion
          </button>
        </form>
      </section>
      <section className={box}>
        <h2 className="text-lg font-semibold">Run kids’ exchange</h2>
        <div className="flex flex-wrap gap-3">
          <label>
            Year{" "}
            <input
              className={`${input} w-28`}
              type="number"
              min={2000}
              max={9999}
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setPreview(null);
              }}
            />
          </label>
          <button
            className={button}
            disabled={busy || members.length < 2}
            onClick={async () => {
              setPreview(null);
              const data = await act({ action: "preview", year }, false);
              if (data?.assignments) setPreview(data.assignments);
            }}
          >
            Generate preview
          </button>
        </div>
        {members.length < 2 && (
          <p className="text-sm text-muted">
            Add at least two children to generate a draw.
          </p>
        )}
        {preview && (
          <div className="space-y-3">
            <h3 className="font-semibold">Preview for {year}</h3>
            {preview.map((a) => (
              <p key={a.giverId}>
                {a.giverName} → {a.receiverName}
              </p>
            ))}
            <button className={button} disabled={busy} onClick={saveDraw}>
              Save assignments
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Cancel
            </button>
          </div>
        )}
      </section>
      <section className={box}>
        <h2 className="text-lg font-semibold">Kids’ assignment history</h2>
        {!assignments.length && (
          <p className="text-muted">No saved draws yet.</p>
        )}
        {[...new Set(assignments.map((a) => a.year))]
          .sort((a, b) => b - a)
          .map((y) => (
            <div key={y}>
              <h3 className="font-semibold">{y}</h3>
              {assignments
                .filter((a) => a.year === y)
                .map((a, i) => (
                  <p key={i}>
                    {a.giverFirstName} {a.giverLastName} → {a.receiverFirstName}{" "}
                    {a.receiverLastName}
                  </p>
                ))}
            </div>
          ))}
      </section>
    </div>
  );
}
