"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { userId: number; firstName: string; lastName: string };
type Exclusion = { id: number; userId1: number; userId2: number };

export default function ExclusionManager({
  groupId,
  exclusions,
  members,
}: {
  groupId: number;
  exclusions: Exclusion[];
  members: Member[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [person1, setPerson1] = useState("");
  const [person2, setPerson2] = useState("");

  const memberMap = new Map(members.map((m) => [m.userId, `${m.firstName} ${m.lastName}`]));

  async function addExclusion() {
    if (!person1 || !person2 || person1 === person2) return;
    setLoading(true);
    await fetch(`/api/exchange/groups/${groupId}/exclusions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId1: Number(person1), userId2: Number(person2) }),
    });
    setPerson1("");
    setPerson2("");
    router.refresh();
    setLoading(false);
  }

  async function removeExclusion(exclusionId: number) {
    setLoading(true);
    await fetch(`/api/exchange/groups/${groupId}/exclusions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: exclusionId }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div>
      {exclusions.length > 0 ? (
        <div className="space-y-2 mb-4">
          {exclusions.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between rounded-lg bg-accent-light/50 px-3 py-2 text-sm">
              <span>{memberMap.get(ex.userId1) || "?"} ↔ {memberMap.get(ex.userId2) || "?"}</span>
              <button onClick={() => removeExclusion(ex.id)} disabled={loading}
                className="text-xs text-muted hover:text-accent">Remove</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-muted">No exclusions set.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <select value={person1} onChange={(e) => setPerson1(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
          <option value="">Person 1...</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.firstName} {m.lastName}</option>
          ))}
        </select>
        <span className="self-center text-sm text-muted">↔</span>
        <select value={person2} onChange={(e) => setPerson2(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
          <option value="">Person 2...</option>
          {members.filter((m) => String(m.userId) !== person1).map((m) => (
            <option key={m.userId} value={m.userId}>{m.firstName} {m.lastName}</option>
          ))}
        </select>
        <button onClick={addExclusion} disabled={loading || !person1 || !person2}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
          Add
        </button>
      </div>
    </div>
  );
}
