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
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Student</span><span>›</span><span>My Records</span></div>
          <h2>Attendance Records</h2>
          <p>Your complete attendance history this semester</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: "8px", width: "auto", padding: "9px 18px", fontSize: 13 }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          { label: "Total Events", value: records.length, color: undefined },
          { label: "Present", value: present, color: "var(--success)" },
          { label: "Absent", value: absent, color: "var(--danger)" },
          { label: "Late", value: late, color: "var(--gold)" },
          { label: "Rate", value: `${rate}%`, color: rate >= 85 ? "var(--success)" : rate > 0 ? "var(--gold)" : "var(--danger)" },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {["All", "Present", "Late", "Absent"].map((f) => (
          <button key={f} className={`btn ${statusFilter === f ? "btn-gold" : "btn-outline"}`} style={{ width: "auto", padding: "6px 16px", fontSize: 12 }} onClick={() => setStatusFilter(f)}>
            {f}
          </button>
        ))}
        <div style={{ width: 1, height: "24px", background: "var(--border)", margin: "0 8px" }} />
        <div className="input-wrap select-wrap" style={{ width: 250, margin: 0 }}>
          <select className="inp" style={{ padding: "7px 32px 7px 12px", fontSize: 13 }} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            {subjects.map((s) => <option key={s as string} value={s as string}>{s as string}</option>)}
          </select>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Event</th><th>Time In</th><th>Time Out</th><th>Status</th><th>Remarks</th></tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{r.date}</td>
                  <td style={{ fontWeight: 500 }}>{r.subject}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 13, color: r.timeIn === "—" ? "var(--muted)" : "var(--white)" }}>{r.timeIn}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 13, color: r.timeOut === "—" ? "var(--muted)" : "var(--white)" }}>{r.timeOut}</td>
                  <td><span className={`badge badge-${r.status}`}>{r.status.toUpperCase()}</span></td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 14 }}>
            {records.length === 0 ? "You have no attendance records yet." : "No records found for the selected filters."}
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
