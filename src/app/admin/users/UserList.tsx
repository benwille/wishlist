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
};

export default function UserList({ users }: { users: User[] }) {
  const router = useRouter();
  const [acting, setActing] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

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

  return (
    <div className="space-y-3">
      {users.map((u) => (
        <div key={u.id}
          className={`rounded-xl border bg-surface p-4 shadow-sm ${u.active ? "border-border" : "border-border opacity-50"}`}>
          {editingId === u.id ? (
            <form onSubmit={(e) => { e.preventDefault(); updateUser(u.id, new FormData(e.currentTarget)); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input name="firstName" defaultValue={u.firstName} required
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                <input name="lastName" defaultValue={u.lastName} required
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <input name="email" type="email" defaultValue={u.email || ""} placeholder="Email"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isAdmin" defaultChecked={u.isAdmin === 1} className="rounded" />
                Admin
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={acting === u.id}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60">
                  Save
                </button>
                <button type="button" onClick={() => setEditingId(null)}
                  className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {u.firstName} {u.lastName}
                  {u.isAdmin === 1 && <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">Admin</span>}
                  {!u.active && <span className="ml-2 rounded-full bg-accent-light px-2 py-0.5 text-xs font-medium text-accent">Inactive</span>}
                </p>
                <p className="text-sm text-muted">{u.email || "No email"}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditingId(u.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light transition-colors">
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(u.id, u.active)}
                  disabled={acting === u.id}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-accent-light hover:text-accent transition-colors"
                >
                  {u.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
