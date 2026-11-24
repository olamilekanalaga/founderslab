export function referralStatus(
  application: { status: string; ineligible?: boolean },
  bookings: { id: string; status: string; attended?: boolean }[],
  verified: Set<string>,
) {
  if (application.ineligible || application.status === "Declined")
    return "Not eligible";
  if (bookings.some((booking) => verified.has(booking.id)))
    return "Verified — counts towards payment";
  if (application.status !== "Approved") return "Application received";
  if (bookings.some((booking) => booking.attended))
    return "Attendance pending verification";
  if (
    bookings.some((booking) =>
      ["Approved", "Attended"].includes(booking.status),
    )
  )
    return "Space scheduled";
  return "Application approved — awaiting booking";
}
