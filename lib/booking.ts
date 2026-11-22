import { LONDON_TIME_ZONE } from "./saturday-schedule";
export const BOOKING_TIME_ZONE = LONDON_TIME_ZONE;
export const BOOKING_TIME_LABEL = "United Kingdom · London (GMT / BST)";
export interface PublicSession {
  id: string;
  title: string;
  startsAt: string;
  timezone: string;
  host: string;
  capacity: number;
  deadline: string;
  status: string;
  availableSeats: number;
  position?: number;
  submitted?: boolean;
}
type SessionDate = Pick<PublicSession, "startsAt" | "timezone">;
export function sessionDay(session: SessionDate) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOKING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(session.startsAt));
}
export function isSaturday(session: SessionDate) {
  return (
    new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: BOOKING_TIME_ZONE,
    }).format(new Date(session.startsAt)) === "Sat"
  );
}
export function publicSlotOpen(
  session: Pick<PublicSession, "startsAt" | "timezone" | "status" | "deadline">,
  seats: number,
  now = Date.now(),
) {
  return (
    session.status === "Scheduled" &&
    isSaturday(session) &&
    seats > 0 &&
    new Date(session.startsAt).getTime() > now &&
    new Date(session.deadline).getTime() >= now
  );
}
