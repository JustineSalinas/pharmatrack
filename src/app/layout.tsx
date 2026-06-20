import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", weight: ["500", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "PharmaTrack — Attendance Monitoring",
  description: "QR-based attendance tracking for the University of San Agustin Pharmacy Department",
  icons: { icon: "/pham-logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, shrink-to-fit=no" />
        <meta name="theme-color" content="#0F0F13" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="msapplication-navbutton-color" content="#0F0F13" />
      </head>
      <body className={`${inter.variable} ${montserrat.variable}`}>{children}</body>
    </html>
  );
}
