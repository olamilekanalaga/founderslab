import { databaseUrl, publicDemoAllowed } from "@/lib/server-env";
import { ApplicationForm } from "@/components/PublicPages";
import { Suspense } from "react";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading application…</p>}>
      <ApplicationForm
        configured={Boolean(databaseUrl())}
        allowDemo={publicDemoAllowed()}
      />
    </Suspense>
  );
}
