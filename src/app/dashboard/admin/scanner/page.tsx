"use client";
import { useState } from "react";
import { ScanLine, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ScannerPage() {
  return (
    <div className="fade-in">
      <header style={{ marginBottom: "30px", display: "flex", alignItems: "center", gap: "20px" }}>
        <Link href="/dashboard" className="btn btn-outline" style={{ padding: "8px" }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: "700" }}>Attendance Scanner</h1>
          <p style={{ color: "var(--muted)" }}>Scan student QR codes to record attendance.</p>
        </div>
      </header>

      <div className="card" style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center", padding: "40px" }}>
        <div style={{ 
          width: "100%", 
          aspectRatio: "1/1", 
          backgroundColor: "black", 
          borderRadius: "12px", 
          marginBottom: "30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid var(--gold)"
        }}>
           <div style={{ textAlign: "center" }}>
              <ScanLine size={64} color="var(--gold)" />
              <p style={{ marginTop: "20px", color: "var(--muted)" }}>Scanner Initializing...</p>
           </div>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
           <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Select Event to record for:</p>
           <select className="input-field select-field">
             <option>General Assembly - March 28</option>
           </select>
           <button className="btn btn-gold" style={{ marginTop: "20px" }}>Start Scanning</button>
        </div>
      </div>
    </div>
  );
}
