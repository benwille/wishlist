"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  isAdmin: number;
  active: number;
  inviteToken: string | null;
};

export default function UserList({ users }: { users: User[] }) {
  const router = useRouter();
  const [acting, setActing] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteState, setDeleteState] = useState<"confirming" | "blocked" | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const activeUsers = users.filter((u) => u.active || u.inviteToken);
  const inactiveUsers = users.filter((u) => !u.active && !u.inviteToken);

  async function toggleActive(userId: number, currentlyActive: number) {
    setActing(userId);
    await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: currentlyActive ? 0 : 1 }),
    });
    router.refresh();
    setActing(null);
  }

  async function updateUser(userId: number, form: FormData) {
    setActing(userId);
    const data: Record<string, unknown> = {};
    const email = form.get("email") as string;
    const firstName = form.get("firstName") as string;
    const lastName = form.get("lastName") as string;
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;
    data.email = email || null;
    data.isAdmin = form.get("isAdmin") === "on";

    await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingId(null);
    router.refresh();
    setActing(null);
  }

  async function handleDeleteClick(user: User) {
    setDeleteTarget(user);
    setDeleteState(null);
    setBlockReason("");

    // Check eligibility without actually deleting
    const res = await fetch(`/api/users/${user.id}?check=1`, { method: "DELETE" });
    if (res.status === 409) {
      const body = (await res.json()) as { reason: string };
      setDeleteState("blocked");
      setBlockReason(body.reason);
    } else if (res.ok) {
      setDeleteState("confirming");
    } else {
      // Auth error or unexpected — close
      setDeleteTarget(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setActing(deleteTarget.id);
    const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteTarget(null);
      setDeleteState(null);
      router.refresh();
    } else if (res.status === 409) {
      // Race condition — became ineligible between check and confirm
      const body = (await res.json()) as { error: string };
      setDeleteState("blocked");
      setBlockReason(body.error);
    }
    setActing(null);
  }

  async function confirmDeactivate() {
    if (!deleteTarget) return;
    setActing(deleteTarget.id);
    await fetch(`/api/users/${deleteTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: 0 }),
    });
    setDeleteTarget(null);
    setDeleteState(null);
    setActing(null);
    router.refresh();
  }

  async function resendInvite(userId: number) {
    setActing(userId);
    await fetch(`/api/users/${userId}/resend-invite`, { method: "POST" });
    router.refresh();
    setActing(null);
  }

  function closeModal() {
    setDeleteTarget(null);
    setDeleteState(null);
    setBlockReason("");
  }

  function renderUserCard(u: User) {
    return (
      <div
        key={u.id}
        className={`rounded-xl border bg-surface p-4 shadow-sm ${u.active || u.inviteToken ? "border-border" : "border-border opacity-50"}`}
      >
        {editingId === u.id ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateUser(u.id, new FormData(e.currentTarget));
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <input
                name="firstName"
                defaultValue={u.firstName}
                required
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                name="lastName"
                defaultValue={u.lastName}
                required
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <input
              name="email"
              type="email"
              defaultValue={u.email || ""}
              placeholder="Email"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isAdmin" defaultChecked={u.isAdmin === 1} className="rounded" />
              Admin
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={acting === u.id}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {u.firstName} {u.lastName}
                {u.isAdmin === 1 && (
                  <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">
                    Admin
                  </span>
                )}
                {u.inviteToken && (
                  <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                    Invite Pending
                  </span>
                )}
                {!u.active && !u.inviteToken && (
                  <span className="ml-2 rounded-full bg-accent-light px-2 py-0.5 text-xs font-medium text-accent">
                    Inactive
                  </span>
                )}
              </p>
              <p className="text-sm text-muted">{u.email || "No email"}</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setEditingId(u.id)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light transition-colors"
              >
                Edit
              </button>
              {u.inviteToken ? (
                <button
                  onClick={() => resendInvite(u.id)}
                  disabled={acting === u.id}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-50 transition-colors"
                >
                  Resend Invite
                </button>
              ) : (
                <button
                  onClick={() => toggleActive(u.id, u.active)}
                  disabled={acting === u.id}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-accent-light hover:text-accent transition-colors"
                >
                  {u.active ? "Deactivate" : "Reactivate"}
                </button>
              )}
              <button
                onClick={() => handleDeleteClick(u)}
                disabled={acting === u.id}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Active users */}
      <div className="space-y-3">{activeUsers.map(renderUserCard)}</div>

      {/* Deactivated users accordion */}
      {inactiveUsers.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            <span>Deactivated Users ({inactiveUsers.length})</span>
            <svg
              className={`h-4 w-4 transition-transform ${showInactive ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showInactive && <div className="mt-3 space-y-3">{inactiveUsers.map(renderUserCard)}</div>}
        </div>
      )}

      {/* Delete / blocked modal */}
      {deleteTarget && deleteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeModal}>
          <div
            className="mx-4 w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteState === "confirming" ? (
              <>
                <h3 className="text-lg font-semibold">
                  Delete {deleteTarget.firstName} {deleteTarget.lastName}?
                </h3>
                <p className="mt-2 text-sm text-muted">
                  This will permanently remove their account, wishlist items, and group memberships. This can&apos;t be
                  undone.
                </p>
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={closeModal}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={acting === deleteTarget.id}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">
                  Can&apos;t delete {deleteTarget.firstName} {deleteTarget.lastName}
                </h3>
                <p className="mt-2 text-sm text-muted">{blockReason}</p>
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={closeModal}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  {deleteTarget.active ? (
                    <button
                      onClick={confirmDeactivate}
                      disabled={acting === deleteTarget.id}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition-colors"
                    >
                      Deactivate Instead
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
