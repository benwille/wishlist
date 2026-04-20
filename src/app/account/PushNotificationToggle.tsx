"use client";

import { useState, useEffect } from "react";

const VAPID_PUBLIC_KEY = "BIplwGDJB477A__M87T_RLeURk3RmR3yYeugzKqA7h0E_vNmnW9Vd64gfnBhZpBBgrL4NBbTjJo1gpXPlr_hFK4";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type PushState =
  | "loading"
  | "unsupported"
  | "install-ios"
  | "denied"
  | "subscribed"
  | "unsubscribed";

export default function PushNotificationToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS-specific non-standard property
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    // iOS Safari outside a home-screen PWA can't receive push — prompt install
    if (isIOS && !isStandalone) {
      sessionStorage.removeItem("pwa-dismissed");
      window.dispatchEvent(new Event("pwa-install-prompt"));
      setState("install-ios");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? "subscribed" : "unsubscribed");
      });
    });
  }, []);

  async function subscribe() {
    setActing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: json.keys,
        }),
      });

      setState("subscribed");
    } catch {
      // User cancelled or browser error
    } finally {
      setActing(false);
    }
  }

  async function unsubscribe() {
    setActing(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch {
      // Ignore
    } finally {
      setActing(false);
    }
  }

  if (state === "loading") {
    return <p className="text-sm text-muted">Checking notification support...</p>;
  }

  if (state === "install-ios") {
    return (
      <div className="rounded-lg border border-border bg-accent-light/40 p-3">
        <p className="text-sm font-medium">Add Wishlist to your home screen</p>
        <p className="mt-1 text-xs text-muted">
          To get notifications on iPhone or iPad, install the app first: tap the Share button in Safari,
          then &ldquo;Add to Home Screen.&rdquo; Open the installed app and come back here to turn notifications on.
        </p>
      </div>
    );
  }

  if (state === "unsupported") {
    return <p className="text-sm text-muted">Push notifications aren&apos;t supported on this browser.</p>;
  }

  if (state === "denied") {
    return (
      <p className="text-sm text-muted">
        Notifications are blocked. To enable them, update your browser&apos;s notification settings for this site.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium">
        {state === "subscribed" ? "Notifications are on" : "Notifications are off"}
      </p>
      <p className="mt-1 text-xs text-muted">
        {state === "subscribed"
          ? "You\u2019ll get notified about activity on your lists."
          : "Enable to get notified when someone interacts with your list."}
      </p>
      <button
        onClick={state === "subscribed" ? unsubscribe : subscribe}
        disabled={acting}
        className={`mt-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
          state === "subscribed"
            ? "text-muted hover:bg-accent-light hover:text-accent"
            : "bg-primary text-white hover:bg-primary-dark"
        }`}
      >
        {acting ? "..." : state === "subscribed" ? "Turn Off" : "Turn On"}
      </button>
    </div>
  );
}
