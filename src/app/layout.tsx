import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Littåventyr — den norske litteraturquizen",
  description:
    "En endeløs quiz om norsk litteratur. Gjett forfatter, tiår, sjanger og epoke — fra Holberg og Ibsen til Fosse og Knausgård.",
  applicationName: "Littåventyr",
  authors: [{ name: "Littåventyr" }],
  keywords: ["norsk litteratur", "quiz", "forfattere", "bøker", "Ibsen", "Hamsun", "Fosse"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#eef2fb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <head>
        {/* warm up the connection used for author portraits */}
        <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="" />
        <link rel="dns-prefetch" href="https://commons.wikimedia.org" />
        {/* start downloading the dataset in parallel with the JS bundle */}
        <link rel="preload" href="/books.json?v=1" as="fetch" />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
