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
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Admin</span><span>›</span><span>Attendance Logs</span></div>
          <h2>Attendance Logs</h2>
          <p>Complete attendance record database across all events</p>
        </div>
        <div className="header-actions">
          <input 
            className="input-field" 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            style={{ width: 170, padding: "9px 14px", fontSize: 13, background: "var(--surface2)" }} 
          />
          <button className="btn btn-gold" style={{ display: "flex", alignItems: "center", gap: "8px", width: "auto", padding: "9px 18px", fontSize: 13 }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          ["✅ Present", present, "var(--success)"],
          ["⏰ Late", late, "var(--gold)"],
          ["❌ Absent", absent, "var(--danger)"],
          ["📋 Total", filtered.length, "var(--white)"]
        ].map(([l, v, c]) => (
          <div key={l as string} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 20px", display: "flex", gap: 12, alignItems: "center", minWidth: "140px" }}>
            <span style={{ color: c as string, fontFamily: "Syne, sans-serif", fontSize: 24, fontWeight: 800 }}>{v}</span>
            <span style={{ fontSize: 13, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{l as string}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "10px", color: "var(--muted)", fontSize: "0.85rem" }}>
          <Filter size={14} /> Filter:
        </div>
        {["All", "Present", "Late", "Absent"].map((f) => (
          <button key={f} className={`btn ${filterStatus === f ? "btn-gold" : "btn-outline"}`} style={{ width: "auto", padding: "6px 16px", fontSize: 12 }} onClick={() => setFilterStatus(f)}>
            {f}
          </button>
        ))}
        <div style={{ width: 1, height: "24px", background: "var(--border)", margin: "0 8px" }} />
        <div className="input-wrap select-wrap" style={{ width: 150, margin: 0 }}>
          <select className="inp" style={{ padding: "6px 32px 6px 12px", fontSize: 12 }} value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
            <option value="All">All Sections</option>
            {sections.map((s) => <option key={s as string} value={s as string}>{s as string}</option>)}
          </select>
        </div>
        
        {(filterStatus !== "All" || filterSection !== "All" || selectedDate) && (
          <button 
            className="btn btn-ghost" 
            style={{ width: "auto", padding: "6px 12px", fontSize: 12, marginLeft: "auto", color: "var(--danger)" }} 
            onClick={() => { setFilterStatus("All"); setFilterSection("All"); setSelectedDate(""); }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
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
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ color: "var(--muted)", fontSize: 11, fontFamily: "monospace" }}>{r.id.substring(0, 8)}...</td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ fontSize: 13, color: "var(--muted)" }}>{r.subject}</td>
                  <td><span className="tag" style={{ background: "rgba(255,255,255,0.05)" }}>{r.section}</span></td>
                  <td style={{ fontSize: 13 }}>{r.displayDate}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 13, color: r.timeIn === "—" ? "var(--muted)" : "var(--white)" }}>{r.timeIn}</td>
                  <td><span className={`badge badge-${r.status}`}>{r.status.toUpperCase()}</span></td>
                  <td>
                    <button className="btn btn-ghost" style={{ width: "auto", padding: "4px 10px", fontSize: 11 }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 14 }}>
            {records.length === 0 ? "No attendance records found in the database." : "No records match the current filters."}
          </div>
        )}
      </div>
      
      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
