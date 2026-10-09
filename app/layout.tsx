import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arts & Ideas Dispatch",
  description: "Draft, review, and export promotion for the New Orleans Arts & Ideas Festival.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
