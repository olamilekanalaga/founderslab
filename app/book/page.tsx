import { databaseUrl } from "@/lib/server-env";
import { BookingPage } from "@/components/PublicPages";
import { Suspense } from "react";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading sessions…</p>}>
      <BookingPage configured={Boolean(databaseUrl())} />
    </Suspense>
  );
}
