"use client";
import { makeSeed } from "./seed";
import type { DataState } from "./types";
const key = "founders-lab-demo-v1";
const serverSnapshot = makeSeed();
let snapshot = serverSnapshot;
let ready = false;
const listeners = new Set<() => void>();
export function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
export const getReadySnapshot = () => ready;
export const getServerReadySnapshot = () => false;
export const getSnapshot = () => snapshot;
export const getServerSnapshot = () => serverSnapshot;
function valid(value: unknown): value is DataState {
  if (!value || typeof value !== "object") return false;
  const v = value as DataState;
  return (
    v.version === 1 &&
    Array.isArray(v.founders) &&
    Array.isArray(v.companies) &&
    Array.isArray(v.sessions) &&
    Array.isArray(v.audit) &&
    Boolean(v.settings) &&
    Array.isArray(v.memberships) &&
    Array.isArray(v.bookings) &&
    Array.isArray(v.research) &&
    Array.isArray(v.answers)
  );
}
export function hydrateDemo() {
  if (ready) return;
  ready = true;
  try {
    localStorage.removeItem(`${key}-role`);
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (valid(saved))
      snapshot = {
        ...saved,
        spaceData: saved.spaceData || [],
        spaceAttendance: saved.spaceAttendance || [],
      };
  } catch {}
  listeners.forEach((fn) => fn());
}
export function saveDemo(value: DataState) {
  localStorage.setItem(key, JSON.stringify(value));
  snapshot = value;
  listeners.forEach((fn) => fn());
}
export function resetDemo() {
  saveDemo(makeSeed());
}
