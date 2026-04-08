"use client";

import { useState } from "react";

export default function PasswordForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setError("");

    const form = new FormData(e.currentTarget);
    const current = form.get("current") as string;
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;

    if (password !== confirm) {
      setError("Passwords don't match.");
      setStatus("error");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setStatus("error");
      return;
    }

    const res = await fetch("/api/users/me/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: password }),
    });

    if (res.ok) {
      setStatus("success");
      (e.target as HTMLFormElement).reset();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Failed to update password.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="current" className="block text-sm font-medium">Current password</label>
        <input id="current" name="current" type="password" required
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">New password</label>
        <input id="password" name="password" type="password" required minLength={6}
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" required minLength={6}
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>
      <button type="submit" disabled={status === "saving"}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
        {status === "saving" ? "Saving..." : "Update password"}
      </button>
      {status === "success" && <p className="text-sm text-primary">Password updated.</p>}
      {status === "error" && <p className="text-sm text-accent">{error}</p>}
    </form>
  );
}
