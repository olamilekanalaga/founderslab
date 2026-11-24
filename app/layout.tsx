import type { Metadata } from "next";
import "./globals.css";
import "./public-experience.css";
import "./admin-experience.css";
import "./admin-studio.css";
import "./admin-desk.css";
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
    "Weekly Web3 founder conversations and connections. Saturdays at 7 PM London time, with participation subject to approval.",
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
        {children}
      </body>
    </html>
  );
}
