"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateUserForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email") || null,
        password: form.get("password") || null,
        isAdmin: form.get("isAdmin") === "on",
      }),
    });

    if (res.ok) {
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Failed to create user");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium">First name</label>
          <input id="firstName" name="firstName" required
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium">Last name</label>
          <input id="lastName" name="lastName" required
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">Email <span className="text-muted font-normal">(optional — needed for login)</span></label>
        <input id="email" name="email" type="email"
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">Password <span className="text-muted font-normal">(optional — can use magic link instead)</span></label>
        <input id="password" name="password" type="password" minLength={6}
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isAdmin" className="rounded" />
        Admin
      </label>
      <button type="submit" disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
        {loading ? "Creating..." : "Create user"}
      </button>
      {error && <p className="text-sm text-accent">{error}</p>}
    </form>
  );
}
