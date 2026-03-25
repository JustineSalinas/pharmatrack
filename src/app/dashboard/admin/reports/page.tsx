"use client";
import { FileText, Download, Calendar } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ReportsPage() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    async function loadEvents() {
      const { data } = await supabase.from("events").select("name").limit(3).order("created_at", { ascending: false });
      if (data) setEvents(data);
    }
    loadEvents();
  }, []);

  return (
    <div className="fade-in">
      <header style={{ marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: "700" }}>Attendance Reports</h1>
          <p style={{ color: "var(--muted)" }}>Generate and download participation data for events.</p>
        </div>
        <button className="btn btn-gold pulse-btn" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Download size={20} /> Export Master CSV
        </button>
      </header>

      <div className="card" style={{ padding: "40px 30px" }}>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <FileText size={56} color="var(--gold)" style={{ marginBottom: "20px", filter: "drop-shadow(0 0 10px rgba(232,200,74,0.3))" }} />
          <h3 style={{ fontSize: "1.5rem", marginBottom: "10px" }}>Automated Reports Ready</h3>
          <p style={{ fontSize: "1rem", color: "var(--muted)", maxWidth: "500px", margin: "0 auto 30px", lineHeight: "1.6" }}>
            The reporting system is fully integrated. All scanned attendance is automatically synchronized directly in the database. 
          </p>
          
          <div style={{ display: "inline-block", textAlign: "left", background: "var(--surface2)", padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "400px" }}>
             <h4 style={{ marginBottom: "15px", color: "var(--gold)", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px" }}>Recent Active Events</h4>
             {events.length > 0 ? events.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", paddingBottom: "10px", borderBottom: i < events.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                   <Calendar size={14} color="var(--muted)" />
                   <span style={{ fontSize: "0.95rem" }}>{e.name}</span>
                </div>
             )) : (
                <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No events found.</p>
             )}
          </div>

          <div style={{ marginTop: "40px" }}>
            <Link href="/dashboard/admin/attendance" className="btn btn-outline" style={{ display: "inline-block" }}>
              View Detailed Logs Matrix →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
