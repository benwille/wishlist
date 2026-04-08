"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateGroupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/exchange/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name") }),
    });

    if (res.ok) {
      const data = (await res.json()) as { id: number };
      router.push(`/admin/groups/${data.id}`);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input name="name" required placeholder="e.g. Adults, Kids, Cousins"
        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      <button type="submit" disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
        {loading ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
