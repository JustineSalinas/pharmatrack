"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, Download, Search, Calendar, FileSpreadsheet } from "lucide-react";

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
        <Loader2 className="animate-spin" size={24} color="var(--dimmed)" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header and Actions in a single row */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "var(--dimmed)", letterSpacing: "0.06em", marginBottom: "8px" }}>
            <span>Admin Control</span><span style={{ margin: "0 8px" }}>/</span><span>Attendance</span>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.03em", color: "var(--white)" }}>Attendance Logs</h2>
          <p style={{ color: "var(--dimmed)", fontSize: "13px", marginTop: "4px", margin: 0 }}>Master database of all recorded participation</p>
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
             style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white-shade)", fontSize: "13px", fontWeight: 500, cursor: "pointer", gap: "6px", transition: "all 0.15s ease" }}
           >
             <Download size={14} /> Export
           </button>
        </div>
      </div>

      {/* Summary Strip - Single horizontal block */}
      <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 24px", marginBottom: "32px" }}>
        {[
          { label: "Present", count: present, color: "var(--success)" },
          { label: "Late", count: late, color: "var(--gold)" },
          { label: "Absent", count: absent, color: "var(--danger)" },
          { label: "Total Filtered", count: filtered.length, color: "var(--white)" }
        ].map((item, i, arr) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
             <div style={{ flex: 1 }}>
               <div style={{ fontSize: "11px", color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{item.label}</div>
               <div style={{ fontSize: "28px", fontWeight: 700, color: item.color, letterSpacing: "-0.02em" }}>{item.count}</div>
             </div>
             {i < arr.length - 1 && <div style={{ height: "40px", width: "1px", background: "var(--border)", margin: "0 auto" }} />}
          </div>
        ))}
      </div>

      {/* Cohesive Filters Bar */}
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
          {["All", "Present", "Late", "Absent"].map(f => (
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
                marginBottom: "-13px"
              }} 
              onClick={() => setFilterStatus(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div style={{ height: "24px", width: "1px", background: "var(--border)", margin: "0 8px" }}></div>

        <select 
          className="search-input select-input" 
          style={{ width: "auto", minWidth: "140px", height: "36px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", fontSize: "13px", padding: "0 12px", outline: "none", cursor: "pointer" }} 
          value={filterSection} 
          onChange={(e) => setFilterSection(e.target.value)}
        >
          <option value="All">All Sections</option>
          {sections.map(s => <option key={s} value={s}>{s}</option>)}
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

        /* Native date picker icon styling */
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
          background: transparent;
          border: 1px solid transparent;
          color: var(--dimmed);
          cursor: pointer;
          border-radius: var(--radius-sm);
          opacity: 0;
          transition: all 0.15s ease;
          font-size: 11px;
          font-family: var(--font-sans);
          font-weight: 500;
        }
        .user-row:hover .action-btn-hover {
          opacity: 1;
          border-color: var(--border);
          background: var(--surface);
        }
        .action-btn-hover:hover {
          color: var(--white);
          background: var(--surface2) !important;
        }
      `}</style>
    </div>
  );
}
