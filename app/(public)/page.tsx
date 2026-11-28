import type { Metadata } from "next";
import HomePage from "@/features/programme/components/HomePage";
export const metadata: Metadata = {
  title: "Founders Lab | Business Research and Live Web3 Spaces",
  description:
    "Bring a business challenge for independent research and discuss practical solutions live on X Spaces.",
  openGraph: {
    title: "Founders Lab | Business Research and Live Web3 Spaces",
    description:
      "Independent business research and live discussions of practical solutions. Sundays at 7 PM London time.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Founders Lab | Business Research and Live Web3 Spaces",
  },
};
export default function Page() {
  return <HomePage />;
}
