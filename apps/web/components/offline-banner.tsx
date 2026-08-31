"use client";
/* The wire is down — say so plainly; the desk keeps working (local-first). */
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (!offline) return null;
  return (
    <output className="border-b border-rule bg-surface px-4 py-1 text-center font-mono text-[11.5px] text-ink-2">
      Offline — everything still works; documents stay on this device.
    </output>
  );
}
