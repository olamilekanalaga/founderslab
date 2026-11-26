/** Rolling three-week booking window. Never deletes historical sessions or bookings. */
export {};
try {
  process.loadEnvFile(".env");
} catch {}
const { db } = await import("@/server/db/node");
const { ensureProgrammeWindow } =
  await import("@/server/services/programme-window");
const schedule = await db().$transaction((tx) => ensureProgrammeWindow(tx), {
  timeout: 30000,
});
console.log(
  `Programme window ready: public weeks ${schedule.activeStart + 1}–${schedule.activeStart + 3}, Sundays at 7 PM Europe/London. Only the first week accepts bookings until its Space data is submitted.`,
);
await db().$disconnect();
