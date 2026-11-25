"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/formatPrice";

export type PublicGift = {
  id: number; name: string; description: string | null; link: string | null;
  priceRange: string | null; claimed: boolean; mine: boolean; purchased: boolean;
};

export default function PublicWishlist({ token, items, isOwner, hasGuestClaims }: {
  token: string; items: PublicGift[]; isOwner: boolean; hasGuestClaims: boolean;
}) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"save" | "recover" | null>(null);
  const [email, setEmail] = useState("");
  const [privateUrl, setPrivateUrl] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [emailConfirmation, setEmailConfirmation] = useState<{ title: string; detail: string; recipient?: string } | null>(null);
  const emailFeedback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (emailConfirmation) emailFeedback.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [emailConfirmation]);

  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);

  async function request(path: string, body: object) {
    const response = await fetch(`/api/share/${token}/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({})) as { error?: string; message?: string; url?: string };
    if (!response.ok) throw new Error(result.error || "Couldn't update this gift. Please try again.");
    return result;
  }

  async function change(id: number, action: "claim" | "purchase" | "unclaim") {
    setActing(true); setError(null); setMessage(null);
    try {
      await request(`items/${id}`, { action });
      setConfirming(null);
      if (action === "claim") setMessage("Claimed! This browser will remember you. Email yourself a private link if you want to manage your claims on another device.");
      if (action === "purchase") setMessage("Marked as purchased. Other shoppers can see that this gift is taken.");
      if (action === "unclaim") setMessage("Claim released. This doesn't cancel an order with a store.");
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn't reach the server. Please try again."); }
    finally { router.refresh(); setActing(false); }
  }

  async function access(action: "save" | "recover" | "copy") {
    setActing(true); setAccessError(null); setEmailConfirmation(null);
    try {
      const result = await request("access", { mode: action, email });
      if (result.url) {
        setPrivateUrl(result.url);
        try { await navigator.clipboard.writeText(result.url); setMessage("Private recovery link copied. Keep it for yourself; share the original wishlist link with others."); }
        catch { setMessage("Your private recovery link is ready below. Keep it somewhere safe."); }
      } else {
        setEmailConfirmation({ title: action === "save" ? "Email sent" : "Request received", detail: result.message || "Check your email for your private link.", ...(action === "save" ? { recipient: email.trim() } : {}) });
        setMode(null);
      }
    } catch (error) { setAccessError(error instanceof Error ? error.message : "Couldn't reach the server. Please try again."); }
    finally { setActing(false); }
  }

  const button = "rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50";
  return <>
    {isOwner && <p className="mt-4 text-sm text-muted">This is your list. Claims are hidden here to keep gifts a surprise. <a href="/my-list" className="text-primary underline">Edit your list</a>.</p>}
    <div aria-live="polite" className="mt-4 space-y-2">
      {error && <p role="alert" className="rounded-lg bg-accent-light p-3 text-sm text-accent">{error}</p>}
      {message && <p className="rounded-lg bg-primary-light p-3 text-sm text-primary-dark">{message}</p>}
    </div>
    <div className="mt-6 space-y-3">
      {items.length === 0 && <p className="text-muted">There are no gifts on this list right now.</p>}
      {items.map((item) => <article key={item.id} className={`rounded-xl p-4 shadow-sm ${!isOwner && item.purchased ? "border-2 border-emerald-600 bg-emerald-50" : !isOwner && item.mine ? "border-2 border-amber-300 bg-amber-50/50" : "border border-border bg-surface"}`}>
        <div className="flex flex-wrap items-center gap-2">
          {item.link ? <a href={item.link} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{item.name}</a> : <span className="font-medium">{item.name}</span>}
          {item.priceRange && <span className="rounded-full bg-primary-light px-2 py-1 text-sm text-primary-dark">{formatPrice(item.priceRange)}</span>}
          {!isOwner && item.claimed && <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${item.purchased ? "bg-emerald-700 text-white" : "bg-amber-100 text-amber-900"}`}>
            {item.purchased && <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 10 4 4 8-8" /></svg>}
            {item.mine ? (item.purchased ? "Purchased by you" : "Claimed by you") : (item.purchased ? "Already purchased" : "Already claimed")}
          </span>}
        </div>
        {item.description && <p className="mt-2 text-muted">{item.description}</p>}
        {!isOwner && <div className="mt-3 flex flex-wrap items-center gap-2">
          {!item.claimed && confirming !== item.id && <button className={button} disabled={acting} onClick={() => setConfirming(item.id)}>Claim this gift</button>}
          {!item.claimed && confirming === item.id && <>
            <p className="w-full text-sm text-muted">You&apos;re planning to buy this gift. Claiming lets other people know it&apos;s taken; you&apos;ll still buy it at the store.</p>
            <button className={button} disabled={acting} onClick={() => change(item.id, "claim")}>{acting ? "Saving..." : "Confirm claim"}</button>
            <button className="rounded-lg px-3 py-2 text-sm text-muted" disabled={acting} onClick={() => setConfirming(null)}>Cancel</button>
          </>}
          {item.mine && !item.purchased && <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:opacity-50" disabled={acting} onClick={() => change(item.id, "purchase")}>
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 7h12l2 14H4L6 7Z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></svg>
            Bought it
          </button>}
          {item.mine && item.purchased && <p className="w-full font-medium text-emerald-900">All set — you&apos;ve marked this gift as bought.</p>}
          {item.mine && <button className="rounded-lg border border-border px-3 py-2 text-sm text-muted disabled:opacity-50" disabled={acting} onClick={() => change(item.id, "unclaim")}>Release claim</button>}
        </div>}
      </article>)}
    </div>
    {!isOwner && <section className="mt-8 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold">Your gift claims</h2>
      {emailConfirmation && <div ref={emailFeedback} role="status" aria-live="polite" className="mt-4 rounded-lg border-2 border-emerald-600 bg-emerald-50 p-4 text-emerald-950">
        <p className="font-semibold">{emailConfirmation.title}</p>
        {emailConfirmation.recipient && <p className="mt-1 text-sm">Your private link was sent to {emailConfirmation.recipient}.</p>}
        <p className="mt-1 text-sm">{emailConfirmation.detail}</p>
      </div>}
      {accessError && <p role="alert" className="mt-4 rounded-lg bg-accent-light p-3 text-sm text-accent">{accessError}</p>}
      <p className="mt-2 text-sm text-muted">No account or email is needed to claim. We remember this browser. Switching devices or clearing browser data? Use a private recovery link.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {hasGuestClaims && <>
          <button disabled={acting} className="text-sm font-medium text-primary underline" onClick={() => setMode("save")}>Email me a private link</button>
          <button disabled={acting} className="text-sm font-medium text-primary underline" onClick={() => access("copy")}>Copy my recovery link</button>
        </>}
        <button disabled={acting} className="text-sm font-medium text-primary underline" onClick={() => setMode("recover")}>Already claimed? Email me my access link</button>
      </div>
      {mode && <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); access(mode); }}>
        <label className="block text-sm" htmlFor="recovery-email">{mode === "save" ? "Email to save your claims (optional)" : "Email you previously confirmed for this wishlist"}</label>
        <input id="recovery-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        <p className="text-sm text-muted">We only send the access link you request. No marketing or account signup.</p>
        <button className={button} disabled={acting}>{acting ? "Sending..." : "Email my access link"}</button>
        <button type="button" className="ml-3 text-sm text-muted" onClick={() => setMode(null)}>Cancel</button>
      </form>}
      {privateUrl && <label className="mt-4 block text-sm">Your private link — keep this for yourself
        <input readOnly value={privateUrl} onFocus={(event) => event.target.select()} className="mt-2 w-full rounded-lg border border-border px-3 py-2" />
      </label>}
      <p className="mt-3 text-sm text-muted">Claimed while signed in? <a className="text-primary underline" href={`/login?redirect=${encodeURIComponent(`/share/${token}`)}`}>Sign in to manage your gifts</a>.</p>
    </section>}
  </>;
}
