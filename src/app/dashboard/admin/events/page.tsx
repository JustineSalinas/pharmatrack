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
  Loader2,
  Pencil
} from "lucide-react";

export default function EventsManagement() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [admin, setAdmin] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);

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

      if (editingEvent) {
        const { error } = await supabase
          .from("events")
          .update({
            name,
            location,
            date,
            check_in_start: startTS,
            check_in_late: lateTS,
            check_in_end: endTS,
          })
          .eq("id", editingEvent.id);

        if (error) throw error;
      } else {
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
      }

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
    setEditingEvent(null);
  }

  function startEdit(event: any) {
    setEditingEvent(event);
    setName(event.name);
    setLocation(event.location);
    setDate(event.date);
    
    const parseTime = (isoStr: string) => {
      const d = new Date(isoStr);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    
    setStartTime(parseTime(event.check_in_start));
    setLateTime(parseTime(event.check_in_late));
    setEndTime(parseTime(event.check_in_end));
    setShowModal(true);
  }

  return (
    <>
      <div className="fade-in">
      <header style={{ marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: "700" }}>Manage Events</h1>
          <p style={{ color: "var(--muted)" }}>Create and schedule pharmacy council activities.</p>
        </div>
        <button className="btn btn-gold" onClick={() => { resetForm(); setShowModal(true); }}>
          <PlusCircle size={20} style={{ marginRight: "8px" }} /> Create Event
        </button>
      </header>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "100px" }}>
           <Loader2 className="animate-spin" size={48} color="var(--gold)" />
        </div>
      ) : (
        <div className="events-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {events.length > 0 ? (
            events.map(event => (
              <div key={event.id} className="event-row" style={{ 
                display: "flex", alignItems: "center", 
                background: "var(--surface)", border: "1px solid var(--border)", 
                borderRadius: "var(--radius-sm)", padding: "14px 20px", transition: "all 0.15s ease",
                gap: "24px"
              }}>
                {/* 1. Main Info Column */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: "1", minWidth: 0 }}>
                   <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", color: "var(--white-shade)", flexShrink: 0 }}>
                      <Calendar size={16} />
                   </div>
                   <div style={{ minWidth: 0, overflow: "hidden" }}>
                     <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--white)", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.name}</h3>
                     <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--dimmed)", fontSize: "12px" }}>
                       <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Calendar size={12} /> {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                       <span style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><MapPin size={12} /> {event.location}</span>
                     </div>
                   </div>
                </div>
                
                {/* 2. Check-in Starts Column */}
                <div style={{ width: "130px", flexShrink: 0 }}>
                   <div style={{ fontSize: "10px", color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px", fontWeight: 600 }}>Starts At</div>
                   <div style={{ fontSize: "13px", color: "var(--white-shade)", fontWeight: 500 }}>
                     {new Date(event.check_in_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                </div>

                {/* 3. Mark Late Column */}
                <div style={{ width: "130px", flexShrink: 0 }}>
                   <div style={{ fontSize: "10px", color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px", fontWeight: 600 }}>Mark Late At</div>
                   <div style={{ fontSize: "13px", color: "var(--gold)", fontWeight: 500 }}>
                     {new Date(event.check_in_late).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                </div>

                {/* 4. Ends Column */}
                <div style={{ width: "130px", flexShrink: 0 }}>
                   <div style={{ fontSize: "10px", color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px", fontWeight: 600 }}>Ends At</div>
                   <div style={{ fontSize: "13px", color: "var(--danger)", fontWeight: 500 }}>
                     {new Date(event.check_in_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                </div>

                {/* 5. Delete Action Column */}
                <div style={{ width: "80px", display: "flex", justifyContent: "flex-end", gap: "8px", flexShrink: 0 }}>
                   <button className="action-btn-hover edit-btn-hover" onClick={() => startEdit(event)} title="Edit Event">
                      <Pencil size={13} />
                   </button>
                   <button className="action-btn-hover delete-btn-hover" onClick={() => handleDelete(event.id)} title="Delete Event">
                      <Trash2 size={14} />
                   </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "100px 0", border: "1px dashed var(--border)", borderRadius: "var(--radius)", background: "rgba(255,255,255,0.01)" }}>
              <Calendar size={40} color="var(--dimmed)" style={{ margin: "0 auto 16px" }} />
              <h3 style={{ fontSize: "15px", fontWeight: 500, color: "var(--white)" }}>No events scheduled yet</h3>
              <p style={{ fontSize: "13px", color: "var(--dimmed)", marginTop: "6px" }}>Click the 'Create Event' button above to get started.</p>
            </div>
          )}
        </div>
      )}
      </div>

      {/* CREATE EVENT MODAL */}
      {showModal && (
        <div className="modal-overlay" style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000,
          padding: "20px", paddingTop: "12vh"
        }}>
          <div className="modal-card" style={{ 
            width: "100%", maxWidth: "760px", 
            background: "var(--surface)", border: "1px solid var(--border)", 
            borderRadius: "12px", padding: "32px", position: "relative",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <button 
              onClick={() => setShowModal(false)}
              className="close-btn"
              style={{ position: "absolute", top: 24, right: 24, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--dimmed)", cursor: "pointer", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }}
            >
              <X size={16} />
            </button>
            
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--white)", marginBottom: "4px" }}>
                {editingEvent ? "Edit Event" : "Create Event"}
              </h2>
              <p style={{ color: "var(--dimmed)", fontSize: "13px" }}>
                {editingEvent ? "Modify this event's properties and rules." : "Schedule a new council activity and define attendance rules."}
              </p>
            </div>
            
            <form onSubmit={handleCreateEvent} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Event Name</label>
                  <input 
                    type="text" className="settings-input" placeholder="e.g., General Assembly" 
                    value={name} onChange={e => setName(e.target.value)} required 
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Location</label>
                  <input 
                    type="text" className="settings-input" placeholder="e.g., USA Alumni Hall" 
                    value={location} onChange={e => setLocation(e.target.value)} required 
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Event Date</label>
                  <input 
                    type="date" className="settings-input" 
                    value={date} onChange={e => setDate(e.target.value)} required 
                    style={{ colorScheme: "dark" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Check-in Starts</label>
                  <input 
                    type="time" className="settings-input" 
                    value={startTime} onChange={e => setStartTime(e.target.value)} required 
                    style={{ colorScheme: "dark" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mark Late At</label>
                  <input 
                    type="time" className="settings-input" 
                    value={lateTime} onChange={e => setLateTime(e.target.value)} required 
                    style={{ colorScheme: "dark", borderColor: "rgba(232, 184, 75, 0.3)", background: "rgba(232, 184, 75, 0.05)" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Check-in Ends</label>
                  <input 
                    type="time" className="settings-input" 
                    value={endTime} onChange={e => setEndTime(e.target.value)} required 
                    style={{ colorScheme: "dark", borderColor: "rgba(248, 113, 113, 0.3)", background: "rgba(248, 113, 113, 0.05)" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "4px", display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="btn-ghost"
                  style={{ padding: "0 16px", height: "36px", fontSize: "13px", fontWeight: 500, borderRadius: "var(--radius-sm)", color: "var(--white-shade)", border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s ease" }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ padding: "0 20px", height: "36px", fontSize: "13px", fontWeight: 600, borderRadius: "var(--radius-sm)", color: "#000", background: "var(--gold)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", opacity: isSubmitting ? 0.7 : 1, transition: "all 0.15s ease" }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  ) : (editingEvent ? "Update Event" : "Save Event")}
                </button>
              </div>
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
        .settings-input {
          height: 36px;
          padding: 0 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--white);
          font-size: 13px;
          outline: none;
          transition: all 0.15s ease;
          font-family: var(--font-sans);
          width: 100%;
          box-sizing: border-box;
        }
        .settings-input:focus {
          border-color: var(--gold) !important;
          box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.12);
        }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(0.6);
          cursor: pointer;
        }
        .btn-ghost:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: var(--white) !important;
        }
        .event-row:hover {
          background: var(--surface2) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        .action-btn-hover {
          background: transparent;
          border: none;
          color: var(--dimmed);
          cursor: pointer;
          opacity: 0.5;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border-radius: 8px;
        }
        .event-row:hover .action-btn-hover {
          opacity: 1;
        }
        .delete-btn-hover:hover {
          background: rgba(248, 113, 113, 0.1);
          color: var(--danger);
        }
        .edit-btn-hover:hover {
          background: rgba(232, 184, 75, 0.1);
          color: var(--gold);
        }
      `}</style>
    </>
  );
}
