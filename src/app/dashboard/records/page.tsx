"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, Download } from "lucide-react";

export default function StudentRecords() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");

  useEffect(() => {
    async function fetchRecords() {
      try {
        const u = await getCurrentUser();
        if (!u) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("attendance_records")
          .select(`
            id,
            time_in,
            time_out,
            status,
            remarks,
            events ( name, date )
          `)
          .eq("student_id", u.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        // Map data to the format we need
        const formatted = (data || []).map(r => ({
          id: r.id,
          date: new Date(r.events?.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          subject: r.events?.name || "Unknown Event",
          timeIn: r.time_in ? new Date(r.time_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—",
          timeOut: r.time_out ? new Date(r.time_out).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—",
          status: r.status,
          remarks: r.remarks || "No remarks"
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

  const subjects = ["All", ...Array.from(new Set(records.map(r => r.subject)))];
  
  const filtered = records.filter(r => {
    const s = statusFilter === "All" || r.status === statusFilter.toLowerCase();
    const sub = subjectFilter === "All" || r.subject === subjectFilter;
    return s && sub;
  });

  const present = records.filter(r => r.status === "present").length;
  const absent = records.filter(r => r.status === "absent").length;
  const late = records.filter(r => r.status === "late").length;
  const rate = records.length > 0 ? Math.round(((present + late) / records.length) * 100) : 0;

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
            <span>Student</span><span style={{ margin: "0 6px" }}>·</span><span>My Records</span>
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>Attendance Records</h2>
        </div>
        <div className="header-actions">
          <button className="filter-btn" style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap", width: "100%" }}>
        {[
          { label: "Total Events", value: records.length, colorClass: "val-blue" },
          { label: "Present", value: present, colorClass: "val-green" },
          { label: "Absent", value: absent, colorClass: "val-red" },
          { label: "Late", value: late, colorClass: "val-orange" },
          { label: "Rate", value: `${rate}%`, colorClass: rate >= 85 ? "val-green" : rate > 0 ? "val-orange" : "val-red" },
        ].map((s) => (
          <div className="stat-card-custom" key={s.label} style={{ flex: 1, minWidth: "120px", maxWidth: "160px" }}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-val ${s.colorClass}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap", alignItems: "center" }}>
        <button className={`filter-btn ${statusFilter === "All" ? "active" : ""}`} onClick={() => setStatusFilter("All")}>All</button>
        <button className={`filter-btn ${statusFilter === "Present" ? "active" : ""}`} onClick={() => setStatusFilter("Present")}>Present</button>
        <button className={`filter-btn ${statusFilter === "Late" ? "active" : ""}`} onClick={() => setStatusFilter("Late")}>Late</button>
        <button className={`filter-btn ${statusFilter === "Absent" ? "active" : ""}`} onClick={() => setStatusFilter("Absent")}>Absent</button>
        
        <select className="filter-dropdown" style={{ marginLeft: "16px" }} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          {subjects.map((s) => <option key={s as string} value={s as string}>{s as string}</option>)}
        </select>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="attendance-table">
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
            {filtered.map((r, i) => {
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
              
              const remarkIconClass = r.status === "present" ? "success" : r.status === "late" ? "warning" : "danger";
              const RemarkIconSVG = r.status === "present" ? (
                <svg className={`remark-icon ${remarkIconClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ) : r.status === "late" ? (
                <svg className={`remark-icon ${remarkIconClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              ) : (
                <svg className={`remark-icon ${remarkIconClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              );

              return (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className={`cell-dot ${dotClass}`}></span>
                    {r.date}
                  </td>
                  <td style={{ fontWeight: 500, color: "var(--white)" }}>
                    {r.subject} {i % 4 === 0 ? "📖" : i % 4 === 1 ? "🧮" : i % 4 === 2 ? "⚛️" : "🎨"}
                  </td>
                  <td style={{ fontSize: "0.9rem", color: r.timeIn === "—" ? "rgba(255,255,255,0.4)" : "var(--white)" }}>{r.timeIn}</td>
                  <td style={{ fontSize: "0.9rem", color: r.timeOut === "—" ? "rgba(255,255,255,0.4)" : "var(--white)" }}>{r.timeOut}</td>
                  <td>
                    <span className={`status-pill ${pillClass}`}>
                      {PillIcon} {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: "16px" }}>
                      <span>{r.remarks}</span>
                      {RemarkIconSVG}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
