import type { Metadata } from "next";
import "./globals.css";
import "./public-experience.css";
import "./admin-experience.css";
import "./admin-studio.css";
import "./admin-desk.css";
import "./admin-themes.css";
import "./platform-motion.css";
import PlatformMotion from "@/components/layout/PlatformMotion";
import localFont from "next/font/local";
const publicFont = localFont({
  src: "./fonts/geist-latin.ttf",
  variable: "--font-public",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  metadataBase: new URL("https://founderslab-orcin.vercel.app"),
  title: "Founders Lab with ⭕️La_Crrypt💰₿",
  description:
    "Free Sunday X Spaces for founders to discuss their products, users, markets and opportunities. Sundays at 7 PM London time.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={publicFont.variable}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <PlatformMotion />
        {children}
      </body>
    </html>
  );
}
