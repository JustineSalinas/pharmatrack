"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, Users, CheckCircle, XCircle, Clock, ChevronRight, X,
  TrendingUp, AlertTriangle, FileText, Loader2, Calendar, MapPin,
  AlertCircle
} from "lucide-react";

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const statusColors: Record<string, { color: string; bg: string; border: string; label: string }> = {
  present: { color: "#16a34a", bg: "rgba(22,163,74,0.08)",  border: "rgba(22,163,74,0.15)",  label: "Present" },
  absent:  { color: "#dc2626", bg: "rgba(220,38,38,0.08)",  border: "rgba(220,38,38,0.15)",  label: "Absent"  },
  late:    { color: "#d97706", bg: "rgba(217,119,6,0.08)",  border: "rgba(217,119,6,0.15)",  label: "Late"    },
  incomplete: { color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.15)", label: "Incomplete" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusColors[status] ?? statusColors.present;
  return (
    <span style={{
      padding: "3px 9px",
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      borderRadius: 5,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>
      {cfg.label.toUpperCase()}
    </span>
  );
}

function getRateColor(rate: number) {
  if (rate >= 85) return { color: "#16a34a", bg: "rgba(22,163,74,0.08)",  border: "rgba(22,163,74,0.15)"  };
  if (rate >= 75) return { color: "#d97706", bg: "rgba(217,119,6,0.08)",  border: "rgba(217,119,6,0.15)"  };
  return           { color: "#dc2626", bg: "rgba(220,38,38,0.08)",  border: "rgba(220,38,38,0.15)"  };
}

const SECTIONS_BY_YEAR: Record<string, string[]> = {
  "1st Year": ["PH 1A", "PH 1B", "PH 1C", "PH 1D", "PH 1E"],
  "2nd Year": ["PH 2A", "PH 2B", "PH 2C", "PH 2D", "PH 2E"],
  "3rd Year": ["PH 3A", "PH 3B", "PH 3C", "PH 3D"],
  "4th Year": ["PH 4A", "PH 4B", "PH 4C", "PH 4D"],
};

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [selected, setSelected] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<"name" | "section" | "id" | "rate" | "year">("name");
  const [sortAsc, setSortAsc] = useState(true);

  // Detail panel state
  const [detailStudent, setDetailStudent] = useState<any>(null);
  const [detailRecords, setDetailRecords] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Today's range for status calculation
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

  useEffect(() => {
    async function fetchStudents() {
      try {
        setLoading(true);

        // 1. Fetch full student summary (attendance rates, counts, etc.)
        const { data: summary, error: sErr } = await supabase
          .from("student_attendance_summary")
          .select("*");
        if (sErr) throw sErr;

        // 2. Fetch today's attendance records for "Today" status column
        const { data: todayRecs, error: tErr } = await supabase
          .from("attendance_records")
          .select("student_id, status")
          .gte("created_at", todayStart.toISOString())
          .lte("created_at", todayEnd.toISOString());
        if (tErr) throw tErr;

        // Map student_id → latest status today
        const todayStatusMap: Record<string, string> = {};
        (todayRecs || []).forEach((r: any) => {
          todayStatusMap[r.student_id] = r.status;
        });

        const parsed = (summary || []).map((s: any) => ({
          userId:       s.student_id,
          id:           s.student_id_number || "N/A",
          name:         s.full_name || "Unknown",
          section:      s.section   || "N/A",
          year:         s.current_year || "N/A",
          rate:         Number(s.attendance_rate) || 0,
          totalRecords: s.total_records    || 0,
          presentCount: s.present_count   || 0,
          lateCount:    s.late_count      || 0,
          absentCount:  s.absent_count    || 0,
          todayStatus:  todayStatusMap[s.student_id] || null,
        }));

        setStudents(parsed);

        const uniqueSections = Array.from(new Set(parsed.map(s => s.section))).filter(Boolean).sort() as string[];
        setSections(uniqueSections);

      } catch (err) {
        console.error("Error loading students:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, []);

  // Fetch individual student's recent attendance records when they click View
  async function loadStudentDetail(student: any) {
    setDetailStudent(student);
    setDetailRecords([]);
    setDetailLoading(true);
    setSelected(student.userId);

    try {
      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          id,
          status,
          time_in,
          created_at,
          events ( name, date, location )
        `)
        .eq("student_id", student.userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setDetailRecords(data || []);
    } catch (err) {
      console.error("Error loading student detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  // 1. Get unique sections from students in the database
  const dynamicSections = Array.from(
    new Set(students.map(s => s.section))
  ).filter(Boolean).sort() as string[];

  // 2. Determine static fallback sections (all years)
  const staticFallback = Object.values(SECTIONS_BY_YEAR).flat();

  // 3. Combine them
  const availableSectionsList = Array.from(new Set([...dynamicSections, ...staticFallback])).sort();

  const filtered = students.filter(s =>
    (sectionFilter === "All" || s.section === sectionFilter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => {
    let comparison = 0;
    if (sortField === "name") comparison = a.name.localeCompare(b.name);
    else if (sortField === "section") comparison = a.section.localeCompare(b.section);
    else if (sortField === "id") comparison = a.id.localeCompare(b.id);
    else if (sortField === "rate") comparison = a.rate - b.rate;
    else if (sortField === "year") comparison = String(a.year).localeCompare(String(b.year));
    return sortAsc ? comparison : -comparison;
  });

  const handleSort = (field: "name" | "section" | "id" | "rate" | "year") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return <span style={{ marginLeft: 4 }}>{sortAsc ? "↑" : "↓"}</span>;
  };

  const presentToday = students.filter(s => s.todayStatus === "present").length;
  const absentToday  = students.filter(s => s.todayStatus === "absent").length;
  const lateToday    = students.filter(s => s.todayStatus === "late").length;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "70vh" }}>
        <Loader2 size={24} color="#4f46e5" className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="fade-in students-page">
      {/* PAGE HEADER */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Facilitator › Students</p>
          <h1 className="sd-header-title">Student Management</h1>
          <p className="sd-header-sub">{students.length} students enrolled · Real-time attendance data</p>
        </div>
      </header>

      {/* TODAY SUMMARY STRIP */}
      <div 
        className="summary-cards-grid" 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "16px", 
          marginBottom: "32px" 
        }}
      >
        {[
          { label: "Present Today", count: presentToday, color: "#4ade80", bg: "rgba(74, 222, 128, 0.03)", border: "rgba(74, 222, 128, 0.15)", icon: <CheckCircle size={16} color="#4ade80" /> },
          { label: "Late Today", count: lateToday, color: "#d97706", bg: "rgba(217, 119, 6, 0.03)", border: "rgba(217, 119, 6, 0.15)", icon: <Clock size={16} color="#d97706" /> },
          { label: "Absent Today", count: absentToday, color: "#f87171", bg: "rgba(248, 113, 113, 0.03)", border: "rgba(248, 113, 113, 0.15)", icon: <AlertCircle size={16} color="#f87171" /> },
          { label: "Total Students", count: students.length, color: "#a78bfa", bg: "rgba(167, 139, 250, 0.03)", border: "rgba(167, 139, 250, 0.15)", icon: <Users size={16} color="#a78bfa" /> }
        ].map((item) => (
          <div 
            key={item.label} 
            className="stat-card"
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              background: item.bg, 
              border: `1px solid ${item.border}`, 
              borderRadius: "var(--radius)", 
              padding: "18px 20px", 
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
          >
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

      {/* SEARCH & FILTER */}
      <div className="filter-bar">
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name or student ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <select
          value={sectionFilter}
          onChange={e => setSectionFilter(e.target.value)}
          className="filter-select"
        >
          <option value="All">All Sections</option>
          {availableSectionsList.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* MAIN GRID: TABLE + DETAIL PANEL */}
      <div className="students-grid" style={{ gridTemplateColumns: selected ? "1.3fr 1fr" : "1fr" }}>

        {/* STUDENTS TABLE CARD */}
        <div className="students-card">
          <div className="card-header">
            <div className="card-header-left">
              <Users size={15} color="#4f46e5" />
              <span>All Students</span>
            </div>
            <span className="result-count">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="table-wrap">
            <table className="students-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "20px", cursor: "pointer" }} onClick={() => handleSort("name")}>Student{renderSortIcon("name")}</th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("id")}>Student ID{renderSortIcon("id")}</th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("section")}>Section{renderSortIcon("section")}</th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("year")}>Year{renderSortIcon("year")}</th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("rate")}>Overall Rate{renderSortIcon("rate")}</th>
                  <th>Today</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const rc = getRateColor(s.rate);
                  const isSelected = selected === s.userId;
                  return (
                    <tr
                      key={s.userId}
                      onClick={() => {
                        if (isSelected) {
                          setSelected(null);
                          setDetailStudent(null);
                        } else {
                          loadStudentDetail(s);
                        }
                      }}
                      className={`student-row ${isSelected ? "selected" : ""}`}
                    >
                      <td style={{ paddingLeft: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="student-avatar">
                            {initials(s.name)}
                          </div>
                          <span style={{ fontWeight: 600, color: "#111827" }}>{s.name}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 12, color: "#4b5563" }}>{s.id}</td>
                      <td>
                        <span className="section-badge">{s.section}</span>
                      </td>
                      <td style={{ color: "#6b7280", fontSize: 12.5 }}>{s.year}</td>
                      <td>
                        <span className="rate-capsule" style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                          {s.rate}%
                        </span>
                      </td>
                      <td>
                        {s.todayStatus ? (
                          <StatusBadge status={s.todayStatus} />
                        ) : (
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>—</span>
                        )}
                      </td>
                      <td>
                        <button className={`view-btn ${isSelected ? "active" : ""}`}>
                          {isSelected ? <><X size={11} /> Close</> : <>View <ChevronRight size={11} /></>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px 20px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                      No students match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* STUDENT DETAIL PANEL */}
        {detailStudent && (
          <div className="detail-col">

            {/* Profile Card */}
            <div className="detail-card">
              <div className="detail-profile-header">
                <div className="detail-avatar">{initials(detailStudent.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="detail-name">{detailStudent.name}</div>
                  <div className="detail-id">{detailStudent.id}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <span className="detail-tag">{detailStudent.section}</span>
                    <span className="detail-tag">{detailStudent.year} Year</span>
                  </div>
                </div>
                {detailStudent.todayStatus && <StatusBadge status={detailStudent.todayStatus} />}
              </div>

              {/* Attendance Counts */}
              <div className="counts-grid">
                <div className="count-box" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.12)" }}>
                  <div className="count-val" style={{ color: "#16a34a" }}>{detailStudent.presentCount}</div>
                  <div className="count-lbl">Present</div>
                </div>
                <div className="count-box" style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.12)" }}>
                  <div className="count-val" style={{ color: "#d97706" }}>{detailStudent.lateCount}</div>
                  <div className="count-lbl">Late</div>
                </div>
                <div className="count-box" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.12)" }}>
                  <div className="count-val" style={{ color: "#dc2626" }}>{detailStudent.absentCount}</div>
                  <div className="count-lbl">Absent</div>
                </div>
              </div>

              {/* Attendance Rate Progress Bar */}
              <div>
                <div className="rate-row">
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7280" }}>
                    <TrendingUp size={13} /> Attendance Rate
                  </span>
                  <strong style={{ color: getRateColor(detailStudent.rate).color, fontSize: 13 }}>
                    {detailStudent.rate}%
                  </strong>
                </div>
                <div className="rate-bar-bg">
                  <div
                    className="rate-bar-fill"
                    style={{
                      width: `${detailStudent.rate}%`,
                      background: getRateColor(detailStudent.rate).color,
                    }}
                  />
                </div>
                {detailStudent.rate < 75 && (
                  <div className="risk-alert">
                    <AlertTriangle size={13} />
                    At-risk: Below 75% attendance threshold
                  </div>
                )}
              </div>
            </div>

            {/* Recent Attendance Records */}
            <div className="detail-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="detail-records-header">
                <FileText size={14} color="#4f46e5" />
                <span>Recent Attendance Records</span>
              </div>

              {detailLoading ? (
                <div style={{ padding: "28px", display: "flex", justifyContent: "center" }}>
                  <Loader2 size={20} color="#4f46e5" className="animate-spin" />
                </div>
              ) : detailRecords.length === 0 ? (
                <div style={{ padding: "28px 20px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                  No attendance records found for this student.
                </div>
              ) : (
                <div>
                  {detailRecords.map((r: any, idx: number) => {
                    const evt = r.events;
                    const date = evt?.date
                      ? new Date(evt.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    return (
                      <div key={r.id} className="record-row" style={{ borderBottom: idx < detailRecords.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="record-event-name">{evt?.name || "Event"}</div>
                          <div className="record-meta">
                            <Calendar size={10} />
                            <span>{date}</span>
                            {evt?.location && (
                              <>
                                <span>·</span>
                                <MapPin size={10} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                                  {evt.location}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* SCOPED STYLES */}
      <style>{`
        .students-page { width: 100%; }

        /* Header */
        .students-page .sd-header {
          margin-bottom: 24px;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }
        .students-page .sd-header-eyebrow {
          font-size: 11px; font-weight: 600; color: #6b7280 !important;
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;
        }
        .students-page .sd-header-title {
          font-size: 22px; font-weight: 700; color: #111827 !important;
          letter-spacing: -0.03em; line-height: 1.2; margin-bottom: 4px;
        }
        .students-page .sd-header-sub {
          font-size: 13px; color: #4b5563 !important; margin: 0;
        }

        /* Summary strip */
        .stat-card {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        /* Filter bar */
        .students-page .filter-bar {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 16px; flex-wrap: wrap;
        }
        .students-page .search-wrap {
          position: relative; flex: 0 0 260px;
        }
        .students-page .search-icon {
          position: absolute; left: 12px; top: 50%;
          transform: translateY(-50%); color: #6b7280; pointer-events: none;
        }
        .students-page .search-input {
          width: 100%; padding: 9px 14px 9px 34px;
          background: #ffffff; border: 1px solid #d1d5db;
          border-radius: 7px; color: #111827; font-size: 13px; outline: none;
          box-sizing: border-box;
        }
        .students-page .search-input:focus { border-color: #4f46e5; }
        .students-page .section-filters { display: flex; gap: 6px; flex-wrap: wrap; }
        .students-page .filter-chip {
          padding: 7px 14px; border-radius: 7px; font-size: 12px; font-weight: 600;
          cursor: pointer; border: 1px solid #d1d5db; background: #ffffff;
          color: #374151; transition: all 0.15s ease;
        }
        .students-page .filter-chip:hover { border-color: #4f46e5; color: #4f46e5; }
        .students-page .filter-chip.active {
          background: #4f46e5 !important; border-color: #4f46e5 !important;
          color: #ffffff !important;
        }
        .students-page .filter-select {
          padding: 9px 32px 9px 14px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
          outline: none;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .students-page .filter-select option {
          color: #374151 !important;
          background-color: #ffffff !important;
        }
        .students-page .filter-select:hover {
          border-color: #4f46e5 !important;
          color: #4f46e5 !important;
        }
        .students-page .filter-select:focus {
          border-color: #4f46e5 !important;
        }

        /* Grid */
        .students-page .students-grid {
          display: grid; gap: 16px; align-items: start;
        }

        /* Students card */
        .students-page .students-card {
          background: #ffffff !important;
          border: 1px solid rgba(79,70,229,0.10) !important;
          border-radius: 10px !important; overflow: hidden;
        }
        .students-page .card-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          background: rgba(79,70,229,0.03);
        }
        .students-page .card-header-left {
          display: flex; align-items: center; gap: 8px;
          font-size: 13.5px; font-weight: 600; color: #111827 !important;
        }
        .students-page .result-count {
          font-size: 12px; color: #6b7280 !important;
        }
        .students-page .table-wrap { overflow-x: auto; }
        .students-page .students-table {
          width: 100%; border-collapse: collapse; font-size: 13px;
        }
        .students-page .students-table th {
          padding: 10px 14px; text-align: left;
          font-size: 10.5px; color: #6b7280 !important;
          text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;
          background: #f9fafb; border-bottom: 1.5px solid rgba(0,0,0,0.08);
        }
        .students-page .students-table td {
          padding: 13px 14px; border-bottom: 1px solid rgba(0,0,0,0.04);
          color: #374151 !important;
        }
        .students-page .student-row { cursor: pointer; transition: background 0.12s; }
        .students-page .student-row:hover { background: rgba(79,70,229,0.02) !important; }
        .students-page .student-row.selected { background: rgba(79,70,229,0.04) !important; }

        .students-page .student-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(79,70,229,0.08); border: 1px solid rgba(79,70,229,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #4f46e5; flex-shrink: 0;
        }

        .students-page .section-badge {
          padding: 2px 8px; background: rgba(79,70,229,0.06);
          border: 1px solid rgba(79,70,229,0.12); color: #4f46e5 !important;
          border-radius: 4px; font-size: 11px; font-weight: 600;
        }

        .students-page .rate-capsule {
          display: inline-block; padding: 2px 8px; border-radius: 5px;
          font-size: 11px; font-weight: 700; font-family: monospace;
          min-width: 40px; text-align: center;
        }

        .students-page .view-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 5px 10px;
          background: transparent; border: 1px solid #d1d5db;
          border-radius: 5px; color: #4b5563; font-size: 11px; font-weight: 500;
          cursor: pointer; transition: all 0.15s;
        }
        .students-page .view-btn:hover { border-color: #4f46e5; color: #4f46e5; }
        .students-page .view-btn.active {
          background: rgba(220,38,38,0.05); border-color: rgba(220,38,38,0.2); color: #dc2626;
        }

        /* Detail Panel */
        .students-page .detail-col { display: flex; flex-direction: column; gap: 14px; }
        .students-page .detail-card {
          background: #ffffff !important;
          border: 1px solid rgba(79,70,229,0.10) !important;
          border-radius: 10px; padding: 20px;
        }
        .students-page .detail-profile-header {
          display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px;
        }
        .students-page .detail-avatar {
          width: 50px; height: 50px; border-radius: 50%;
          background: rgba(79,70,229,0.08); border: 1.5px solid rgba(79,70,229,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 700; color: #4f46e5; flex-shrink: 0;
        }
        .students-page .detail-name {
          font-size: 15px; font-weight: 700; color: #111827 !important; margin-bottom: 2px;
        }
        .students-page .detail-id {
          font-size: 12px; color: #6b7280 !important; font-family: monospace;
        }
        .students-page .detail-tag {
          padding: 2px 8px; background: #f3f4f6; border: 1px solid #e5e7eb;
          border-radius: 5px; font-size: 11px; color: #4b5563 !important;
        }
        .students-page .counts-grid {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 18px;
        }
        .students-page .count-box {
          border-radius: 8px; padding: 10px 12px; text-align: center;
        }
        .students-page .count-val {
          font-size: 22px; font-weight: 800; line-height: 1;
        }
        .students-page .count-lbl {
          font-size: 10px; color: #6b7280 !important;
          text-transform: uppercase; letter-spacing: 0.04em; margin-top: 4px; font-weight: 600;
        }
        .students-page .rate-row {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px;
        }
        .students-page .rate-bar-bg {
          background: #f3f4f6; border-radius: 99px; height: 7px; overflow: hidden;
        }
        .students-page .rate-bar-fill {
          height: 100%; border-radius: 99px; transition: width 0.5s ease;
        }
        .students-page .risk-alert {
          margin-top: 10px; padding: 9px 12px;
          background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.15);
          border-radius: 7px; font-size: 12px; color: #dc2626 !important;
          display: flex; align-items: center; gap: 7px;
        }
        .students-page .detail-records-header {
          display: flex; align-items: center; gap: 8px;
          padding: 13px 18px; border-bottom: 1px solid rgba(0,0,0,0.08);
          font-size: 13px; font-weight: 600; color: #111827 !important;
          background: rgba(79,70,229,0.03);
        }
        .students-page .record-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 12px 18px;
        }
        .students-page .record-event-name {
          font-size: 13px; font-weight: 600; color: #111827 !important; margin-bottom: 3px;
        }
        .students-page .record-meta {
          display: flex; align-items: center; gap: 4px;
          font-size: 11px; color: #6b7280 !important;
        }

        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
