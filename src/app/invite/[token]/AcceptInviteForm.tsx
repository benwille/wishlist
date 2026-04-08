"use client";

import { useState } from "react";

export default function AcceptInviteForm({
  token,
  firstName,
  lastName,
}: {
  token: string;
  firstName: string;
  lastName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;

    if (password !== confirm) {
      setError("Passwords don't match.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        password,
      }),
    });

    if (res.ok) {
      window.location.href = "/";
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Something went wrong");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium">First name</label>
          <input id="firstName" name="firstName" required defaultValue={firstName}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium">Last name</label>
          <input id="lastName" name="lastName" required defaultValue={lastName}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">Create a password</label>
        <input id="password" name="password" type="password" required minLength={6}
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium">Confirm password</label>
        <input id="confirm" name="confirm" type="password" required minLength={6}
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
        {loading ? "Setting up..." : "Create my account"}
      </button>
      {error && <p className="text-sm text-accent">{error}</p>}
    </form>
  );
}
