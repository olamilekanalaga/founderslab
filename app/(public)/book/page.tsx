import { databaseUrl } from "@/server/config/environment";
import { BookingPage } from "@/features/bookings/components/BookingPage";
import { Suspense } from "react";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading sessions…</p>}>
      <BookingPage configured={Boolean(databaseUrl())} />
    </Suspense>
  );
}
