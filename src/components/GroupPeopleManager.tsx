"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ExchangeDraw from "./ExchangeDraw";
type Person = {
  id: number;
  firstName: string;
  lastName: string;
  profileType: "adult" | "child";
  active: number;
};
type Exclusion = {
  personId1: number;
  personId2: number;
  profileType: "adult" | "child";
};
const button =
  "rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50";
const select =
  "min-w-0 max-w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
export default function GroupPeopleManager({
  groupId,
  records,
  memberIds,
  exclusions,
  adultEnabled,
  kidsEnabled,
  adultYears,
  kidsYears,
}: {
  groupId: number;
  records: Person[];
  memberIds: number[];
  exclusions: Exclusion[];
  adultEnabled: boolean;
  kidsEnabled: boolean;
  adultYears: number[];
  kidsYears: number[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState({
    adult: adultEnabled,
    child: kidsEnabled,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [selected, setSelected] = useState({ adult: "", child: "" }),
    [pairs, setPairs] = useState({ adult: ["", ""], child: ["", ""] });
  const name = (id: number) => {
    const p = records.find((p) => p.id === id);
    return p ? `${p.firstName} ${p.lastName}` : "Unavailable profile";
  };
  async function act(body: object) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/exchange/groups/${groupId}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Unable to update group");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update group");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div aria-busy={busy}>
      {error && (
        <p role="alert" className="mt-4 text-accent">
          {error}
        </p>
      )}
      <section
        aria-label="Group settings"
        className="mt-6 rounded-xl border border-border bg-surface p-5"
      >
        <h2 className="text-lg font-semibold">Group settings</h2>
        <div className="mt-3 flex flex-wrap gap-6">
          {(["adult", "child"] as const).map((kind) => (
            <label key={kind} className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={busy}
                checked={enabled[kind]}
                onChange={async (e) => {
                  const value = e.target.checked,
                    previous = enabled[kind];
                  setEnabled({ ...enabled, [kind]: value });
                  const saved = await act({
                    action: "settings",
                    profileType: kind,
                    enabled: value,
                  });
                  if (!saved)
                    setEnabled((current) => ({ ...current, [kind]: previous }));
                }}
              />
              {kind === "adult"
                ? "Adult exchange enabled"
                : "Kids exchange enabled"}
            </label>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Disabling an exchange stops new draws. Profiles, participation,
          exclusions and saved history are retained.
        </p>
      </section>
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Members</h2>
          <Link
            href="/admin/people"
            className="text-sm text-primary hover:underline"
          >
            Create or edit a person
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted">
          Select existing profiles. Adding an adult does not automatically add
          their children.
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {(["adult", "child"] as const).map((kind) => (
            <section
              id={kind === "child" ? "kids" : undefined}
              aria-label={kind === "adult" ? "Adult members" : "Kids members"}
              className="min-w-0 rounded-xl border border-border bg-surface p-5"
            >
              <h3 className="text-lg font-semibold">
                {kind === "adult" ? "Adults" : "Kids"}
              </h3>
              <ul className="mt-3 space-y-3">
                {records
                  .filter(
                    (p) => p.profileType === kind && memberIds.includes(p.id),
                  )
                  .map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>{name(p.id)}</span>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          void act({ action: "remove", personId: p.id })
                        }
                      >
                        Remove {p.firstName}
                      </button>
                    </li>
                  ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <select
                  className={`${select} flex-1`}
                  aria-label={
                    kind === "adult"
                      ? "Add adult participant"
                      : "Add child participant"
                  }
                  value={selected[kind]}
                  onChange={(e) =>
                    setSelected({ ...selected, [kind]: e.target.value })
                  }
                >
                  <option value="">
                    Choose existing {kind === "adult" ? "adult" : "child"}
                  </option>
                  {records
                    .filter(
                      (p) =>
                        p.active &&
                        p.profileType === kind &&
                        !memberIds.includes(p.id),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {name(p.id)}
                      </option>
                    ))}
                </select>
                <button
                  className={button}
                  disabled={busy || !selected[kind]}
                  onClick={() =>
                    void act({
                      action: "add",
                      personId: Number(selected[kind]),
                    })
                  }
                >
                  Add {kind === "adult" ? "adult" : "child"}
                </button>
              </div>
            </section>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Exclusions</h2>
        <p className="mt-2 text-sm text-muted">
          Each pair is excluded in both directions, in this group only.
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {(["adult", "child"] as const).map((kind) => (
            <section
              aria-label={
                kind === "adult" ? "Adult exclusions" : "Kids exclusions"
              }
              key={kind}
              className="min-w-0 rounded-xl border border-border bg-surface p-5"
            >
              <h3 className="text-lg font-semibold">
                {kind === "adult" ? "Adults" : "Kids"}
              </h3>
              <div className="mt-3 space-y-3">
                {exclusions
                  .filter((e) => e.profileType === kind)
                  .map((e) => (
                    <div
                      key={`${e.personId1}-${e.personId2}`}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-sm">
                        {name(e.personId1)} / {name(e.personId2)}
                      </span>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          void act({
                            action: "include",
                            personId1: e.personId1,
                            personId2: e.personId2,
                          })
                        }
                      >
                        Remove exclusion
                      </button>
                    </div>
                  ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {[0, 1].map((index) => (
                  <select
                    key={index}
                    className={`${select} w-full`}
                    aria-label={`${kind === "adult" ? "Adult" : "Child"} exclusion ${index + 1}`}
                    value={pairs[kind][index]}
                    onChange={(e) =>
                      setPairs({
                        ...pairs,
                        [kind]: pairs[kind].map((v, i) =>
                          i === index ? e.target.value : v,
                        ),
                      })
                    }
                  >
                    <option value="">Choose participant</option>
                    {records
                      .filter(
                        (p) =>
                          p.profileType === kind && memberIds.includes(p.id),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {name(p.id)}
                        </option>
                      ))}
                  </select>
                ))}
                <button
                  className={button}
                  disabled={
                    busy ||
                    !pairs[kind][0] ||
                    !pairs[kind][1] ||
                    pairs[kind][0] === pairs[kind][1]
                  }
                  onClick={() =>
                    void act({
                      action: "exclude",
                      personId1: Number(pairs[kind][0]),
                      personId2: Number(pairs[kind][1]),
                    })
                  }
                >
                  Add {kind === "adult" ? "adult" : "kids’"} exclusion
                </button>
              </div>
            </section>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Run exchanges</h2>
        <p className="mt-2 text-sm text-muted">
          Preview and save each draw independently.
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <ExchangeDraw
            groupId={groupId}
            kind="adult"
            enabled={adultEnabled}
            memberCount={
              records.filter(
                (p) => p.profileType === "adult" && memberIds.includes(p.id),
              ).length
            }
            savedYears={adultYears}
          />
          <ExchangeDraw
            groupId={groupId}
            kind="child"
            enabled={kidsEnabled}
            memberCount={
              records.filter(
                (p) => p.profileType === "child" && memberIds.includes(p.id),
              ).length
            }
            savedYears={kidsYears}
          />
        </div>
      </section>
      <a
        href={`/exchange/${groupId}`}
        className="mt-8 inline-block rounded-lg border border-border px-4 py-2 font-medium text-primary"
      >
        View all assignments
      </a>
    </div>
  );
}
