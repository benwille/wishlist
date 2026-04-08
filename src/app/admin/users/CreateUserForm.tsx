"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateUserForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string)?.trim();

    if (!email) {
      setError("Email is required to send an invite.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email,
      }),
    });

    if (res.ok) {
      setSuccess(`Invite sent to ${email}`);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Failed to send invite");
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
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" required
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
          placeholder="They'll get an invite to set up their account" />
      </div>
      <button type="submit" disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
        {loading ? "Sending invite..." : "Send invite"}
      </button>
      {success && <p className="text-sm text-primary">{success}</p>}
      {error && <p className="text-sm text-accent">{error}</p>}
    </form>
  );
}
