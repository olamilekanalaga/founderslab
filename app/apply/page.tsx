import { databaseUrl } from "@/lib/server-env";
import { ApplicationForm } from "@/features/bookings/components/ApplicationForm";
import { Suspense } from "react";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading application…</p>}>
      <ApplicationForm configured={Boolean(databaseUrl())} />
    </Suspense>
  );
}
