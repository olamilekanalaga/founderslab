"use client";
import { useSyncExternalStore } from "react";
import { LONDON_TIME_ZONE } from "@/lib/saturday-schedule";
const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => "";
export function formatSessionTime(startsAt: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(new Date(startsAt));
}
export default function SessionTime({ startsAt }: { startsAt: string }) {
  const zone = useSyncExternalStore(subscribe, browserZone, serverZone);
  return (
    <span>
      {formatSessionTime(startsAt, LONDON_TIME_ZONE)} · London
      {zone && zone !== LONDON_TIME_ZONE && (
        <span className="visitor-session-time">
          Your time: {formatSessionTime(startsAt, zone)} ·{" "}
          {zone.replaceAll("_", " ")}
        </span>
      )}
    </span>
  );
}
