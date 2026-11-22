import type { Metadata } from "next";
import HomePage from "@/features/programme/components/HomePage";
export const metadata: Metadata = {
  title: "Founders Lab — Web3 founder conversations with Ola_Crrypt",
  description:
    "Building connections between founders, products and opportunities. Join weekly Web3 founder conversations on Saturdays at 7 PM London time.",
};
export default function Page() {
  return <HomePage />;
}
