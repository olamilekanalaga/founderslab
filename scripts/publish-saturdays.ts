/** Attendance-gated eight-week window. Never deletes historical sessions or bookings. */
export {};
try {
  process.loadEnvFile(".env");
} catch {}
const { db } = await import("../lib/db");
const { ensureProgrammeWindow } = await import("../lib/programme-window");
const schedule = await db().$transaction((tx) => ensureProgrammeWindow(tx), {
  timeout: 30000,
});
console.log(
  `Programme window ready: weeks ${schedule.activeStart + 1}–${schedule.activeStart + 8}, Saturdays at 7 PM Europe/London. Advancement requires four distinct attendance submissions.`,
);
await db().$disconnect();
