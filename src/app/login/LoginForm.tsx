"use client";

import { useState } from "react";

export default function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    if (res.ok) {
      window.location.href = redirectTo || "/";
    } else {
      window.location.href = `/login?error=invalid${redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`;
    }

    setLoading(false);
  }

  async function handleMagicSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        redirect: redirectTo,
      }),
    });

    setMagicSent(true);
    setLoading(false);
  }

  if (magicSent) {
    return (
      <div className="rounded-xl bg-surface border border-border p-6 text-center shadow-sm">
        <div className="mb-3 text-3xl">📧</div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-sm text-muted">
          We sent you a login link. Click it to sign in.
        </p>
        <button
          onClick={() => { setMagicSent(false); setMode("password"); }}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Back to password login
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface border border-border p-6 shadow-sm">
      {mode === "password" ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagicSubmit} className="space-y-4">
          <div>
            <label htmlFor="magic-email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="magic-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {loading ? "Sending..." : "Email me a login link"}
          </button>
        </form>
      )}

      <div className="mt-4 text-center">
        <button
          onClick={() => setMode(mode === "password" ? "magic" : "password")}
          className="text-sm text-primary hover:underline"
        >
          {mode === "password" ? "Use email link instead" : "Use password instead"}
        </button>
      </div>
    </div>
  );
}
