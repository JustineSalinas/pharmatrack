"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { 
  PlusCircle, 
  Calendar, 
  MapPin, 
  Clock, 
  Trash2, 
  CheckCircle2,
  X,
  Loader2
} from "lucide-react";

export default function EventsManagement() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [admin, setAdmin] = useState<any>(null);

  // Form State
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [lateTime, setLateTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    async function init() {
      const u = await getCurrentUser();
      setAdmin(u);
      fetchEvents();
    }
    init();
  }, []);

  async function fetchEvents() {
    setLoading(true);
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: false });
    setEvents(data || []);
    setLoading(false);
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!admin) return;
    setIsSubmitting(true);

    try {
      // Construct timestamps
      const startTS = `${date}T${startTime}:00Z`;
      const lateTS = `${date}T${lateTime}:00Z`;
      const endTS = `${date}T${endTime}:00Z`;

      const { error } = await supabase.from("events").insert({
        name,
        location,
        date,
        check_in_start: startTS,
        check_in_late: lateTS,
        check_in_end: endTS,
        created_by: admin.id
      });

      if (error) throw error;

      setShowModal(false);
      resetForm();
      fetchEvents();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this event? This will also delete all attendance records for it.")) return;
    await supabase.from("events").delete().eq("id", id);
    fetchEvents();
  }

  function resetForm() {
    setName("");
    setLocation("");
    setDate("");
    setStartTime("");
    setLateTime("");
    setEndTime("");
  }

  return (
    <div className="fade-in">
      <header style={{ marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: "700" }}>Manage Events</h1>
          <p style={{ color: "var(--muted)" }}>Create and schedule pharmacy council activities.</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          <PlusCircle size={20} style={{ marginRight: "8px" }} /> Create Event
        </button>
      </header>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "100px" }}>
           <Loader2 className="animate-spin" size={48} color="var(--gold)" />
        </div>
      ) : (
        <div className="events-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
          {events.length > 0 ? (
            events.map(event => (
              <div key={event.id} className="card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "15px" }}>
                   <div style={{ padding: "8px", borderRadius: "8px", backgroundColor: "rgba(232, 200, 74, 0.1)", color: "var(--gold)" }}>
                      <Calendar size={20} />
                   </div>
                   <button onClick={() => handleDelete(event.id)} style={{ background: "none", border: "none", color: "rgba(239, 68, 68, 0.4)", cursor: "pointer" }}>
                      <Trash2 size={18} />
                   </button>
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "10px" }}>{event.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "0.9rem", marginBottom: "20px" }}>
                   <MapPin size={14} /> {event.location}
                </div>
                
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "15px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                   <div>
                      <label style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase" }}>Check-in Starts</label>
                      <div style={{ fontSize: "0.9rem", color: "var(--white)" }}>{new Date(event.check_in_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                   </div>
                   <div>
                      <label style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase" }}>Mark as Late</label>
                      <div style={{ fontSize: "0.9rem", color: "var(--gold)" }}>{new Date(event.check_in_late).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                   </div>
                </div>
              </div>
            ))
          ) : (
            <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "80px 0" }}>
              <Calendar size={48} color="var(--border)" style={{ marginBottom: "20px", margin: "0 auto 20px" }} />
              <h3 style={{ color: "var(--muted)" }}>No events scheduled yet</h3>
              <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.3)" }}>Click the button above to create your first event.</p>
            </div>
          )}
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      {showModal && (
        <div className="modal-overlay" style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: "20px"
        }}>
          <div className="card" style={{ width: "100%", maxWidth: "600px", padding: "40px", position: "relative" }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}
            >
              <X size={24} />
            </button>
            <h2 style={{ fontSize: "1.8rem", color: "var(--gold)", marginBottom: "30px" }}>New Council Event</h2>
            
            <form onSubmit={handleCreateEvent} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="input-group">
                <label>Event Name</label>
                <input 
                  type="text" className="input-field" placeholder="e.g., General Assembly" 
                  value={name} onChange={e => setName(e.target.value)} required 
                />
              </div>
              <div className="input-group">
                <label>Location</label>
                <input 
                  type="text" className="input-field" placeholder="e.g., USA Alumni Hall" 
                  value={location} onChange={e => setLocation(e.target.value)} required 
                />
              </div>
              
              <div className="two-col-grid">
                <div className="input-group">
                  <label>Event Date</label>
                  <input 
                    type="date" className="input-field" 
                    value={date} onChange={e => setDate(e.target.value)} required 
                  />
                </div>
                <div className="input-group">
                  <label>Check-in Starts</label>
                  <input 
                    type="time" className="input-field" 
                    value={startTime} onChange={e => setStartTime(e.target.value)} required 
                  />
                </div>
              </div>

              <div className="two-col-grid">
                <div className="input-group">
                  <label>Mark as Late At</label>
                  <input 
                    type="time" className="input-field" 
                    value={lateTime} onChange={e => setLateTime(e.target.value)} required 
                  />
                </div>
                <div className="input-group">
                  <label>Check-in Ends At</label>
                  <input 
                    type="time" className="input-field" 
                    value={endTime} onChange={e => setEndTime(e.target.value)} required 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-gold" 
                style={{ marginTop: "20px", padding: "16px" }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Save Event"}
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
