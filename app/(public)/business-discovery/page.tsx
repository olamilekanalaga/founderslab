import type { Metadata } from "next";
import BusinessDiscoveryForm from "@/features/bookings/components/BusinessDiscoveryForm";

export const metadata: Metadata = {
  title: "Business discovery | Founders Lab",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <BusinessDiscoveryForm />;
}
