"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, Download, Search, Calendar, RefreshCw } from "lucide-react";

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
}

export default function AdminAttendance() {
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAttendance = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // Join BOTH events and qr_sessions — scanner scans write event_id,
      // QR session check-ins write session_id. We prefer whichever is non-null.
      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          id,
          time_in,
          time_out,
          status,
          event_id,
          session_id,
          events ( name, date, location ),
          qr_sessions ( subject, date, section ),
          users!student_id ( full_name, email )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted: AttendanceRow[] = (data || []).map((r: any) => {
        const uData = r.users;
        const ev = r.events;      // school-wide event (scanner)
        const sess = r.qr_sessions; // classroom session (self check-in)

        // Prefer event data if available, fall back to session data
        const subject = ev?.name || sess?.subject || "General Event";
        const section = sess?.section || "N/A";
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
            ? new Date(r.time_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : "—",
          timeOut: r.time_out
            ? new Date(r.time_out).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : "—",
          status: r.status,
          rawDate,
        };
      });

      const { data: sectionData } = await supabase.from("student_profiles").select("section");
      const allSections = Array.from(
        new Set((sectionData || []).map((s: any) => s.section).filter(Boolean))
      ).sort() as string[];
      setAvailableSections(allSections);
      setRecords(formatted);
    } catch (err) {
      console.error("Error fetching admin attendance", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load + auth guard
  useEffect(() => {
    async function init() {
      const u = await getCurrentUser();
      if (!u) return;
      if (u.account_type !== "admin") {
        router.push(u.account_type === "facilitator" ? "/dashboard/facilitator" : "/dashboard");
        return;
      }
      fetchAttendance();
    }
    init();
  }, [router, fetchAttendance]);

  // ── Real-time subscription: refresh log whenever attendance_records changes ──
  useEffect(() => {
    const channel = supabase
      .channel("admin-attendance-log-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          fetchAttendance(true); // silent refresh — no full-page loader
        }
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

  const filtered = records.filter((r) => {
    const sMatch = filterStatus === "All" || r.status.toLowerCase() === filterStatus.toLowerCase();
    const secMatch = filterSection === "All" || r.section === filterSection;
    const dateMatch = !selectedDate || r.rawDate === selectedDate;
    const searchMatch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase());
    return sMatch && secMatch && dateMatch && searchMatch;
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
        </div>
      </div>

      {/* Summary Strip */}
      <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 24px", marginBottom: "32px" }}>
        {[
          { label: "Present", count: present, color: "var(--success)" },
          { label: "Late", count: late, color: "var(--gold)" },
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
