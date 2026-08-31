"use client";
/* Registers the service worker in production builds only (dev keeps HMR sane). */
import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* http:// or blocked context — the app still runs, just not offline-installable */
    });
  }, []);
  return null;
}
