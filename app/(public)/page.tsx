import type { Metadata } from "next";
import HomePage from "@/features/programme/components/HomePage";
import { freeSpaceDescription } from "@/lib/space-registration";
export const metadata: Metadata = {
  title: "Founders Lab | Free Sunday X Spaces",
  description: freeSpaceDescription,
  openGraph: {
    title: "Founders Lab | Free Sunday X Spaces",
    description: freeSpaceDescription,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Founders Lab | Free Sunday X Spaces",
  },
};
export default function Page() {
  return <HomePage />;
}
