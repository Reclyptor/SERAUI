"use client";

import { useState, useEffect } from "react";

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

export function useSessionTimer(expiresAt: number | null) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!expiresAt) return null;
    return Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  });

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(null);
      return;
    }

    const update = () => {
      setSecondsLeft(Math.max(0, expiresAt - Math.floor(Date.now() / 1000)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const formatted = secondsLeft !== null ? formatTimeLeft(secondsLeft) : null;

  return { secondsLeft, formatted };
}
