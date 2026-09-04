"use client";
/* ============================================================
   writing-session.ts — the session goal (§8.1 "focus & flow").

   A quiet target: set one, and the footer counts what you have
   written SINCE you set it, not the size of the document. That
   distinction is the whole point — opening a 4,000-word draft
   should not read as a goal already met.

   The goal lives on the device, per document, and never blocks
   anything: it is a tick in the corner, not a taskmaster.
   ============================================================ */
import { create } from "zustand";

export interface SessionGoal {
  /** Words to write in this sitting. */
  target: number;
  /** The document's word count when the goal was set. */
  start: number;
  /** When it was set, so a stale goal from another day can be spotted. */
  at: number;
}

const KEY = "docforge.sessionGoal";

function read(): SessionGoal | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as Partial<SessionGoal>;
    if (typeof g.target !== "number" || typeof g.start !== "number") return null;
    return { target: g.target, start: g.start, at: typeof g.at === "number" ? g.at : Date.now() };
  } catch {
    return null;
  }
}

function write(goal: SessionGoal | null): void {
  try {
    if (goal) localStorage.setItem(KEY, JSON.stringify(goal));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode — the goal simply doesn't survive the session */
  }
}

export const useSessionGoal = create<{
  goal: SessionGoal | null;
  /** Load whatever was set last, once, at boot. */
  restore(): void;
  set(target: number, currentWords: number): void;
  clear(): void;
}>((set) => ({
  goal: null,
  restore() {
    set({ goal: read() });
  },
  set(target, currentWords) {
    const goal: SessionGoal = {
      target: Math.max(1, Math.round(target)),
      start: currentWords,
      at: Date.now(),
    };
    write(goal);
    set({ goal });
  },
  clear() {
    write(null);
    set({ goal: null });
  },
}));
