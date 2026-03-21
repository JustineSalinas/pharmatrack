import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharmaTrack | USA Pharmacy",
  description: "Attendance System for the College of Pharmacy at USA Iloilo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* We let globals.css handle the body background now */}
      <body className="antialiased">
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}