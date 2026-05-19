"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, Download, Search, Calendar, FileSpreadsheet } from "lucide-react";

export default function FacilitatorAttendance() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchAttendance() {
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

        const { data: sectionData } = await supabase.from("student_profiles").select("section");
        const allSections = Array.from(new Set((sectionData || []).map(s => s.section).filter(Boolean))).sort() as string[];
        setAvailableSections(allSections);

        setRecords(formatted);
      } catch (err) {
        console.error("Error fetching attendance", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAttendance();
  }, [router]);

  const sections = availableSections.length > 0 
    ? availableSections 
    : Array.from(new Set(records.map(r => r.section).filter(s => s !== "N/A"))).sort();

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
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
            Facilitator
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Attendance Logs</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4, margin: 0 }}>Master database of all recorded participation</p>
        </div>
        <div className="header-actions" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
           <div style={{ position: "relative", width: "160px" }}>
              <Calendar size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--dimmed)" }} />
              <input 
                className="date-input" 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
                style={{ paddingLeft: "36px", paddingRight: "12px", height: "36px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--card, #13152a)", color: "var(--foreground, #fff)", width: "100%", fontSize: "13px", outline: "none", cursor: "pointer", transition: "border-color 0.15s ease" }}
              />
           </div>
           <button 
             className="btn-ghost" 
             style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--card, #13152a)", color: "rgba(255,255,255,0.85)", fontSize: "13px", fontWeight: 500, cursor: "pointer", gap: "6px", transition: "all 0.15s ease" }}
           >
             <Download size={14} /> Export
           </button>
        </div>
      </div>

      {/* Summary Strip - Single horizontal block */}
      <div style={{ display: "flex", alignItems: "center", background: "var(--card, #13152a)", border: "1px solid var(--border, rgba(255,255,255,0.07))", borderRadius: 12, padding: "20px 24px", marginBottom: "32px" }}>
        {[
          { label: "Present", count: present, color: "#4ade80" },
          { label: "Late", count: late, color: "var(--gold)" },
          { label: "Absent", count: absent, color: "#f87171" },
          { label: "Total Filtered", count: filtered.length, color: "var(--foreground, #fff)" }
        ].map((item, i, arr) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
             <div style={{ flex: 1 }}>
               <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{item.label}</div>
               <div style={{ fontSize: "28px", fontWeight: 700, color: item.color, letterSpacing: "-0.02em" }}>{item.count}</div>
             </div>
             {i < arr.length - 1 && <div style={{ height: "40px", width: "1px", background: "var(--border, rgba(255,255,255,0.07))", margin: "0 auto" }} />}
          </div>
        ))}
      </div>

      {/* Cohesive Filters Bar */}
      <div style={{ display: "flex", gap: "24px", marginBottom: "24px", alignItems: "center", borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))", paddingBottom: "12px", flexWrap: "wrap" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "250px", position: "relative" }}>
          <Search size={14} color="var(--muted)" style={{ position: "absolute", left: "12px" }} />
          <input 
            className="search-input" 
            placeholder="Search student name or email..." 
            style={{ border: "1px solid var(--border, rgba(255,255,255,0.07))", background: "var(--card, #13152a)", padding: "0 12px 0 36px", height: "36px", borderRadius: "var(--radius-sm)", color: "var(--foreground, #fff)", fontSize: "13px", width: "100%", outline: "none", transition: "border-color 0.15s ease" }}
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
                color: filterStatus === f ? "var(--foreground, #fff)" : "var(--muted)", 
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

        <div style={{ height: "24px", width: "1px", background: "var(--border, rgba(255,255,255,0.07))", margin: "0 8px" }}></div>

        <select 
          className="search-input select-input" 
          style={{ width: "auto", minWidth: "140px", height: "36px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border, rgba(255,255,255,0.07))", background: "var(--card, #13152a)", color: "var(--foreground, #fff)", fontSize: "13px", padding: "0 12px", outline: "none", cursor: "pointer" }} 
          value={filterSection} 
          onChange={(e) => setFilterSection(e.target.value)}
        >
          <option value="All">All Sections</option>
          {sections.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "var(--card, #13152a)", border: "1px solid var(--border, rgba(255,255,255,0.07))", borderRadius: 12, overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="attendance-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))" }}>
                <th style={{ padding: "14px 24px", textAlign: "left", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Student Name</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Subject / Event</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Section</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Date</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Clock In</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const initials = r.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "S";
                
                return (
                  <tr key={r.id} className="user-row" style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border, rgba(255,255,255,0.04))" : "none" }}>
                    <td style={{ padding: "14px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div className="avatar" style={{ width: "32px", height: "32px", fontSize: "12px", fontWeight: 600, flexShrink: 0, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--foreground, #fff)" }}>{r.name}</div>
                          <div style={{ fontSize: "13px", color: "var(--muted)" }}>{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", color: "rgba(255,255,255,0.85)", fontSize: "13px" }}>{r.subject}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span className="tag" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted)", fontSize: "11px", padding: "4px 8px", borderRadius: 4 }}>{r.section}</span>
                    </td>
                    <td style={{ padding: "14px 20px", color: "var(--muted)", fontSize: "13px" }}>{r.displayDate}</td>
                    <td style={{ padding: "14px 20px", fontSize: "13px", color: r.timeIn === "—" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)" }}>{r.timeIn}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span className={`badge badge-${r.status}`} style={{ fontSize: "11px" }}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "64px 24px", textAlign: "center", color: "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 48, height: 48, border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Search size={20} color="var(--muted)" />
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
          border-color: rgba(255,255,255,0.2) !important;
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
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.15) !important;
        }

        .user-row {
          transition: background 0.15s ease;
        }
        .user-row:hover {
          background: rgba(255,255,255,0.02);
        }
      `}</style>
    </div>
  );
}
