import type { Metadata } from "next";
import HomePage from "@/features/programme/components/HomePage";
export const metadata: Metadata = {
  title: "Founders Lab | Meet the founders building Web3",
  description:
    "Meet the founders building Web3. Choose a Saturday, apply, and join free X Spaces conversations with Ola_Crrypt at 7 PM London time.",
  openGraph: {
    title: "Founders Lab | Meet the founders building Web3",
    description:
      "A weekly space for Web3 builders. Saturdays, 7 PM London. Free participation, subject to review.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Founders Lab | Meet the founders building Web3",
  },
};
export default function Page() {
  return <HomePage />;
}
