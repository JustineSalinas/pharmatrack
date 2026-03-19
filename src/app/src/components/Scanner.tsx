"use client";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect } from "react";

export default function Scanner() {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    }, false);

    scanner.render((decodedText) => {
      alert(`Attendance Logged for Student: ${decodedText}`);
    }, (error) => {
    });

    return () => scanner.clear();
  }, []);

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-blue-900 mb-4 text-center">PharmaTrack Scanner</h2>
      <div id="reader" className="overflow-hidden rounded-lg"></div>
      <p className="mt-4 text-xs text-gray-400 text-center uppercase tracking-widest">
        Official CPMT Department Tool
      </p>
    </div>
  );
}