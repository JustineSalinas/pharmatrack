"use client";

import { useState, useEffect } from "react";
import { supabase, parseDateLocal } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { EVENT_TYPES, getEventTypeStyle } from "@/lib/event-type";
import { 
  PlusCircle, 
  Calendar, 
  MapPin, 
  Clock, 
  Trash2, 
  CheckCircle2,
  X,
  Loader2,
  Pencil,
  Search,
  AlertTriangle,
  Info
} from "lucide-react";

export default function EventsManagement() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  // Search & Delete States
  const [searchQuery, setSearchQuery] = useState("");
  const [eventToDelete, setEventToDelete] = useState<any | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
  const [eventType, setEventType] = useState<string>("Department");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [lateTime, setLateTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [checkOutStartTime, setCheckOutStartTime] = useState("");
  const [checkOutEndTime, setCheckOutEndTime] = useState("");
  const [targetYearLevels, setTargetYearLevels] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const filteredEvents = events.filter(event => 
    event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function getEventStatus(startIso: string, endIso: string) {
    const now = new Date();
    const start = new Date(startIso);
    const end = new Date(endIso);
    
    if (now < start) {
      return { 
        label: "Upcoming", 
        color: "var(--gold)", 
        bg: "rgba(212, 175, 55, 0.08)", 
        border: "rgba(212, 175, 55, 0.2)" 
      };
    } else if (now >= start && now <= end) {
      return { 
        label: "Ongoing", 
        color: "#10b981", 
        bg: "rgba(16, 185, 129, 0.08)", 
        border: "rgba(16, 185, 129, 0.2)" 
      };
    } else {
      return { 
        label: "Past", 
        color: "var(--dimmed)", 
        bg: "rgba(255, 255, 255, 0.04)", 
        border: "rgba(255, 255, 255, 0.1)" 
      };
    }
  }

  useEffect(() => {
    async function init() {
      const u = await getCurrentUser();
      setUser(u);
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
    if (!user) return;
    setFormError("");

    // Build the timestamps from the facilitator's wall-clock input. Parsing
    // without a trailing "Z" interprets the time in the browser's LOCAL zone
    // (e.g. Asia/Manila), then .toISOString() converts it to the correct UTC
    // instant for storage — so it reads back as the same local time. The old
    // code appended "Z", mislabelling local times as UTC and causing drift.
    const startDt = new Date(`${date}T${startTime}:00`);
    const lateDt = new Date(`${date}T${lateTime}:00`);
    const endDt = new Date(`${date}T${endTime}:00`);

    if (isNaN(startDt.getTime()) || isNaN(lateDt.getTime()) || isNaN(endDt.getTime())) {
      setFormError("Please provide a valid date and check-in times.");
      return;
    }
    // Check-in window must be chronological: Start ≤ Mark-Late < Ends.
    if (lateDt < startDt) {
      setFormError("“Mark Late At” can’t be earlier than “Check-in Starts”.");
      return;
    }
    if (endDt <= lateDt) {
      setFormError("“Check-in Ends” must be later than “Mark Late At”.");
      return;
    }

    // Check-out window is optional — both times must be provided together, or neither.
    if ((checkOutStartTime && !checkOutEndTime) || (!checkOutStartTime && checkOutEndTime)) {
      setFormError("Provide both check-out times, or leave both blank.");
      return;
    }

    let checkOutStartTS: string | null = null;
    let checkOutEndTS: string | null = null;
    if (checkOutStartTime && checkOutEndTime) {
      const checkOutStartDt = new Date(`${date}T${checkOutStartTime}:00`);
      const checkOutEndDt = new Date(`${date}T${checkOutEndTime}:00`);
      if (isNaN(checkOutStartDt.getTime()) || isNaN(checkOutEndDt.getTime())) {
        setFormError("Please provide valid check-out times.");
        return;
      }
      if (checkOutEndDt <= checkOutStartDt) {
        setFormError("“Check-out Ends” must be later than “Check-out Starts”.");
        return;
      }
      checkOutStartTS = checkOutStartDt.toISOString();
      checkOutEndTS = checkOutEndDt.toISOString();
    }

    setIsSubmitting(true);

    try {
      const startTS = startDt.toISOString();
      const lateTS = lateDt.toISOString();
      const endTS = endDt.toISOString();

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
            check_out_start: checkOutStartTS,
            check_out_end: checkOutEndTS,
            target_year_levels: targetYearLevels.length ? targetYearLevels : null,
            event_type: eventType,
          })
          .eq("id", editingEvent.id);

        if (error) throw error;
      } else {
        // Fetch current session token to authenticate request
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name,
            location,
            date,
            check_in_start: startTS,
            check_in_late: lateTS,
            check_in_end: endTS,
            check_out_start: checkOutStartTS,
            check_out_end: checkOutEndTS,
            target_year_levels: targetYearLevels.length ? targetYearLevels : null,
            event_type: eventType,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to create event");
        }
      }

      setShowModal(false);
      resetForm();
      fetchEvents();
      showToast(
        editingEvent
          ? "Event updated successfully."
          : "Event created — students will be notified via email.",
        "success"
      );
    } catch (err: any) {
      setFormError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleDeleteConfirm() {
    if (!eventToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("events").delete().eq("id", eventToDelete.id);
      if (error) throw error;
      setEventToDelete(null);
      fetchEvents();
      showToast("Event deleted.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to delete event.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteAllConfirm() {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      setShowDeleteAllModal(false);
      fetchEvents();
      showToast("All events deleted.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to delete events.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  function resetForm() {
    setName("");
    setLocation("");
    setDate("");
    setStartTime("");
    setLateTime("");
    setEndTime("");
    setCheckOutStartTime("");
    setCheckOutEndTime("");
    setTargetYearLevels([]);
    setEventType("Department");
    setFormError("");
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
    setCheckOutStartTime(event.check_out_start ? parseTime(event.check_out_start) : "");
    setCheckOutEndTime(event.check_out_end ? parseTime(event.check_out_end) : "");
    setTargetYearLevels(event.target_year_levels ?? []);
    setEventType(event.event_type ?? "Department");
    setFormError("");
    setShowModal(true);
  }

  return (
    <>
      <div className="fade-in">
      <header style={{ marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
            {user?.account_type === "admin" ? "Admin" : "Facilitator"}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--white)" }}>Manage Events</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Create and schedule pharmacy council activities.</p>
        </div>
      </header>

      {/* SEARCH BAR */}
      <div style={{ marginBottom: "24px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "0 1 360px" }}>
          <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--dimmed)" }} />
          <input
            type="text"
            placeholder="Search events by name or location..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
            style={{
              width: "100%",
              height: "40px",
              padding: "0 16px 0 42px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--white)",
              fontSize: "13px",
              outline: "none",
              transition: "all 0.15s ease",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: "12px", alignItems: "center" }}>
          {events.length > 0 && (
            <button 
              type="button"
              onClick={() => setShowDeleteAllModal(true)}
              className="btn-danger-outline"
              style={{ height: "40px" }}
            >
              <Trash2 size={14} /> Delete All Events
            </button>
          )}

          <button 
            className="btn-create-event" 
            onClick={() => { resetForm(); setShowModal(true); }} 
            style={{ height: "40px" }}
          >
            <PlusCircle size={16} /> Create Event
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "100px" }}>
           <Loader2 className="animate-spin" size={48} color="var(--gold)" />
        </div>
      ) : (
        <div className="events-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredEvents.length > 0 ? (
            filteredEvents.map(event => {
              const status = getEventStatus(event.check_in_start, event.check_in_end);
              return (
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
                       <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                         <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--white)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.name}</h3>
                         <span style={{ 
                           fontSize: "10px", 
                           fontWeight: 600, 
                           padding: "2px 8px", 
                           borderRadius: "12px", 
                           color: status.color, 
                           background: status.bg, 
                           border: `1px solid ${status.border}`,
                           textTransform: "uppercase",
                           letterSpacing: "0.05em",
                           flexShrink: 0
                         }}>{status.label}</span>
                         {(() => {
                           const ts = getEventTypeStyle(event.event_type);
                           return (
                             <span style={{
                               fontSize: "10px",
                               fontWeight: 600,
                               padding: "2px 8px",
                               borderRadius: "12px",
                               color: ts.color,
                               background: ts.bg,
                               border: `1px solid ${ts.border}`,
                               textTransform: "uppercase",
                               letterSpacing: "0.05em",
                               flexShrink: 0,
                             }}>
                               {ts.label}
                             </span>
                           );
                         })()}
                       </div>
                       <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--dimmed)", fontSize: "12px" }}>
                         <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Calendar size={12} /> {parseDateLocal(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                         <span style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><MapPin size={12} /> {event.location}</span>
                       </div>
                       {event.target_year_levels?.length > 0 && (
                         <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                           {event.target_year_levels.map((yr: string) => (
                             <span
                               key={yr}
                               style={{
                                 fontSize: "10px",
                                 fontWeight: 600,
                                 padding: "1px 7px",
                                 borderRadius: "10px",
                                 background: "rgba(79,70,229,0.12)",
                                 border: "1px solid rgba(79,70,229,0.3)",
                                 color: "#a5b4fc",
                                 letterSpacing: "0.03em",
                               }}
                             >
                               {yr}
                             </span>
                           ))}
                         </div>
                       )}
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
                     <div style={{ fontSize: "10px", color: "#f97316", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px", fontWeight: 600 }}>Mark Late At</div>
                     <div style={{ fontSize: "13px", color: "#f97316", fontWeight: 500 }}>
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
                     <button className="action-btn-hover delete-btn-hover" onClick={() => setEventToDelete(event)} title="Delete Event">
                        <Trash2 size={14} />
                     </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "100px 0", border: "1px dashed var(--border)", borderRadius: "var(--radius)", background: "rgba(255,255,255,0.01)" }}>
              <Calendar size={40} color="var(--dimmed)" style={{ margin: "0 auto 16px" }} />
              <h3 style={{ fontSize: "15px", fontWeight: 500, color: "var(--white)" }}>
                {searchQuery ? "No matching events found" : "No events scheduled yet"}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--dimmed)", marginTop: "6px" }}>
                {searchQuery ? "Try refining your search query." : "Click the 'Create Event' button above to get started."}
              </p>
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
                    style={{ colorScheme: "light" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Check-in Starts</label>
                  <input 
                    type="time" className="settings-input" 
                    value={startTime} onChange={e => setStartTime(e.target.value)} required 
                    style={{ colorScheme: "light" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mark Late At</label>
                  <input 
                    type="time" className="settings-input settings-input-orange" 
                    value={lateTime} onChange={e => setLateTime(e.target.value)} required 
                    style={{ colorScheme: "light", borderColor: "rgba(249, 115, 22, 0.3)", background: "rgba(249, 115, 22, 0.04)" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Check-in Ends</label>
                  <input 
                    type="time" className="settings-input" 
                    value={endTime} onChange={e => setEndTime(e.target.value)} required 
                    style={{ colorScheme: "light", borderColor: "rgba(220, 38, 38, 0.3)", background: "rgba(220, 38, 38, 0.04)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Check-out Window <span style={{ textTransform: "none", fontWeight: 400, letterSpacing: 0 }}>(optional)</span>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Check-out Starts</label>
                    <input
                      type="time" className="settings-input"
                      value={checkOutStartTime} onChange={e => setCheckOutStartTime(e.target.value)}
                      style={{ colorScheme: "light" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Check-out Ends</label>
                    <input
                      type="time" className="settings-input"
                      value={checkOutEndTime} onChange={e => setCheckOutEndTime(e.target.value)}
                      style={{ colorScheme: "light" }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Event Type
                </label>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {EVENT_TYPES.map(type => {
                    const style = getEventTypeStyle(type);
                    const selected = eventType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setEventType(type)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          padding: "7px 16px",
                          borderRadius: "var(--radius-sm)",
                          border: `1px solid ${selected ? style.border : "var(--border)"}`,
                          background: selected ? style.bg : "var(--surface2)",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: selected ? 600 : 400,
                          color: selected ? style.color : "var(--white-shade)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: selected ? style.color : "var(--border)",
                          flexShrink: 0,
                          transition: "all 0.15s ease",
                        }} />
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--dimmed)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }}>
                  Target Year Levels
                  <span style={{ 
                    fontWeight: 500, 
                    textTransform: "none", 
                    letterSpacing: 0, 
                    color: "var(--gold)", 
                    background: "rgba(232, 184, 75, 0.08)", 
                    border: "1px solid rgba(232, 184, 75, 0.25)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    <Info size={12} style={{ flexShrink: 0 }} />
                    Leave all unchecked for All Years
                  </span>
                </label>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {YEAR_LEVELS.map(year => {
                    const checked = targetYearLevels.includes(year);
                    return (
                      <label
                        key={year}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          padding: "7px 14px",
                          borderRadius: "var(--radius-sm)",
                          border: `1px solid ${checked ? "rgba(79,70,229,0.5)" : "var(--border)"}`,
                          background: checked ? "rgba(79,70,229,0.1)" : "var(--surface2)",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: checked ? "#a5b4fc" : "var(--white-shade)",
                          transition: "all 0.15s ease",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setTargetYearLevels(prev =>
                              prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
                            );
                          }}
                          style={{ accentColor: "#4f46e5", width: "14px", height: "14px" }}
                        />
                        {year}
                      </label>
                    );
                  })}
                </div>
              </div>

              {formError && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.3)", color: "#fca5a5", fontSize: "13px", padding: "10px 14px", borderRadius: "8px" }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{formError}</span>
                </div>
              )}

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
                  className="btn-submit-event"
                  style={{ padding: "0 20px", height: "36px", fontSize: "13px", fontWeight: 600, borderRadius: "var(--radius-sm)", color: "#fff", background: "#4f46e5", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", opacity: isSubmitting ? 0.7 : 1, transition: "all 0.15s ease" }}
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

      {/* DELETE CONFIRMATION MODAL */}
      {eventToDelete && (
        <div className="modal-overlay" style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000,
          padding: "20px", paddingTop: "15vh"
        }}>
          <div className="modal-card" style={{ 
            width: "100%", maxWidth: "480px", 
            background: "var(--surface)", border: "1px solid var(--border)", 
            borderRadius: "12px", padding: "28px", position: "relative",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--danger)", flexShrink: 0 }}>
                <AlertTriangle size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--white)", marginBottom: "8px" }}>Delete Event</h3>
                <p style={{ color: "var(--dimmed)", fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
                  Are you sure you want to delete <strong>{eventToDelete.name}</strong>? This action cannot be undone and will permanently delete all attendance records associated with it.
                </p>
              </div>
            </div>
            
            <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button 
                type="button" 
                onClick={() => setEventToDelete(null)}
                className="btn-ghost"
                style={{ padding: "0 16px", height: "36px", fontSize: "13px", fontWeight: 500, borderRadius: "var(--radius-sm)", color: "var(--white-shade)", border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s ease" }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleDeleteConfirm}
                className="btn-danger"
                style={{ padding: "0 20px", height: "36px", fontSize: "13px", fontWeight: 600, borderRadius: "var(--radius-sm)", color: "#fff", background: "var(--danger)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", opacity: isDeleting ? 0.7 : 1, transition: "all 0.15s ease" }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <><Loader2 size={14} className="animate-spin" /> Deleting...</>
                ) : "Delete Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ALL CONFIRMATION MODAL */}
      {showDeleteAllModal && (
        <div className="modal-overlay" style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000,
          padding: "20px", paddingTop: "15vh"
        }}>
          <div className="modal-card" style={{ 
            width: "100%", maxWidth: "480px", 
            background: "var(--surface)", border: "1px solid var(--border)", 
            borderRadius: "12px", padding: "28px", position: "relative",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--danger)", flexShrink: 0 }}>
                <AlertTriangle size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--white)", marginBottom: "8px" }}>Delete All Events</h3>
                <p style={{ color: "var(--dimmed)", fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
                  Are you sure you want to delete <strong>ALL</strong> events? This action is irreversible. It will permanently delete all events and erase all participation and attendance records system-wide.
                </p>
              </div>
            </div>
            
            <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button 
                type="button" 
                onClick={() => setShowDeleteAllModal(false)}
                className="btn-ghost"
                style={{ padding: "0 16px", height: "36px", fontSize: "13px", fontWeight: 500, borderRadius: "var(--radius-sm)", color: "var(--white-shade)", border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s ease" }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleDeleteAllConfirm}
                className="btn-danger"
                style={{ padding: "0 20px", height: "36px", fontSize: "13px", fontWeight: 600, borderRadius: "var(--radius-sm)", color: "#fff", background: "var(--danger)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", opacity: isDeleting ? 0.7 : 1, transition: "all 0.15s ease" }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <><Loader2 size={14} className="animate-spin" /> Deleting...</>
                ) : "Delete All Events"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 2000,
          display: "flex", alignItems: "center", gap: "10px",
          background: toast.type === "success" ? "rgba(16,185,129,0.12)" : "rgba(220,38,38,0.12)",
          border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.35)" : "rgba(220,38,38,0.35)"}`,
          color: toast.type === "success" ? "#34d399" : "#fca5a5",
          padding: "12px 18px", borderRadius: "8px",
          fontSize: "13px", fontWeight: 500,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          animation: "fadeInUp 0.2s ease",
          maxWidth: "360px",
        }}>
          {toast.type === "success"
            ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            : <AlertTriangle size={16} style={{ flexShrink: 0 }} />}
          {toast.message}
        </div>
      )}

      <style jsx>{`
        .search-input:focus {
          border-color: var(--gold) !important;
          box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.12);
        }
        .settings-input-orange:focus {
          border-color: #f97316 !important;
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.12);
        }
        .btn-danger:hover {
          background: #dc2626 !important;
        }
        .btn-danger-outline {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 0 16px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.05);
          color: var(--danger);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .btn-danger-outline:hover {
          background: rgba(239, 68, 68, 0.12) !important;
          border-color: rgba(239, 68, 68, 0.6) !important;
          color: #ef4444 !important;
        }
        .btn-create-event {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #4f46e5 !important;
          color: #ffffff !important;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-create-event:hover {
          background: #4338ca !important;
          transform: translateY(-1px);
        }
        .btn-submit-event:hover {
          background: #4338ca !important;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
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
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border-radius: var(--radius-sm);
          opacity: 0.85;
          transition: all 0.15s ease;
        }
        .event-row:hover .action-btn-hover {
          opacity: 1;
        }
        .edit-btn-hover {
          color: var(--gold);
          background: rgba(232, 184, 75, 0.06);
          border: 1px solid rgba(232, 184, 75, 0.15);
        }
        .edit-btn-hover:hover {
          background: rgba(232, 184, 75, 0.15) !important;
          border-color: rgba(232, 184, 75, 0.3) !important;
          color: var(--gold) !important;
        }
        .delete-btn-hover {
          color: var(--danger);
          background: rgba(248, 113, 113, 0.06);
          border: 1px solid rgba(248, 113, 113, 0.15);
        }
        .delete-btn-hover:hover {
          background: rgba(248, 113, 113, 0.15) !important;
          border-color: rgba(248, 113, 113, 0.3) !important;
          color: var(--danger) !important;
        }
      `}</style>
    </>
  );
}
