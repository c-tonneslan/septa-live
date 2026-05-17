import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEPTA Live",
  description:
    "Live map of every SEPTA Regional Rail train, with delays, next arrivals, and system alerts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
