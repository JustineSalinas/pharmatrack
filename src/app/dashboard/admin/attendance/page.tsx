"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, Download, Filter, Search, Calendar, CheckCircle, AlertTriangle, XCircle, FileSpreadsheet } from "lucide-react";

export default function AdminAttendance() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [selectedDate, setSelectedDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
            session_id,
            qr_sessions ( subject, date, section ),
            users ( full_name, email )
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map(r => {
          const uData = r.users as any;
          const session = r.qr_sessions as any;
          
          return {
            id: r.id,
            name: uData?.full_name || "Unknown Student",
            email: uData?.email || "",
            subject: session?.subject || "General Event",
            section: session?.section || "N/A",
            date: session?.date || "",
            displayDate: session?.date ? new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
            timeIn: r.time_in ? new Date(r.time_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—",
            status: r.status,
            rawDate: session?.date
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

  const sections = Array.from(new Set(records.map(r => r.section).filter(s => s !== "N/A"))).sort();

  const filtered = records.filter(r => {
    const sMatch = filterStatus === "All" || r.status.toLowerCase() === filterStatus.toLowerCase();
    const secMatch = filterSection === "All" || r.section === filterSection;
    const dateMatch = !selectedDate || r.rawDate === selectedDate;
    const searchMatch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.email.toLowerCase().includes(searchQuery.toLowerCase());
    return sMatch && secMatch && dateMatch && searchMatch;
  });

  const present = filtered.filter(r => r.status === "present").length;
  const late = filtered.filter(r => r.status === "late").length;
  const absent = filtered.filter(r => r.status === "absent").length;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 className="animate-spin" size={48} color="var(--gold)" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: "32px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "0.85rem", color: "var(--muted)", letterSpacing: "0.5px", marginBottom: "4px" }}>
            <span>Admin Control</span><span style={{ margin: "0 6px" }}>·</span><span>Attendance</span>
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>Attendance Logs</h2>
          <p style={{ color: "var(--muted)", marginTop: "4px" }}>Master database of all recorded participation</p>
        </div>
        <div className="header-actions">
           <div style={{ position: "relative", width: "180px" }}>
              <Calendar size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input 
                className="inp" 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
                style={{ paddingLeft: "36px", height: "44px", borderRadius: "12px", fontSize: "0.85rem" }}
              />
           </div>
           <button className="btn btn-gold" style={{ width: "auto", padding: "0 20px", height: "44px", borderRadius: "12px", gap: "8px" }}>
             <FileSpreadsheet size={18} /> Export CSV
           </button>
        </div>
      </div>

      {/* Summary Chips */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "32px", overflowX: "auto", paddingBottom: "10px" }}>
        {[
          { label: "Present", count: present, color: "var(--success)", icon: <CheckCircle size={16} /> },
          { label: "Late", count: late, color: "var(--gold)", icon: <AlertTriangle size={16} /> },
          { label: "Absent", count: absent, color: "var(--danger)", icon: <XCircle size={16} /> },
          { label: "Total Filtered", count: filtered.length, color: "var(--white)", icon: <Filter size={16} /> }
        ].map(item => (
          <div key={item.label} style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.05)", padding: "12px 20px", borderRadius: "16px", display: "flex", alignItems: "center", gap: "12px", minWidth: "160px" }}>
             <div style={{ color: item.color }}>{item.icon}</div>
             <div>
               <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{item.label}</div>
               <div style={{ fontSize: "1.2rem", fontWeight: 800, color: item.color }}>{item.count}</div>
             </div>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="panel" style={{ padding: "16px 24px", marginBottom: "24px", display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap", borderRadius: "16px" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "250px" }}>
          <Search size={18} color="var(--muted)" />
          <input 
            className="inp" 
            placeholder="Search student name or email..." 
            style={{ border: "none", background: "transparent", padding: "8px 0" }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ height: "24px", width: "1px", background: "rgba(255,255,255,0.1)" }}></div>

        <div style={{ display: "flex", gap: "8px" }}>
          {["All", "Present", "Late", "Absent"].map(f => (
            <button key={f} className={`btn ${filterStatus === f ? "btn-gold" : "btn-ghost"}`} style={{ height: "34px", padding: "0 12px", fontSize: "0.8rem", width: "auto" }} onClick={() => setFilterStatus(f)}>
              {f}
            </button>
          ))}
        </div>

        <div style={{ height: "24px", width: "1px", background: "rgba(255,255,255,0.1)" }}></div>

        <select className="inp" style={{ width: "auto", minWidth: "140px", height: "34px", borderRadius: "8px", fontSize: "0.8rem", padding: "0 10px" }} value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
          <option value="All">All Sections</option>
          {sections.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="attendance-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: "30px" }}>Student Name</th>
                <th>Subject / Event</th>
                <th>Section</th>
                <th>Date</th>
                <th>Clock In</th>
                <th>Status</th>
                <th style={{ textAlign: "right", paddingRight: "30px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const initials = r.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "S";
                
                return (
                  <tr key={r.id}>
                    <td style={{ paddingLeft: "30px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div className="avatar" style={{ width: "32px", height: "32px", fontSize: "12px", background: "var(--surface2)", border: "1px solid var(--gold-dim)" }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--white)" }}>{r.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "var(--white)", opacity: 0.9 }}>{r.subject}</td>
                    <td>
                      <span className="tag" style={{ background: "rgba(255,255,255,0.03)" }}>{r.section}</span>
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{r.displayDate}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.9rem", color: r.timeIn === "—" ? "var(--muted)" : "var(--white)" }}>{r.timeIn}</td>
                    <td>
                      <span className={`status-badge ${r.status}`} style={{ fontSize: "0.7rem", padding: "4px 10px" }}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", paddingRight: "30px" }}>
                      <button className="btn btn-outline" style={{ height: "30px", padding: "0 10px", width: "auto", fontSize: "0.75rem" }}>Review</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "80px", textAlign: "center", color: "var(--muted)" }}>
              <Filter size={48} style={{ opacity: 0.1, marginBottom: "16px" }} />
              <p>No records found matching your current search or filters.</p>
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
