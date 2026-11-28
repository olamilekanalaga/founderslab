import type { Metadata } from "next";
import PrivateSession from "@/features/consultations/components/PrivateSession";

export const metadata: Metadata = {
  title: "Private Business Session | Founders Lab",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <PrivateSession />;
}
