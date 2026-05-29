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
  themeColor: "#fafaf7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
