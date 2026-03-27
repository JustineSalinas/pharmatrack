"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, Download, Filter } from "lucide-react";

export default function AdminAttendance() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    async function fetchAttendance() {
      try {
        const u = await getCurrentUser();
        if (!u || u.account_type === "student") {
          router.push("/dashboard");
          return;
        }

        const { data, error } = await supabase
          .from("attendance_records")
          .select(`
            id,
            time_in,
            status,
            events ( name, date ),
            users ( full_name, student_profiles ( section ) )
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map(r => {
          const uData = r.users as any;
          const spData = uData?.student_profiles?.[0];
          
          return {
            id: r.id,
            name: uData?.full_name || "Unknown Student",
            subject: r.events?.name || "Unknown Event",
            section: spData?.section || "N/A",
            date: r.events?.date || "",
            displayDate: r.events?.date ? new Date(r.events.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
            timeIn: r.time_in ? new Date(r.time_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—",
            status: r.status,
            rawDate: r.events?.date
          };
        });

        setRecords(formatted);
      } catch (err) {
        console.error("Error fetching admin attendance", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAttendance();
  }, [router]);

  // Extract unique sections for filter dropdown
  const sections = Array.from(new Set(records.map(r => r.section).filter(s => s !== "N/A"))).sort();

  const filtered = records.filter(r => {
    const s = filterStatus === "All" || r.status === filterStatus.toLowerCase();
    const sec = filterSection === "All" || r.section === filterSection;
    const d = !selectedDate || r.rawDate === selectedDate;
    return s && sec && d;
  });

  const present = filtered.filter(r => r.status === "present").length;
  const late = filtered.filter(r => r.status === "late").length;
  const absent = filtered.filter(r => r.status === "absent").length;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Loader2 className="animate-spin" size={48} color="var(--gold)" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "0.85rem", color: "var(--muted)", letterSpacing: "0.5px", marginBottom: "4px" }}>
            <span>Admin</span><span style={{ margin: "0 6px" }}>·</span><span>Attendance Logs</span>
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>Attendance Logs</h2>
          <p style={{ color: "var(--muted)", margin: "8px 0 0 0", fontSize: "0.95rem" }}>Complete attendance record database across all events</p>
        </div>
        <div className="header-actions">
          <input 
            className="input-field" 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            style={{ width: 170, padding: "9px 14px", fontSize: 13, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "var(--white)", marginRight: "8px" }} 
          />
          <button className="filter-btn" style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 500, padding: "9px 18px" }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap", width: "100%" }}>
        {[
          { label: "✅ Present", value: present, colorClass: "val-green" },
          { label: "⏰ Late", value: late, colorClass: "val-orange" },
          { label: "❌ Absent", value: absent, colorClass: "val-red" },
          { label: "📋 Total", value: filtered.length, colorClass: "val-blue" }
        ].map((s) => (
          <div className="stat-card-custom" key={s.label} style={{ flex: 1, minWidth: "140px", maxWidth: "200px" }}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-val ${s.colorClass}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "10px", color: "var(--muted)", fontSize: "0.85rem" }}>
          <Filter size={14} /> Filter:
        </div>
        {["All", "Present", "Late", "Absent"].map((f) => (
          <button key={f} className={`filter-btn ${filterStatus === f ? "active" : ""}`} onClick={() => setFilterStatus(f)}>
            {f}
          </button>
        ))}
        
        <div style={{ width: 1, height: "24px", background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
        
        <select className="filter-dropdown" style={{ marginLeft: "8px" }} value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
          <option value="All">All Sections</option>
          {sections.map((s) => <option key={s as string} value={s as string}>{s as string}</option>)}
        </select>
        
        {(filterStatus !== "All" || filterSection !== "All" || selectedDate) && (
          <button 
            className="filter-btn" 
            style={{ marginLeft: "auto", background: "transparent", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }} 
            onClick={() => { setFilterStatus("All"); setFilterSection("All"); setSelectedDate(""); }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="attendance-table">
          <thead>
            <tr>
              <th style={{ width: "50px" }}>ID</th>
              <th>Student Name</th>
              <th>Event Name</th>
              <th>Section</th>
              <th>Event Date</th>
              <th>Time In</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const dotClass = r.status === "present" ? "dot-green" : r.status === "late" ? "dot-orange" : "dot-red";
              const pillClass = r.status === "present" ? "pill-present" : r.status === "late" ? "pill-late" : "pill-absent";
              
              const CheckIcon = () => (
                <svg className="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              );
              const AlertIcon = () => (
                <svg className="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              );
              const XIcon = () => (
                <svg className="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              );
              const PillIcon = r.status === "present" ? <CheckIcon /> : r.status === "late" ? <AlertIcon /> : <XIcon />;

              return (
                <tr key={r.id}>
                  <td style={{ color: "var(--muted)", fontSize: "0.85rem", fontFamily: "monospace" }}>
                    <span className={`cell-dot ${dotClass}`}></span>
                    {r.id.substring(0, 8)}...
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--white)" }}>{r.name}</td>
                  <td style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.8)" }}>{r.subject}</td>
                  <td>
                    <span style={{ background: "rgba(255,255,255,0.1)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.8rem", color: "var(--gold)" }}>
                      {r.section}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.9rem" }}>{r.displayDate}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.9rem", color: r.timeIn === "—" ? "rgba(255,255,255,0.4)" : "var(--white)" }}>{r.timeIn}</td>
                  <td>
                    <span className={`status-pill ${pillClass}`}>
                      {PillIcon} {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <button className="filter-btn" style={{ padding: "4px 12px", fontSize: "0.75rem", background: "transparent", borderColor: "rgba(255,255,255,0.2)" }}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 14 }}>
          {records.length === 0 ? "No attendance records found in the database." : "No records match the current filters."}
        </div>
      )}
      
      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
