import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://septa-live.vercel.app"),
  title: "SEPTA Live",
  description:
    "Real-time map of every Regional Rail train, subway, trolley, and bus.",
  openGraph: {
    title: "SEPTA Live",
    description:
      "Real-time map of every Regional Rail train, subway, trolley, and bus.",
    url: "https://septa-live.vercel.app",
    siteName: "SEPTA Live",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SEPTA Live",
    description:
      "Real-time map of every Regional Rail train, subway, trolley, and bus.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
