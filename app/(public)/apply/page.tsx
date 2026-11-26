import { databaseUrl } from "@/server/config/environment";
import { ApplicationForm } from "@/features/bookings/components/ApplicationForm";
import { Suspense } from "react";
import { db } from "@/server/db";
import {
  activeReferral,
  referralSelection,
} from "@/server/services/bd-referral";
export const dynamic = "force-dynamic";
export default async function Page() {
  const configured = Boolean(databaseUrl());
  const selection = configured ? await referralSelection() : undefined;
  const partner = selection ? await activeReferral(db(), selection) : null;
  const referral = {
    handle: partner?.name.startsWith("@") ? partner.name : null,
    locked: Boolean(selection),
    valid: Boolean(partner),
  };
  return (
    <Suspense fallback={<p>Loading application…</p>}>
      <ApplicationForm configured={configured} referral={referral} />
    </Suspense>
  );
}
