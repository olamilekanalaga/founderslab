import { ApplicationForm } from "@/components/PublicPages";
import { Suspense } from "react";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading application…</p>}>
      <ApplicationForm configured={Boolean(process.env.DATABASE_URL)} />
    </Suspense>
  );
}
