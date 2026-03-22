"use client";
import { PlusCircle, Calendar } from "lucide-react";

export default function EventsManagement() {
  return (
    <div className="fade-in">
      <header style={{ marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: "700" }}>Manage Events</h1>
          <p style={{ color: "var(--muted)" }}>Create and schedule pharmacy council activities.</p>
        </div>
        <button className="btn btn-gold">
          <PlusCircle size={20} style={{ marginRight: "8px" }} /> Create Event
        </button>
      </header>

      <div className="card">
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Calendar size={48} color="var(--border)" style={{ marginBottom: "20px" }} />
          <h3 style={{ color: "var(--muted)" }}>No events scheduled yet</h3>
          <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.3)" }}>Click the button above to create your first event.</p>
        </div>
      </div>
    </div>
  );
}
