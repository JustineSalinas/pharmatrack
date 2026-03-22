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
      <body>{children}</body>
    </html>
  );
}
