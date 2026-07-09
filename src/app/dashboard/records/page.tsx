"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { debounce } from "@/lib/debounce";
import { useRouter } from "next/navigation";
import {
  Loader2, Download, Search, Calendar,
  CheckCircle, Clock, AlertCircle, Activity, ChevronDown, RefreshCw,
  FileText,
} from "lucide-react";

interface AttendanceRow {
  id: string;
  subject: string;
  date: string;
  displayDate: string;
  timeIn: string;
  timeOut: string;
  status: string;
  rawDate: string;
  remarks: string;
}

export default function StudentRecords() {
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Date Range Picker States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePreset, setDatePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const setPresetRange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    const toISOStringLocal = (date: Date) => {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().split("T")[0];
    };

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
      setShowDatePicker(false);
    } else if (preset === "today") {
      const todayStr = toISOStringLocal(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setShowDatePicker(false);
    } else if (preset === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toISOStringLocal(yesterday);
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
      setShowDatePicker(false);
    } else if (preset === "7days") {
      const past7 = new Date();
      past7.setDate(today.getDate() - 6);
      setStartDate(toISOStringLocal(past7));
      setEndDate(toISOStringLocal(today));
      setShowDatePicker(false);
    } else if (preset === "30days") {
      const past30 = new Date();
      past30.setDate(today.getDate() - 29);
      setStartDate(toISOStringLocal(past30));
      setEndDate(toISOStringLocal(today));
      setShowDatePicker(false);
    }
    // "custom" — leave picker open
  };

  const getRangeLabel = () => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };
    if (datePreset === "all" || (!startDate && !endDate)) return "All Time";
    if (datePreset === "today") return "Today";
    if (datePreset === "yesterday") return "Yesterday";
    if (datePreset === "7days") return "Last 7 Days";
    if (datePreset === "30days") return "Last 30 Days";
    if (startDate && endDate) {
      if (startDate === endDate) return formatDate(startDate);
      return `${formatDate(startDate)} – ${formatDate(endDate)}`;
    }
    if (startDate) return `From ${formatDate(startDate)}`;
    if (endDate) return `Until ${formatDate(endDate)}`;
    return "Custom Range";
  };

  // ── Core fetch ──────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const u = await getCurrentUser();
      if (!u) { router.push("/login"); return; }
      setUserId(u.id);

      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          id,
          time_in,
          time_out,
          status,
          remarks,
          event_id,
          session_id,
          events ( name, date ),
          qr_sessions ( subject, date )
        `)
        .eq("student_id", u.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted: AttendanceRow[] = (data || []).map((r: any) => {
        const ev = r.events;
        const sess = r.qr_sessions;

        const subject = ev?.name || sess?.subject || "General Event";
        const rawDate = ev?.date || sess?.date || "";
        const displayDate = rawDate
          ? new Date(rawDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "—";

        return {
          id: r.id,
          subject,
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
          remarks: r.remarks || "No remarks",
        };
      });

      setRecords(formatted);
    } catch (err) {
      console.error("Error fetching records", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  // Initial load
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ── Real-time subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("student-records-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records", filter: `student_id=eq.${userId}` },
        debounce(() => fetchRecords(true), 1500)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchRecords]);

  const filtered = records.filter((r) => {
    const sMatch = filterStatus === "All" || r.status.toLowerCase() === filterStatus.toLowerCase();

    let dateMatch = true;
    if (startDate || endDate) {
      if (r.rawDate) {
        if (startDate && r.rawDate < startDate) dateMatch = false;
        if (endDate && r.rawDate > endDate) dateMatch = false;
      } else {
        dateMatch = false;
      }
    }

    const searchMatch =
      r.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.displayDate.toLowerCase().includes(searchQuery.toLowerCase());
    return sMatch && dateMatch && searchMatch;
  });

  const present = filtered.filter((r) => r.status === "present").length;
  const late = filtered.filter((r) => r.status === "late").length;
  const absent = filtered.filter((r) => r.status === "absent").length;

  function handleExportCSV() {
    if (filtered.length === 0) {
      alert("No records to export. Try clearing your filters.");
      return;
    }
    const header = ["Date", "Event", "Time In", "Time Out", "Status", "Remarks"];
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filtered.map((r) => [r.displayDate, r.subject, r.timeIn, r.timeOut, r.status, r.remarks].map(escape).join(","));
    const csv = [header.map(escape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PharmaTrack_MyAttendance_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
            Student · My Records
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--white)", display: "flex", alignItems: "center", gap: 8 }}>
            Attendance Records
            {refreshing && <Loader2 className="animate-spin" size={16} color="var(--dimmed)" />}
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4, margin: 0 }}>
            Your personal attendance history · Updates in real-time
          </p>
        </div>
        <div className="header-actions" style={{ display: "flex", gap: "12px", alignItems: "center", position: "relative" }} ref={dropdownRef}>
          {/* Date Range Button */}
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="btn-ghost date-range-btn"
            style={{
              display: "flex", alignItems: "center", height: "36px", padding: "0 14px",
              borderRadius: "var(--radius-sm)",
              border: showDatePicker ? "1px solid rgba(255, 255, 255, 0.25)" : "1px solid var(--border)",
              background: "var(--surface)", color: "var(--white-shade)", fontSize: "13px", fontWeight: 500,
              cursor: "pointer", gap: "8px", transition: "all 0.15s ease",
              boxShadow: showDatePicker ? "0 0 10px rgba(255, 255, 255, 0.05)" : "none",
            }}
          >
            <Calendar size={14} style={{ color: "var(--gold)" }} />
            <span>{getRangeLabel()}</span>
            <ChevronDown size={14} style={{ opacity: 0.5, transform: showDatePicker ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
          </button>

          {showDatePicker && (
            <div
              className="date-picker-dropdown fade-in"
              style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                background: "var(--surface2, #1C1C25)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "16px", width: "320px",
                zIndex: 100, boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", gap: "14px",
              }}
            >
              <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
                Filter by Date Range
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[
                  { id: "all", label: "All Time" },
                  { id: "today", label: "Today" },
                  { id: "yesterday", label: "Yesterday" },
                  { id: "7days", label: "Last 7 Days" },
                  { id: "30days", label: "Last 30 Days" },
                  { id: "custom", label: "Custom Range" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setPresetRange(preset.id)}
                    style={{
                      padding: "8px 10px", borderRadius: "var(--radius-sm)",
                      border: datePreset === preset.id ? "1px solid var(--gold)" : "1px solid var(--border)",
                      background: datePreset === preset.id ? "var(--gold-dim)" : "var(--surface)",
                      color: datePreset === preset.id ? "var(--gold)" : "var(--white-shade)",
                      fontSize: "12px", fontWeight: 500, textAlign: "left", cursor: "pointer", transition: "all 0.15s ease",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {datePreset === "custom" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "10px", color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase" }}>Start Date</label>
                      <input
                        type="date" value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="date-input"
                        style={{ width: "100%", height: "32px", padding: "0 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", fontSize: "12px", outline: "none", cursor: "pointer" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "10px", color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase" }}>End Date</label>
                      <input
                        type="date" value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="date-input"
                        style={{ width: "100%", height: "32px", padding: "0 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", fontSize: "12px", outline: "none", cursor: "pointer" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <button onClick={() => { setStartDate(""); setEndDate(""); }} style={{ flex: 1, height: "30px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "11px", cursor: "pointer", fontWeight: 500 }}>Clear</button>
                    <button onClick={() => setShowDatePicker(false)} style={{ flex: 2, height: "30px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--gold)", color: "black", fontSize: "11px", cursor: "pointer", fontWeight: 600 }}>Apply Range</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            className="btn-ghost"
            onClick={() => fetchRecords(true)}
            style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white-shade)", fontSize: "13px", fontWeight: 500, cursor: "pointer", gap: "6px", transition: "all 0.15s ease" }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            className="btn-ghost"
            onClick={handleExportCSV}
            style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white-shade)", fontSize: "13px", fontWeight: 500, cursor: "pointer", gap: "6px", transition: "all 0.15s ease" }}
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {[
          { label: "Present", count: present, color: "#4ade80", bg: "rgba(74, 222, 128, 0.03)", border: "rgba(74, 222, 128, 0.15)", icon: <CheckCircle size={16} color="#4ade80" /> },
          { label: "Late", count: late, color: "#d97706", bg: "rgba(217, 119, 6, 0.03)", border: "rgba(217, 119, 6, 0.15)", icon: <Clock size={16} color="#d97706" /> },
          { label: "Absent", count: absent, color: "#f87171", bg: "rgba(248, 113, 113, 0.03)", border: "rgba(248, 113, 113, 0.15)", icon: <AlertCircle size={16} color="#f87171" /> },
          { label: "Total Filtered", count: filtered.length, color: "#a78bfa", bg: "rgba(167, 139, 250, 0.03)", border: "rgba(167, 139, 250, 0.15)", icon: <Activity size={16} color="#a78bfa" /> },
        ].map((item) => (
          <div key={item.label} className="stat-card" style={{ display: "flex", flexDirection: "column", background: "var(--surface)", border: `1px solid ${item.border}`, borderRadius: "var(--radius)", padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{item.label}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "50%", background: `${item.color}12` }}>
                {item.icon}
              </div>
            </div>
            <div style={{ fontSize: "32px", fontWeight: 700, color: item.color, letterSpacing: "-0.02em", lineHeight: "1" }}>{item.count}</div>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div style={{ display: "flex", gap: "24px", marginBottom: "24px", alignItems: "center", borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))", paddingBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "250px", position: "relative" }}>
          <Search size={14} color="var(--muted)" style={{ position: "absolute", left: "12px" }} />
          <input
            className="search-input"
            placeholder="Search event or date..."
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
                background: "transparent", border: "none",
                borderBottom: filterStatus === f ? "2px solid var(--gold)" : "2px solid transparent",
                color: filterStatus === f ? "var(--white)" : "var(--muted)",
                padding: "0 4px 12px", fontSize: "13px",
                fontWeight: filterStatus === f ? 500 : 400,
                cursor: "pointer", transition: "all 0.15s ease", marginBottom: "-13px",
              }}
              onClick={() => setFilterStatus(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="attendance-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "14px 24px", textAlign: "left", fontSize: 11, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Subject / Event</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Date</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Clock In</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Clock Out</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="user-row" style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "14px 24px", fontWeight: 500, color: "var(--white)" }}>{r.subject}</td>
                  <td style={{ padding: "14px 20px", color: "var(--dimmed)", fontSize: "13px" }}>{r.displayDate}</td>
                  <td style={{ padding: "14px 20px", fontSize: "13px", color: r.timeIn === "—" ? "var(--dimmed)" : "var(--white-shade)" }}>{r.timeIn}</td>
                  <td style={{ padding: "14px 20px", fontSize: "13px", color: r.timeOut === "—" ? "var(--dimmed)" : "var(--white-shade)" }}>{r.timeOut}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span className={`status-badge ${r.status}`} style={{ fontSize: "11px", padding: "4px 8px" }}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "12px", color: "var(--muted)" }}>{r.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "64px 24px", textAlign: "center", color: "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 48, height: 48, border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={20} color="var(--muted)" />
              </div>
              <p style={{ fontSize: 13, margin: 0 }}>No records match the current filters.</p>
              <span style={{ fontSize: 12, color: "var(--dimmed)" }}>Try adjusting your search or filter criteria.</span>
            </div>
          )}
        </div>
      </div>

      {filtered.length > 0 && (
        <p style={{ textAlign: "right", fontSize: 12, color: "var(--dimmed)", marginTop: 8 }}>
          Showing {filtered.length} of {records.length} records
        </p>
      )}

      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .search-input:focus, .date-input:focus {
          border-color: rgba(255,255,255,0.2) !important;
        }

        .date-input {
          background-color: var(--surface) !important;
          color: var(--white) !important;
          color-scheme: dark !important;
        }
        .date-input::-webkit-calendar-picker-indicator {
          filter: invert(1); opacity: 0.5; cursor: pointer;
        }
        .date-input::-webkit-calendar-picker-indicator:hover {
          opacity: 0.8;
        }

        .btn-ghost:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.15) !important;
        }

        .stat-card {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        .date-range-btn:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.15) !important;
        }

        .user-row { transition: background 0.15s ease; }
        .user-row:hover { background: rgba(255,255,255,0.02); }
      `}</style>
    </div>
  );
}
