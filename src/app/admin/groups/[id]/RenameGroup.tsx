"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RenameGroup({ groupId, currentName }: { groupId: number; currentName: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!name.trim() || name.trim() === currentName) {
      setEditing(false);
      setName(currentName);
      return;
    }
    setLoading(true);
    await fetch(`/api/exchange/groups/${groupId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    router.refresh();
    setEditing(false);
    setLoading(false);
  }

  if (!editing) {
    return (
      <h1 className="text-2xl font-bold">
        {currentName}
        <button onClick={() => setEditing(true)}
          className="ml-2 text-sm font-normal text-muted hover:text-primary">
          Rename
        </button>
      </h1>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setName(currentName); } }}
        autoFocus
        className="text-2xl font-bold border-b-2 border-primary bg-transparent outline-none"
      />
      <button onClick={save} disabled={loading}
        className="rounded-lg bg-primary px-3 py-1 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
        {loading ? "..." : "Save"}
      </button>
      <button onClick={() => { setEditing(false); setName(currentName); }}
        className="rounded-lg px-3 py-1 text-sm text-muted hover:text-foreground">
        Cancel
      </button>
    </div>
  );
}
