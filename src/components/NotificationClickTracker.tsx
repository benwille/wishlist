"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics/track";

/**
 * Detects ?n_type=... params set by sendPushToUsers, fires a GA4
 * notification_clicked event, and strips the params from the URL.
 */
export default function NotificationClickTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const type = searchParams.get("n_type");
    if (!type) return;

    const variant = searchParams.get("n_variant") || undefined;
    trackEvent("notification_clicked", { type, variant });

    // Strip n_* params from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("n_type");
    params.delete("n_variant");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, searchParams, router]);

  return null;
}
