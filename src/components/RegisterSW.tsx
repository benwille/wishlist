"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterSW() {
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");

      // Listen for navigation requests from notification clicks
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "NOTIFICATION_CLICK" && event.data.url) {
          router.push(event.data.url);
        }
      });
    }
  }, [router]);

  return null;
}
