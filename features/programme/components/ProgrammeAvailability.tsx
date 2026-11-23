"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/features/bookings/lib/public-api";
import type { PublicSession } from "@/lib/dates/booking";
type Availability = {
  status: "loading" | "error" | "ready";
  sessions: PublicSession[];
  asOf: number;
};
const AvailabilityContext = createContext<{
  availability: Availability;
  retry: () => void;
} | null>(null);
export function ProgrammeAvailability({ children }: { children: ReactNode }) {
  const [availability, setAvailability] = useState<Availability>({
    status: "loading",
    sessions: [],
    asOf: 0,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const { sessions } = await api("sessions");
        if (active)
          setAvailability({ status: "ready", sessions, asOf: Date.now() });
      } catch {
        if (active) setAvailability({ status: "error", sessions: [], asOf: 0 });
      } finally {
        pending = false;
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [attempt]);
  const retry = () => {
    setAvailability({ status: "loading", sessions: [], asOf: 0 });
    setAttempt((value) => value + 1);
  };
  return (
    <AvailabilityContext.Provider value={{ availability, retry }}>
      {children}
    </AvailabilityContext.Provider>
  );
}
export function useProgrammeAvailability() {
  const context = useContext(AvailabilityContext);
  if (!context)
    throw new Error("Programme availability requires its provider.");
  return context;
}
