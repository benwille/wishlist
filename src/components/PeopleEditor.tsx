"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
export type ProfileRow = {
  id: number;
  firstName: string;
  lastName: string;
  profileType: "adult" | "child";
  active: number;
  accountId?: number | null;
  guardianIds?: number[];
};
type Adult = { id: number; firstName: string; lastName: string };
const button =
  "rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50";
const input =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base";
export default function PeopleEditor({
  records,
  adults,
  admin,
}: {
  records: ProfileRow[];
  adults: Adult[];
  admin: boolean;
}) {
  const router = useRouter(),
    formRef = useRef<HTMLFormElement>(null),
    firstRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<number | null>(null),
    [profileType, setType] = useState<"adult" | "child">("adult"),
    [firstName, setFirst] = useState(""),
    [lastName, setLast] = useState(""),
    [email, setEmail] = useState(""),
    [guardianIds, setGuardians] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const name = (p: Adult) => `${p.firstName} ${p.lastName}`;
  function reset() {
    setEditing(null);
    setFirst("");
    setLast("");
    setEmail("");
    setGuardians([]);
    setType("adult");
  }
  function edit(p: ProfileRow) {
    setEditing(p.id);
    setFirst(p.firstName);
    setLast(p.lastName);
    setType(p.profileType);
    setGuardians(p.guardianIds ?? []);
    setError("");
    setMessage("");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      firstRef.current?.focus({ preventScroll: true });
    });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const invite =
        admin && !editing && profileType === "adult" && email.trim();
      const payload = invite
        ? { firstName, lastName, email: email.trim() }
        : {
            action: editing ? "edit" : "create",
            id: editing,
            firstName,
            lastName,
            ...(admin
              ? {
                  profileType,
                  ...(profileType === "child" ? { guardianIds } : {}),
                }
              : {}),
          };
      const response = await fetch(
        invite ? "/api/users/invite" : "/api/people",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save profile");
      setMessage(
        invite
          ? "Adult created and invitation sent."
          : editing
            ? "Profile saved."
            : "Person created. Add them to an exchange group when you’re ready.",
      );
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save profile");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div aria-busy={busy}>
      {message && (
        <p role="status" className="mt-4 text-primary">
          {message}
        </p>
      )}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {(["adult", "child"] as const).map((kind) => (
          <section
            key={kind}
            aria-label={kind === "adult" ? "Adults" : "Kids"}
            className="min-w-0 rounded-xl border border-border bg-surface p-5"
          >
            <h2 className="text-lg font-semibold">
              {kind === "adult" ? "Adults" : "Kids"}
            </h2>
            <div className="mt-4 space-y-4">
              {records
                .filter((p) => p.profileType === kind)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3"
                  >
                    <div>
                      <p className="font-medium">{name(p)}</p>
                      {!p.active && (
                        <p className="text-sm text-muted">
                          Account inactive or invitation pending
                        </p>
                      )}
                      {admin && kind === "child" && (
                        <p className="text-sm text-muted">
                          Linked adults:{" "}
                          {(p.guardianIds ?? [])
                            .map((id) => adults.find((a) => a.id === id))
                            .filter((a): a is Adult => !!a)
                            .map(name)
                            .join(", ") || "Review adult links"}
                        </p>
                      )}
                    </div>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => edit(p)}
                    >
                      Edit {p.firstName}
                    </button>
                  </div>
                ))}
              {!records.some((p) => p.profileType === kind) && (
                <p className="text-sm text-muted">
                  {kind === "adult"
                    ? "No adult profiles."
                    : "No linked children yet."}
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
      {(admin || editing !== null) && (
        <form
          ref={formRef}
          aria-labelledby="profile-form-title"
          className="mt-6 scroll-mt-6 space-y-4 rounded-xl border border-border bg-surface p-5"
          onSubmit={save}
        >
          <h2 id="profile-form-title" className="text-lg font-semibold">
            {editing
              ? `Edit ${records.find((p) => p.id === editing)?.firstName}`
              : "Add person"}
          </h2>
          {error && (
            <p role="alert" className="text-accent">
              {error}
            </p>
          )}
          {admin && (
            <label className="block">
              Person type
              <select
                aria-label="Person type"
                className={input}
                value={profileType}
                disabled={editing !== null || busy}
                onChange={(e) => {
                  setType(e.target.value as "adult" | "child");
                  setGuardians([]);
                  setEmail("");
                }}
              >
                <option value="adult">Adult</option>
                <option value="child">Child</option>
              </select>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              First name
              <input
                ref={firstRef}
                className={input}
                required
                maxLength={100}
                value={firstName}
                onChange={(e) => setFirst(e.target.value)}
              />
            </label>
            <label>
              Last name
              <input
                className={input}
                required
                maxLength={100}
                value={lastName}
                onChange={(e) => setLast(e.target.value)}
              />
            </label>
          </div>
          {admin && profileType === "child" && (
            <fieldset>
              <legend className="font-medium">Linked adults</legend>
              <p className="mt-1 text-sm text-muted">
                Choose one or more adults who can manage this child’s profile
                and see their assignments. These links apply across groups.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {adults.map((a) => (
                  <label key={a.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={guardianIds.includes(a.id)}
                      onChange={(e) =>
                        setGuardians(
                          e.target.checked
                            ? [...guardianIds, a.id]
                            : guardianIds.filter((id) => id !== a.id),
                        )
                      }
                    />
                    {name(a)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {admin && !editing && profileType === "adult" && (
            <label className="block">
              Email (optional)
              <input
                className={input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="mt-1 block text-sm text-muted">
                Include an email to send an invitation. Leave it blank to create
                the profile first.
              </span>
            </label>
          )}
          {admin && editing && profileType === "adult" && (
            <Link
              href="/admin/accounts"
              className="inline-block text-sm text-primary hover:underline"
            >
              Manage login, email and account access
            </Link>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className={button}
              disabled={
                busy ||
                (admin && profileType === "child" && !guardianIds.length)
              }
            >
              {busy
                ? "Saving…"
                : editing
                  ? "Save person"
                  : email && profileType === "adult"
                    ? "Create adult and send invite"
                    : "Create person"}
            </button>
            {editing && (
              <button
                type="button"
                disabled={busy}
                className={button}
                onClick={reset}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
