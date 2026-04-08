"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: number; firstName: string; lastName: string };

export default function MemberManager({
  groupId,
  members,
  allUsers,
  memberIds,
}: {
  groupId: number;
  members: { userId: number; firstName: string; lastName: string }[];
  allUsers: User[];
  memberIds: number[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");

  const nonMembers = allUsers.filter((u) => !memberIds.includes(u.id));

  async function addMember() {
    if (!selectedUser) return;
    setLoading(true);
    await fetch(`/api/exchange/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: Number(selectedUser) }),
    });
    setSelectedUser("");
    router.refresh();
    setLoading(false);
  }

  async function removeMember(userId: number) {
    setLoading(true);
    await fetch(`/api/exchange/groups/${groupId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {members.map((m) => (
          <span key={m.userId} className="inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1 text-sm font-medium text-primary-dark">
            {m.firstName} {m.lastName}
            <button onClick={() => removeMember(m.userId)} disabled={loading}
              className="ml-1 text-primary/60 hover:text-accent text-xs">✕</button>
          </span>
        ))}
        {members.length === 0 && <p className="text-sm text-muted">No members yet.</p>}
      </div>

      {nonMembers.length > 0 && (
        <div className="flex gap-2">
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">Add a member...</option>
            {nonMembers.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
          <button onClick={addMember} disabled={loading || !selectedUser}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
            Add
          </button>
        </div>
      )}
    </div>
  );
}
