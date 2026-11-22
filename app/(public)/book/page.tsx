import { databaseUrl } from "@/server/config/environment";
import { BookingPage } from "@/features/bookings/components/BookingPage";
import { Suspense } from "react";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Choose your Saturday | Founders Lab",
  description:
    "Choose an available Saturday for a free founder conversation. View your local time, apply, and join ⭕️La_Crrypt💰₿ on X Spaces.",
};
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading sessions…</p>}>
      <BookingPage configured={Boolean(databaseUrl())} />
    </Suspense>
  );
}
