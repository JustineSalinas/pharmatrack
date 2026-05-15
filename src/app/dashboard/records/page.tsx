"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  Loader2, Download, CheckCircle2, Clock, AlertCircle,
  Search, SlidersHorizontal, FileText,
} from "lucide-react";

export default function StudentRecords() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function fetchRecords() {
      try {
        const u = await getCurrentUser();
        if (!u) { router.push("/login"); return; }
        const { data, error } = await supabase
          .from("attendance_records")
          .select(`id, time_in, time_out, status, remarks, events ( name, date )`)
          .eq("student_id", u.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const formatted = (data || []).map((r: any) => ({
          id: r.id,
          date: r.events?.date
            ? new Date(r.events.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "N/A",
          rawDate: r.events?.date || "",
          subject: r.events?.name || "Unknown Event",
          timeIn: r.time_in ? new Date(r.time_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—",
          timeOut: r.time_out ? new Date(r.time_out).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—",
          status: r.status,
          remarks: r.remarks || "No remarks",
        }));
        setRecords(formatted);
      } catch (err) {
        console.error("Error fetching records", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, [router]);

  const subjects = ["All", ...Array.from(new Set(records.map((r) => r.subject)))];
  const filtered = records.filter((r) => {
    const matchStatus = statusFilter === "All" || r.status === statusFilter.toLowerCase();
    const matchSubject = subjectFilter === "All" || r.subject === subjectFilter;
    const matchSearch = !search || r.subject.toLowerCase().includes(search.toLowerCase()) || r.date.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSubject && matchSearch;
  });

  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;
  const rate = records.length > 0 ? Math.round(((present + late) / records.length) * 100) : 0;

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; bg: string; border: string }> = {
    present: { color: "var(--success)", icon: <CheckCircle2 size={12} />, bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.2)" },
    late: { color: "var(--gold)", icon: <Clock size={12} />, bg: "rgba(232,184,75,0.1)", border: "rgba(232,184,75,0.2)" },
    absent: { color: "var(--danger)", icon: <AlertCircle size={12} />, bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)" },
  };

  if (loading) {
    return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;
  }

  return (
    <div className="fade-in sd-root">
      {/* ── Header ── */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Student · My Records</p>
          <h1 className="sd-header-title">Attendance Records</h1>
        </div>
        <button className="sp-export-btn">
          <Download size={14} /> Export CSV
        </button>
      </header>

      {/* ── Summary Strip ── */}
      <div className="sp-summary-row">
        {[
          { label: "Total", value: records.length, color: "var(--white)", bg: "var(--surface2)", border: "var(--border)" },
          { label: "Present", value: present, color: "var(--success)", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.15)" },
          { label: "Late", value: late, color: "var(--gold)", bg: "rgba(232,184,75,0.08)", border: "rgba(232,184,75,0.15)" },
          { label: "Absent", value: absent, color: "var(--danger)", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.15)" },
          { label: "Rate", value: `${rate}%`, color: rate >= 75 ? "var(--success)" : rate > 0 ? "var(--gold)" : "var(--danger)", bg: "rgba(255,255,255,0.03)", border: "var(--border)" },
        ].map((s) => (
          <div key={s.label} className="sp-summary-tile" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <span className="sp-summary-val" style={{ color: s.color }}>{s.value}</span>
            <span className="sp-summary-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filters Bar ── */}
      <div className="sp-filter-bar">
        <div className="sp-search-wrap">
          <Search size={13} />
          <input
            className="sp-search-input"
            placeholder="Search event or date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sp-filter-chips">
          {["All", "Present", "Late", "Absent"].map((f) => (
            <button
              key={f}
              className={`sp-chip ${statusFilter === f ? "active" : ""}`}
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="sp-filter-select-wrap">
          <SlidersHorizontal size={13} color="var(--dimmed)" />
          <select
            className="sp-filter-select"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            {subjects.map((s) => <option key={s as string} value={s as string}>{s as string}</option>)}
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="sp-table-panel">
        {filtered.length === 0 ? (
          <div className="sp-empty-state">
            <FileText size={32} color="var(--dimmed)" />
            <p>No records match the current filters.</p>
            <span>Try adjusting your search or filter criteria.</span>
          </div>
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const cfg = statusConfig[r.status] || statusConfig.absent;
                  return (
                    <tr key={r.id}>
                      <td className="sp-td-date">{r.date}</td>
                      <td className="sp-td-subject">{r.subject}</td>
                      <td className="sp-td-time" style={{ color: r.timeIn === "—" ? "var(--dimmed)" : "var(--white-shade)" }}>{r.timeIn}</td>
                      <td className="sp-td-time" style={{ color: r.timeOut === "—" ? "var(--dimmed)" : "var(--white-shade)" }}>{r.timeOut}</td>
                      <td>
                        <span
                          className="sp-status-badge"
                          style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
                        >
                          {cfg.icon}
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </td>
                      <td className="sp-td-remarks">{r.remarks}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <p className="sp-table-count">Showing {filtered.length} of {records.length} records</p>
        )}
      </div>
    </div>
  );
}
