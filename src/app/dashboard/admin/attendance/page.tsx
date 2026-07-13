"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, formatManilaTime } from "@/lib/supabase";
import { getAuthHeader } from "@/lib/auth-client";
import { useCurrentUser } from "@/lib/current-user-context";
import { debounce } from "@/lib/debounce";
import { useRouter } from "next/navigation";
import { Loader2, Download, Search, Calendar, RefreshCw, Plus } from "lucide-react";

interface AttendanceRow {
  id: string;
  name: string;
  email: string;
  subject: string;
  section: string;
  date: string;
  displayDate: string;
  timeIn: string;
  timeOut: string;
  status: string;
  rawDate: string;
  remarks: string;
}

interface StudentOption {
  id: string;
  full_name: string;
  email: string;
  student_id_number: string;
}

interface EventOption {
  id: string;
  name: string;
  date: string;
}

const MANUAL_STATUS_OPTIONS = ["present", "late", "absent", "incomplete"] as const;

// Join BOTH events and qr_sessions — scanner scans write event_id, QR
// session check-ins write session_id. We prefer whichever is non-null.
// student_profiles(section) is the real source of a student's section —
// qr_sessions.section only applies to the legacy classroom check-in path
// and is null for the school-wide scanner flow that most attendance goes
// through, so it's kept only as a fallback, not the primary source.
const ATTENDANCE_SELECT = `
  id,
  time_in,
  time_out,
  status,
  remarks,
  event_id,
  session_id,
  events ( name, date, location ),
  qr_sessions ( subject, date, section ),
  users!student_id ( full_name, email, student_profiles ( section ) )
`;

function formatAttendanceRows(data: any[]): AttendanceRow[] {
  return (data || []).map((r: any) => {
    const uData = r.users;
    const ev = r.events;      // school-wide event (scanner)
    const sess = r.qr_sessions; // classroom session (self check-in)

    const studentProfiles = uData?.student_profiles;
    const studentSection = Array.isArray(studentProfiles) ? studentProfiles[0]?.section : studentProfiles?.section;

    // Prefer event data if available, fall back to session data
    const subject = ev?.name || sess?.subject || "General Event";
    const section = studentSection || sess?.section || "N/A";
    const rawDate = ev?.date || sess?.date || "";
    const displayDate = rawDate
      ? new Date(rawDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—";

    return {
      id: r.id,
      name: uData?.full_name || "Unknown Student",
      email: uData?.email || "",
      subject,
      section,
      date: rawDate,
      displayDate,
      timeIn: r.time_in
        ? formatManilaTime(r.time_in, { hour: "numeric", minute: "2-digit" })
        : "—",
      timeOut: r.time_out
        ? formatManilaTime(r.time_out, { hour: "numeric", minute: "2-digit" })
        : "—",
      status: r.status,
      rawDate,
      remarks: r.remarks || "",
    };
  });
}

export default function AdminAttendance() {
  const currentUser = useCurrentUser();
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [filterEvent, setFilterEvent] = useState("All");
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [availableEvents, setAvailableEvents] = useState<{ id: string; name: string }[]>([]);
  const [eventScopedRows, setEventScopedRows] = useState<AttendanceRow[] | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Manual reconciliation modal ──────────────────────────────────────
  const [showManualModal, setShowManualModal] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [manualStudentQuery, setManualStudentQuery] = useState("");
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualEventId, setManualEventId] = useState("");
  const [manualStatus, setManualStatus] = useState<(typeof MANUAL_STATUS_OPTIONS)[number]>("present");
  const [manualRemarks, setManualRemarks] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState("");

  const openManualModal = useCallback(async () => {
    setManualError("");
    setManualStudentQuery("");
    setManualStudentId("");
    setManualEventId("");
    setManualStatus("present");
    setManualRemarks("");
    setShowManualModal(true);

    const [{ data: studentData }, { data: eventData }] = await Promise.all([
      supabase
        .from("student_profiles")
        .select("student_id_number, users:user_id ( id, full_name, email )")
        .order("student_id_number"),
      supabase.from("events").select("id, name, date").order("date", { ascending: false }),
    ]);

    setStudents(
      (studentData || [])
        .map((s: any) => ({
          id: s.users?.id,
          full_name: s.users?.full_name || "Unknown Student",
          email: s.users?.email || "",
          student_id_number: s.student_id_number || "",
        }))
        .filter((s: StudentOption) => !!s.id)
    );
    setEvents((eventData || []) as EventOption[]);
  }, []);

  const filteredManualStudents = students.filter((s) => {
    const q = manualStudentQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.student_id_number.toLowerCase().includes(q)
    );
  });

  const handleManualSubmit = async () => {
    if (!manualStudentId || !manualEventId) {
      setManualError("Select a student and an event.");
      return;
    }
    setManualSubmitting(true);
    setManualError("");
    try {
      const res = await fetch("/api/admin/attendance/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({
          student_id: manualStudentId,
          event_id: manualEventId,
          status: manualStatus,
          remarks: manualRemarks.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setManualError(json.error || "Failed to add record");
        return;
      }
      setShowManualModal(false);
      fetchAttendance(true);
    } catch {
      setManualError("Failed to add record");
    } finally {
      setManualSubmitting(false);
    }
  };

  const fetchAttendance = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      let data: any[] | null = null;
      let error: any = null;

      if (selectedDate) {
        // The default fetch below is bounded to the most recent 2000 records
        // (by created_at) so it doesn't seq-scan an ever-growing table — but
        // that means an older date can silently show zero results even when
        // real records exist for it, once the table grows past that window.
        // Resolve exactly which events/qr_sessions fall on the selected date
        // first (both are small, non-hot tables), then pull attendance for
        // those via the existing event_id/session_id indexes
        // (idx_attendance_event / idx_attendance_session) instead of relying
        // on the created_at window at all.
        const [{ data: evRows }, { data: sessRows }] = await Promise.all([
          supabase.from("events").select("id").eq("date", selectedDate),
          supabase.from("qr_sessions").select("id").eq("date", selectedDate),
        ]);
        const eventIds = (evRows || []).map((e: any) => e.id);
        const sessionIds = (sessRows || []).map((s: any) => s.id);

        if (eventIds.length === 0 && sessionIds.length === 0) {
          data = [];
        } else {
          const orParts = [
            eventIds.length ? `event_id.in.(${eventIds.join(",")})` : null,
            sessionIds.length ? `session_id.in.(${sessionIds.join(",")})` : null,
          ].filter(Boolean).join(",");

          const res = await supabase
            .from("attendance_records")
            .select(ATTENDANCE_SELECT)
            .or(orParts)
            // Defensive cap — a single day's attendance across every event
            // shouldn't approach this, just a circuit breaker.
            .limit(5000);
          data = res.data;
          error = res.error;
        }
      } else {
        const res = await supabase
          .from("attendance_records")
          .select(ATTENDANCE_SELECT)
          // Bound the log to the most recent records so this doesn't seq-scan
          // an ever-growing table on every load / realtime refresh. Backed by
          // idx_attendance_created.
          //
          // NOTE: the cap must stay well above a single day's roster volume. A
          // bulk backfill can insert ~1 row per student per event in one burst
          // (~2k rows for a day of orientations); a 2,000 cap let that burst
          // fill the whole window and hide the day's real present/late scans
          // (the "1 present" bug). 20,000 matches the backfill's own ceiling.
          .order("created_at", { ascending: false })
          .limit(20000);
        data = res.data;
        error = res.error;
      }

      if (error) throw error;

      setRecords(formatAttendanceRows(data || []));
    } catch (err) {
      console.error("Error fetching admin attendance", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  // Distinct sections for the filter dropdown — fetched once on mount, not
  // from the realtime-triggered fetchAttendance above, since section
  // membership doesn't change on a scan event and this would otherwise be a
  // full student_profiles scan on every attendance_records change school-wide.
  const fetchSections = useCallback(async () => {
    const { data: sectionData } = await supabase.from("student_profiles").select("section");
    const allSections = Array.from(
      new Set((sectionData || []).map((s: any) => s.section).filter(Boolean))
    ).sort() as string[];
    setAvailableSections(allSections);
  }, []);

  // Distinct event names for the filter dropdown — fetched once on mount from
  // the events table, NOT derived from the fetched records. Deriving from records
  // makes an event vanish from the dropdown when its rows fall outside the current
  // fetch window (e.g. a bulk-absent burst pushing older rows past the row cap —
  // the "CPMT Orientation disappeared" symptom). Mirrors fetchSections.
  const fetchEventNames = useCallback(async () => {
    const { data: eventData } = await supabase
      .from("events")
      .select("id, name")
      .order("date", { ascending: false });
    setAvailableEvents(
      (eventData || []).filter((e: any) => e.name) as { id: string; name: string }[]
    );
  }, []);

  // When a specific event is selected, fetch ITS rows directly by event_id
  // (indexed, unbounded by student-count-scale limit) instead of relying on
  // the default log fetch below, which orders by created_at and is capped —
  // Supabase/PostgREST enforces a hard per-query row ceiling (1,000)
  // regardless of the .limit() the client requests. Once total attendance
  // volume crosses that ceiling, an event whose rows were UPDATED (not
  // re-inserted) — e.g. a reconciliation flipping absent/incomplete to
  // present — keeps its OLD created_at and can fall outside the "most
  // recent N" window, silently under-counting that event's stats even
  // though the underlying data is correct. Querying by event_id sidesteps
  // the created_at ordering entirely, same technique already used in the
  // selectedDate branch below.
  useEffect(() => {
    if (filterEvent === "All") {
      setEventScopedRows(null);
      return;
    }
    const match = availableEvents.find((e) => e.name === filterEvent);
    if (!match) {
      setEventScopedRows(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("attendance_records")
      .select(ATTENDANCE_SELECT)
      .eq("event_id", match.id)
      .limit(5000)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setEventScopedRows(formatAttendanceRows(data || []));
      });
    return () => {
      cancelled = true;
    };
  }, [filterEvent, availableEvents]);

  // Initial load + auth guard — waits for DashboardLayout to resolve
  // currentUser via context instead of re-fetching it here.
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.account_type !== "admin") {
      router.push(currentUser.account_type === "facilitator" ? "/dashboard/facilitator" : "/dashboard");
      return;
    }
    fetchAttendance();
    fetchSections();
    fetchEventNames();
  }, [router, fetchAttendance, fetchSections, fetchEventNames, currentUser]);

  // ── Real-time subscription: refresh log whenever attendance_records changes ──
  // Intentionally unfiltered on the subscription itself — any change re-runs
  // fetchAttendance, which already re-scopes its own query to selectedDate
  // when one is set. filterStatus/filterSection/filterEvent/search stay
  // client-side on top of whatever fetchAttendance returns and default to
  // "All"; binding the subscription itself to those would silently stop
  // live-updating the default view.
  useEffect(() => {
    const channel = supabase
      .channel("admin-attendance-log-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        debounce(() => fetchAttendance(true), 1500) // silent refresh — no full-page loader
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAttendance]);

  const sections =
    availableSections.length > 0
      ? availableSections
      : Array.from(new Set(records.map((r) => r.section).filter((s) => s !== "N/A"))).sort();

  // Prefer the events-table list (always complete) and fall back to the
  // records-derived set only until it loads — mirrors `sections` above.
  const eventNames =
    availableEvents.length > 0
      ? Array.from(new Set(availableEvents.map((e) => e.name)))
      : Array.from(new Set(records.map((r) => r.subject).filter(Boolean))).sort();

  // Base row set for filtering/stats: the event-scoped fetch (complete, not
  // row-cap-truncated) when a specific event is selected, otherwise the
  // default bounded log fetch.
  const baseRows = filterEvent !== "All" && eventScopedRows !== null ? eventScopedRows : records;

  const filtered = baseRows.filter((r) => {
    const sMatch = filterStatus === "All" || r.status.toLowerCase() === filterStatus.toLowerCase();
    const secMatch = filterSection === "All" || r.section === filterSection;
    const eventMatch = filterEvent === "All" || r.subject === filterEvent;
    const dateMatch = !selectedDate || r.rawDate === selectedDate;
    const searchMatch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase());
    return sMatch && secMatch && eventMatch && dateMatch && searchMatch;
  });

  const present = filtered.filter((r) => r.status === "present").length;
  const late = filtered.filter((r) => r.status === "late").length;
  const absent = filtered.filter((r) => r.status === "absent").length;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 className="animate-spin" size={24} color="var(--dimmed)" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "var(--dimmed)", letterSpacing: "0.06em", marginBottom: "8px" }}>
            <span>Admin Control</span><span style={{ margin: "0 8px" }}>/</span><span>Attendance</span>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.03em", color: "var(--white)" }}>
            Attendance Logs
            {refreshing && <Loader2 className="animate-spin" size={16} color="var(--dimmed)" style={{ marginLeft: 10, display: "inline" }} />}
          </h2>
          <p style={{ color: "var(--dimmed)", fontSize: "13px", marginTop: "4px", margin: 0 }}>
            Master database of all recorded participation · Updates in real-time
          </p>
        </div>
        <div className="header-actions" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ position: "relative", width: "160px" }}>
            <Calendar size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--dimmed)" }} />
            <input
              className="date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ paddingLeft: "36px", paddingRight: "12px", height: "36px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", width: "100%", fontSize: "13px", outline: "none", cursor: "pointer", transition: "border-color 0.15s ease" }}
            />
          </div>
          <button
            className="btn-ghost"
            onClick={() => fetchAttendance(true)}
            style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white-shade)", fontSize: "13px", fontWeight: 500, cursor: "pointer", gap: "6px", transition: "all 0.15s ease" }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            className="btn-ghost"
            style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white-shade)", fontSize: "13px", fontWeight: 500, cursor: "pointer", gap: "6px", transition: "all 0.15s ease" }}
          >
            <Download size={14} /> Export
          </button>
          <button
            className="btn-ghost"
            onClick={openManualModal}
            style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white-shade)", fontSize: "13px", fontWeight: 500, cursor: "pointer", gap: "6px", transition: "all 0.15s ease" }}
          >
            <Plus size={14} /> Add Manual Record
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 24px", marginBottom: "32px" }}>
        {[
          { label: "Present", count: present, color: "var(--success)" },
          { label: "Late", count: late, color: "#d97706" },
          { label: "Absent", count: absent, color: "var(--danger)" },
          { label: "Total Filtered", count: filtered.length, color: "var(--white)" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{item.label}</div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: item.color, letterSpacing: "-0.02em" }}>{item.count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div style={{ display: "flex", gap: "24px", marginBottom: "24px", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "250px", position: "relative" }}>
          <Search size={14} color="var(--dimmed)" style={{ position: "absolute", left: "12px" }} />
          <input
            className="search-input"
            placeholder="Search student name or email..."
            style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: "0 12px 0 36px", height: "36px", borderRadius: "var(--radius-sm)", color: "var(--white)", fontSize: "13px", width: "100%", outline: "none", transition: "border-color 0.15s ease" }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {["All", "Present", "Late", "Absent"].map((f) => (
            <button
              key={f}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: filterStatus === f ? "2px solid var(--gold)" : "2px solid transparent",
                color: filterStatus === f ? "var(--white)" : "var(--dimmed)",
                padding: "0 4px 12px",
                fontSize: "13px",
                fontWeight: filterStatus === f ? 500 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
                marginBottom: "-13px",
              }}
              onClick={() => setFilterStatus(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div style={{ height: "24px", width: "1px", background: "var(--border)", margin: "0 8px" }} />

        <select
          className="search-input select-input"
          style={{ width: "auto", minWidth: "140px", height: "36px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", fontSize: "13px", padding: "0 12px", outline: "none", cursor: "pointer" }}
          value={filterSection}
          onChange={(e) => setFilterSection(e.target.value)}
        >
          <option value="All">All Sections</option>
          {sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          className="search-input select-input"
          style={{ width: "auto", minWidth: "160px", height: "36px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", fontSize: "13px", padding: "0 12px", outline: "none", cursor: "pointer" }}
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
        >
          <option value="All">All Events</option>
          {eventNames.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="attendance-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: "24px" }}>Student Name</th>
                <th>Subject / Event</th>
                <th>Section</th>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
                <th>Notes</th>
                <th style={{ textAlign: "right", paddingRight: "24px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const initials = r.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "S";
                return (
                  <tr key={r.id} className="user-row">
                    <td style={{ paddingLeft: "24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div className="avatar" style={{ width: "32px", height: "32px", fontSize: "12px", fontWeight: 600, flexShrink: 0, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--dimmed)" }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--white)" }}>{r.name}</div>
                          <div style={{ fontSize: "13px", color: "var(--dimmed)" }}>{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "var(--white-shade)", fontSize: "13px" }}>{r.subject}</td>
                    <td>
                      <span className="tag" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--dimmed)", fontSize: "11px" }}>{r.section}</span>
                    </td>
                    <td style={{ color: "var(--dimmed)", fontSize: "13px" }}>{r.displayDate}</td>
                    <td style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: r.timeIn === "—" ? "var(--muted)" : "var(--white-shade)" }}>{r.timeIn}</td>
                    <td style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: r.timeOut === "—" ? "var(--muted)" : "var(--white-shade)" }}>{r.timeOut}</td>
                    <td>
                      <span className={`status-badge ${r.status}`} style={{ fontSize: "11px", padding: "4px 8px" }}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: "var(--dimmed)", fontSize: "12px", maxWidth: "220px" }} title={r.remarks}>
                      {r.remarks ? (r.remarks.length > 40 ? `${r.remarks.slice(0, 40)}…` : r.remarks) : "—"}
                    </td>
                    <td style={{ textAlign: "right", paddingRight: "24px" }}>
                      <button className="action-btn-hover" style={{ width: "auto", padding: "6px 12px", marginLeft: "auto" }}>Review</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "64px 24px", textAlign: "center", color: "var(--dimmed)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 48, height: 48, border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Search size={20} color="var(--dimmed)" />
              </div>
              <p style={{ fontSize: 13, margin: 0 }}>No records found matching your current search or filters.</p>
            </div>
          )}
        </div>
      </div>

      {showManualModal && (
        <div className="modal-overlay" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000,
          padding: "20px", paddingTop: "10vh"
        }}>
          <div className="modal-card" style={{
            width: "100%", maxWidth: "480px",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "12px", padding: "28px", position: "relative",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--white)", marginBottom: "4px" }}>Add Manual Record</h3>
            <p style={{ color: "var(--dimmed)", fontSize: "13px", lineHeight: "1.5", margin: "0 0 20px" }}>
              For students who attended a past event but didn&apos;t have a PharmaTrack account yet (e.g. no USA email at the time).
            </p>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: "var(--dimmed)", display: "block", marginBottom: "6px" }}>Student</label>
              <input
                className="search-input"
                placeholder="Search by name, email, or student ID..."
                value={manualStudentQuery}
                onChange={(e) => { setManualStudentQuery(e.target.value); setManualStudentId(""); }}
                style={{ width: "100%", height: "36px", padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--white)", fontSize: "13px", outline: "none", marginBottom: "8px" }}
              />
              {manualStudentQuery && !manualStudentId && (
                <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                  {filteredManualStudents.slice(0, 20).map((s) => (
                    <div
                      key={s.id}
                      onClick={() => { setManualStudentId(s.id); setManualStudentQuery(`${s.full_name} (${s.student_id_number})`); }}
                      style={{ padding: "8px 12px", fontSize: "13px", cursor: "pointer", color: "var(--white-shade)", borderBottom: "1px solid var(--border)" }}
                      className="user-row"
                    >
                      <div>{s.full_name}</div>
                      <div style={{ fontSize: "11px", color: "var(--dimmed)" }}>{s.email} · {s.student_id_number}</div>
                    </div>
                  ))}
                  {filteredManualStudents.length === 0 && (
                    <div style={{ padding: "8px 12px", fontSize: "13px", color: "var(--dimmed)" }}>No matching students found.</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: "var(--dimmed)", display: "block", marginBottom: "6px" }}>Event</label>
              <select
                className="search-input select-input"
                value={manualEventId}
                onChange={(e) => setManualEventId(e.target.value)}
                style={{ width: "100%", height: "36px", padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--white)", fontSize: "13px", outline: "none" }}
              >
                <option value="">Select an event...</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} — {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: "var(--dimmed)", display: "block", marginBottom: "6px" }}>Status</label>
              <select
                className="search-input select-input"
                value={manualStatus}
                onChange={(e) => setManualStatus(e.target.value as typeof manualStatus)}
                style={{ width: "100%", height: "36px", padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--white)", fontSize: "13px", outline: "none" }}
              >
                {MANUAL_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: "var(--dimmed)", display: "block", marginBottom: "6px" }}>Remarks (optional)</label>
              <textarea
                value={manualRemarks}
                onChange={(e) => setManualRemarks(e.target.value)}
                placeholder="Defaults to a note that this was manually reconciled"
                rows={2}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--white)", fontSize: "13px", outline: "none", resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            {manualError && (
              <p style={{ color: "var(--danger)", fontSize: "13px", margin: "0 0 14px" }}>{manualError}</p>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="btn-ghost"
                style={{ padding: "0 16px", height: "36px", fontSize: "13px", fontWeight: 500, borderRadius: "var(--radius-sm)", color: "var(--white-shade)", border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s ease" }}
                disabled={manualSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                style={{ padding: "0 20px", height: "36px", fontSize: "13px", fontWeight: 600, borderRadius: "var(--radius-sm)", color: "#0a0a0a", background: "var(--gold)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", opacity: manualSubmitting || !manualStudentId || !manualEventId ? 0.6 : 1, transition: "all 0.15s ease" }}
                disabled={manualSubmitting || !manualStudentId || !manualEventId}
              >
                {manualSubmitting ? (<><Loader2 size={14} className="animate-spin" /> Saving...</>) : "Add Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .search-input:focus, .date-input:focus {
          border-color: rgba(255,255,255,0.15) !important;
        }

        .date-input::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.3;
          cursor: pointer;
        }
        .date-input::-webkit-calendar-picker-indicator:hover {
          opacity: 0.6;
        }

        .btn-ghost:hover {
          background: var(--surface2) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }

        .user-row {
          transition: background 0.15s ease;
        }
        .user-row:hover {
          background: var(--surface2);
        }

        .action-btn-hover {
          background: var(--surface2);
          border: 1px solid var(--border);
          color: var(--white-shade);
          cursor: pointer;
          border-radius: var(--radius-sm);
          opacity: 1;
          transition: all 0.15s ease;
          font-size: 11px;
          font-family: var(--font-sans);
          font-weight: 500;
          padding: 6px 12px;
        }
        .action-btn-hover:hover {
          color: var(--white);
          background: var(--surface) !important;
          border-color: rgba(232, 184, 75, 0.3);
        }
      `}</style>
    </div>
  );
}
