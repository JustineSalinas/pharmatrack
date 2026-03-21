"use client";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect } from "react";
import { StudentIdSchema } from "../schema"; // Ensure this path matches your folder move!

export default function Scanner({ eventId }: { eventId: string }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    }, false);

    scanner.render((decodedText) => {
      const validation = StudentIdSchema.safeParse(decodedText);

      if (validation.success) {
        scanner.clear(); 
        alert(`✅ Attendance Logged for Event ${eventId}: ${decodedText}`);
        // This is where Alex will add the Supabase insert later
      } else {
        console.error("Invalid QR Format scanned.");
      }
    }, (error) => {
      // Scanning...
    });

    return () => {
      scanner.clear().catch(err => console.error("Failed to clear scanner", err));
    };
  }, [eventId]); // Re-run if the event changes

  return (
    <div className="card-premium max-w-md mx-auto">
      <h2 className="text-xl font-bold text-[var(--usa-purple-dark)] mb-4 text-center">
        PharmaTrack Scanner
      </h2>
      <div id="reader" className="overflow-hidden rounded-lg border-2 border-dashed border-[#d2c8dc]"></div>
      <p className="mt-4 text-[10px] text-gray-400 text-center uppercase tracking-widest font-semibold">
        Official CPMT Department Tool • USA Iloilo
      </p>
    </div>
  );
}