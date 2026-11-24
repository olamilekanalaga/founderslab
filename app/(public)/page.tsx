import type { Metadata } from "next";
import HomePage from "@/features/programme/components/HomePage";
export const metadata: Metadata = {
  title: "FoundersLab | Weekly Web3 Conversations",
  description:
    "FoundersLab brings Web3 founders together to discuss what they’re building, who it’s for and what’s happening across the industry.",
  openGraph: {
    title: "FoundersLab | Weekly Web3 Conversations",
    description:
      "Open conversations with Web3 founders about their products, users and markets. Sundays at 7 PM London time. Free participation, subject to review.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FoundersLab | Weekly Web3 Conversations",
  },
};
export default function Page() {
  return <HomePage />;
}
