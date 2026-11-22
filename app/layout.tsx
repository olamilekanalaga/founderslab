import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
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
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
