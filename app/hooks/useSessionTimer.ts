"use client";

import { useSyncExternalStore } from "react";

function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function subscribeToClock(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

// SSR snapshot: 0 is harmless — `secondsLeft` is gated on `expiresAt !== null`
// upstream, and the very first client render swaps in the live wall clock.
function getServerNowSeconds() {
  return 0;
}

export function useSessionTimer(expiresAt: number | null) {
  const now = useSyncExternalStore(
    subscribeToClock,
    getNowSeconds,
    getServerNowSeconds,
  );

  const secondsLeft = expiresAt !== null ? Math.max(0, expiresAt - now) : null;
  const formatted = secondsLeft !== null ? formatTimeLeft(secondsLeft) : null;

  return { secondsLeft, formatted };
}
