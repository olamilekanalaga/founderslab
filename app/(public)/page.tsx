import type { Metadata } from "next";
import HomePage from "@/features/programme/components/HomePage";
export const metadata: Metadata = {
  title: "Founders Lab | Introduce your product. Reach your audience.",
  description:
    "Founders Lab is for Web3 founders who want to introduce their products, share their journey and reach an audience interested in discovering what they’re building.",
  openGraph: {
    title: "Founders Lab | Introduce your product. Reach your audience.",
    description:
      "A weekly space for Web3 builders. Saturdays, 7 PM London. Free participation, subject to review.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Founders Lab | Introduce your product. Reach your audience.",
  },
};
export default function Page() {
  return <HomePage />;
}
