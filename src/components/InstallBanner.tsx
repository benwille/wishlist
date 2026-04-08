"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type BannerMode = "android" | "ios" | null;

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<BannerMode>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed as standalone
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Check if already dismissed this session
    if (sessionStorage.getItem("pwa-dismissed")) return;

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isIOS) {
      setMode("ios");
      return;
    }

    if (!isAndroid) return;

    function handlePrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode("android");
    }

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  function dismiss() {
    sessionStorage.setItem("pwa-dismissed", "1");
    setDismissed(true);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
    setDismissed(true);
  }

  if (!mode || dismissed) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 safe-bottom">
      <div className="mx-4 mb-4 rounded-xl border border-border bg-surface p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Add Wishlist to your home screen</p>
            {mode === "ios" && (
              <p className="mt-1 text-xs text-muted">
                In Safari, tap the share button then &ldquo;Add to Home Screen&rdquo;
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-accent-light transition-colors"
            >
              Not now
            </button>
            {mode === "android" && (
              <button
                onClick={handleInstall}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
              >
                Install
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
