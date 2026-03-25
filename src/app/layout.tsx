import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharmaTrack — Attendance Monitoring",
  description: "QR-based attendance tracking for the University of San Agustin Pharmacy Department",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, shrink-to-fit=no" />
        <meta name="theme-color" content="#1a0b36" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="msapplication-navbutton-color" content="#1a0b36" />
      </head>
      <body>{children}</body>
    </html>
  );
}
