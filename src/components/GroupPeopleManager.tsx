"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ExchangeDraw from "./ExchangeDraw";
type Person = {
  id: number;
  firstName: string;
  lastName: string;
  profileType: "adult" | "child";
  active: number;
  hasAccount?: boolean;
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
  rosterIds,
  exclusions,
  adultEnabled,
  kidsEnabled,
  adultYears,
  kidsYears,
}: {
  groupId: number;
  records: Person[];
  memberIds: number[];
  rosterIds: number[];
  exclusions: Exclusion[];
  adultEnabled: boolean;
  kidsEnabled: boolean;
  adultYears: number[];
  kidsYears: number[];
}) {
  const router = useRouter();
  const [selectedPerson, setSelectedPerson] = useState("");
  const [participatingIds, setParticipatingIds] = useState(memberIds);
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => setParticipatingIds(memberIds), [memberIds]);
  const [enabled, setEnabled] = useState({
    adult: adultEnabled,
    child: kidsEnabled,
  });
  const [saving, setBusy] = useState(false),
    [error, setError] = useState("");
  const [pairs, setPairs] = useState({ adult: ["", ""], child: ["", ""] });
  const busy = saving || refreshing;
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
      startRefresh(() => router.refresh());
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
      <section aria-label="Group members" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Group members</h2>
            <p className="mt-1 text-sm text-muted">
              {rosterIds.length} members · {participatingIds.length} in the
              exchange
            </p>
          </div>
          <Link
            href="/admin/people"
            className="text-sm text-primary hover:underline"
          >
            Create or edit a person
          </Link>
        </div>
        <p className="mt-3 text-sm text-muted">
          Everyone stays in the group whether or not they join a draw.
          Unchecking a member keeps their family access. Saved draws are
          unchanged.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-border bg-surface p-4">
          <select
            className={`${select} flex-1 basis-48`}
            aria-label="Add group member"
            value={selectedPerson}
            disabled={busy}
            onChange={(e) => setSelectedPerson(e.target.value)}
          >
            <option value="">Choose an existing person</option>
            {(["adult", "child"] as const).map((kind) => (
              <optgroup key={kind} label={kind === "adult" ? "Adults" : "Kids"}>
                {records
                  .filter(
                    (p) =>
                      p.active &&
                      p.profileType === kind &&
                      (kind === "child" || p.hasAccount) &&
                      !rosterIds.includes(p.id),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {name(p.id)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <button
            className={button}
            disabled={busy || !selectedPerson}
            onClick={async () => {
              if (
                await act({
                  action: "add-member",
                  personId: Number(selectedPerson),
                })
              )
                setSelectedPerson("");
            }}
          >
            Add member
          </button>
          <p className="basis-full text-sm text-muted">
            New members start outside the exchange. Add adults and children
            separately.
          </p>
        </div>
        <ul
          aria-label="Member roster"
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          {records
            .filter((p) => rosterIds.includes(p.id))
            .map((p) => {
              const participating = participatingIds.includes(p.id);
              return (
                <li
                  key={p.id}
                  className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{name(p.id)}</p>
                      <p className="mt-1 text-sm text-muted">
                        {p.profileType === "adult" ? "Adult" : "Child"}
                        {!p.active && " · Inactive"}
                      </p>
                    </div>
                    <button
                      className="shrink-0 rounded px-2 py-1 text-sm text-muted hover:text-accent disabled:opacity-50"
                      aria-label={`Remove ${name(p.id)} from group`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${name(p.id)} from this group? Their profile and saved draw history will be kept.`,
                          )
                        )
                          void act({ action: "remove-member", personId: p.id });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-background px-3 py-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      aria-label={`In the exchange: ${name(p.id)}`}
                      checked={participating}
                      disabled={busy || (!p.active && !participating)}
                      onChange={async (e) => {
                        const next = e.target.checked;
                        setParticipatingIds((current) =>
                          next
                            ? [...new Set([...current, p.id])]
                            : current.filter((id) => id !== p.id),
                        );
                        if (
                          !(await act({
                            action: "participation",
                            personId: p.id,
                            enabled: next,
                          }))
                        )
                          setParticipatingIds((current) =>
                            participating
                              ? [...new Set([...current, p.id])]
                              : current.filter((id) => id !== p.id),
                          );
                      }}
                    />
                    <span>
                      In the {p.profileType === "child" ? "kids’ " : ""}exchange
                    </span>
                  </label>
                </li>
              );
            })}
        </ul>
        {rosterIds.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-muted">
            No members yet. Add a person above to get started.
          </p>
        )}
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
                      className="flex items-center justify-between gap-3 rounded-lg bg-accent-light/50 px-3 py-2"
                    >
                      <span className="min-w-0 break-words text-sm">
                        {name(e.personId1)} / {name(e.personId2)}
                      </span>
                      <button
                        className="shrink-0 text-sm text-muted hover:text-accent disabled:opacity-50"
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
                    className={`${select} flex-1 basis-28`}
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
                  onClick={async () => {
                    if (
                      await act({
                        action: "exclude",
                        personId1: Number(pairs[kind][0]),
                        personId2: Number(pairs[kind][1]),
                      })
                    )
                      setPairs((current) => ({ ...current, [kind]: ["", ""] }));
                  }}
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
            key={JSON.stringify([
              adultEnabled,
              memberIds.filter((id) =>
                records.some((p) => p.id === id && p.profileType === "adult"),
              ),
              exclusions.filter((e) => e.profileType === "adult"),
            ])}
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
            key={JSON.stringify([
              kidsEnabled,
              memberIds.filter((id) =>
                records.some((p) => p.id === id && p.profileType === "child"),
              ),
              exclusions.filter((e) => e.profileType === "child"),
            ])}
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
