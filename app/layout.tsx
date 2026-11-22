import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Founders Lab with ⭕️La_Crrypt💰₿",
  description:
    "A private workspace for founder conversations, Web3 research and business opportunities.",
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
