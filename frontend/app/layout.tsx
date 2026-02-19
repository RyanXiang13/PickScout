import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PickScout — Tail the Hot Hand",
  description:
    "Find today's top-performing sports cappers across Reddit and Discord. See exactly what tailing them with your unit size would have made you.",
  keywords: ["sports picks", "betting", "cappers", "reddit picks", "sports betting"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
