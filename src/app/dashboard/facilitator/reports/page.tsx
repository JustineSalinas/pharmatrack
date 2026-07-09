"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getSystemConfig } from "@/lib/systemConfig";
import { triggerSummaryRefresh } from "@/lib/attendance";
import * as XLSX from "xlsx";
import {
  TrendingUp,
  CalendarCheck,
  Star,
  AlertTriangle,
  Download,
  FileDown,
  Table,
  Search,
  Loader2,
  Award,
  ChevronRight,
  MapPin,
  Calendar
} from "lucide-react";

const SUB_TABS = [
  { key: "students", label: "Attendance Per Student" },
  { key: "events", label: "Most Attended Events" },
  { key: "sections", label: "Section Breakdown" },
  { key: "atrisk", label: "At-Risk Students" },
] as const;

type SubTabKey = typeof SUB_TABS[number]["key"];

function StudentModal({ onClose, allStudents, minAttendance }: { onClose: () => void, allStudents: any[], minAttendance: number }) {
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");

  const filtered = allStudents.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase());
    const matchSection = sectionFilter === "All" || s.section === sectionFilter;
    return matchSearch && matchSection;
  });

  const getRateColor = (rate: number, totalRecords: number = 1) => {
    if (totalRecords === 0) return { color: "#6b7280", bg: "rgba(107, 114, 128, 0.08)", border: "rgba(107, 114, 128, 0.15)" };
    if (rate >= 85) return { color: "#16a34a", bg: "rgba(22, 163, 74, 0.08)", border: "rgba(22, 163, 74, 0.15)" };
    if (rate >= minAttendance) return { color: "#d97706", bg: "rgba(217, 119, 6, 0.08)", border: "rgba(217, 119, 6, 0.15)" };
    return { color: "#dc2626", bg: "rgba(220, 38, 38, 0.08)", border: "rgba(220, 38, 38, 0.15)" };
  };

  const sectionsList = Array.from(new Set(allStudents.map(s => s.section))).filter(Boolean).sort();

  return (
    <div className="reports-modal-overlay">
      <div className="reports-modal-card">
        {/* Modal Header */}
        <div className="reports-modal-header">
          <div>
            <div className="reports-modal-eyebrow">Per-Student Attendance</div>
            <div className="reports-modal-subtitle">
              {filtered.length} of {allStudents.length} students
            </div>
          </div>
          <button onClick={onClose} className="reports-modal-close">
            Close
          </button>
        </div>

        {/* Filters */}
        <div className="reports-modal-filters">
          <input
            placeholder="Search by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="reports-search-input"
          />
          <select
            value={sectionFilter}
            onChange={e => setSectionFilter(e.target.value)}
            className="reports-select-input"
          >
            <option value="All">All Sections</option>
            {sectionsList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="reports-modal-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0, 0, 0, 0.08)" }}>
                {["Student", "ID", "Section", "Attendance Rate"].map(h => (
                  <th key={h} className="reports-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const rc = getRateColor(s.rate, s.total_records);
                const hasSessions = s.total_records > 0;
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid rgba(0, 0, 0, 0.04)" }}>
                    <td className="reports-td" style={{ fontWeight: 600, color: "#111827" }}>{s.name}</td>
                    <td className="reports-td" style={{ fontFamily: "monospace", fontSize: 12, color: "#4b5563" }}>{s.id}</td>
                    <td className="reports-td">
                      <span className="reports-section-badge">{s.section}</span>
                    </td>
                    <td className="reports-td">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 99, height: 6, overflow: "hidden", minWidth: 80 }}>
                          <div style={{ width: `${hasSessions ? s.rate : 0}%`, height: "100%", background: rc.color, borderRadius: 99 }} />
                        </div>
                        <span style={{
                          padding: "2px 8px", borderRadius: 6,
                          fontSize: 11, fontWeight: 700, fontFamily: "monospace",
                          background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                          minWidth: 46, textAlign: "center",
                        }}>{hasSessions ? `${s.rate}%` : "—"}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "32px 12px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                    No students match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
const TrendChart = ({ data }: { data: { month: string, rate: number }[] }) => {
  const width = 650;
  const height = 240;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const yMin = 0;
  const yMax = 100;
  const yTicks = [0, 20, 40, 60, 80, 100];

  const getY = (rate: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, rate));
    return paddingTop + chartHeight - ((clamped - yMin) / (yMax - yMin)) * chartHeight;
  };

  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  const bottomY = getY(yMin);
  const points = data.map((d, i) => `${getX(i)},${getY(d.rate)}`).join(" ");
  const areaPoints = data.length > 1 ? `${getX(0)},${bottomY} ${points} ${getX(data.length - 1)},${bottomY}` : "";

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      {/* Grid lines and Y labels */}
      {yTicks.map(tick => {
        const y = getY(tick);
        return (
          <g key={tick}>
            <text x={paddingLeft - 10} y={y + 4} fill="#9ca3af" fontSize="11" fontWeight="500" textAnchor="end" fontFamily="var(--font-sans)">{tick}%</text>
            <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="4 4" />
          </g>
        );
      })}
      
      {/* Area under line */}
      {data.length > 1 && <polygon points={areaPoints} fill="url(#chartGrad)" opacity={0.3} />}
      
      {/* The Line */}
      {data.length > 1 && <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      
      {/* Data points and X labels */}
      {data.map((d, i) => {
        const x = getX(i);
        const y = getY(d.rate);
        return (
          <g key={d.month}>
            <circle cx={x} cy={y} r="4.5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />
            {/* Value label above the dot */}
            <text x={x} y={y - 10} fill="#4f46e5" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="var(--font-sans)">{d.rate}%</text>
            {/* Month label below */}
            <text x={x} y={height - 8} fill="#6b7280" fontSize="12" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="600">{d.month}</text>
          </g>
        );
      })}

      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(79, 70, 229, 0.25)" />
          <stop offset="100%" stopColor="rgba(79, 70, 229, 0.0)" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default function FacultyReports() {
  const [loading, setLoading] = useState(true);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [topEvents, setTopEvents] = useState<any[]>([]);
  const [sectionBreakdown, setSectionBreakdown] = useState<any[]>([]);
  const [atRisk, setAtRisk] = useState<any[]>([]);
  const [perfectCount, setPerfectCount] = useState(0);
  const [avgAttendanceRate, setAvgAttendanceRate] = useState(0);
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([]);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>("students");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [minAttendance, setMinAttendance] = useState(75);
  const [academicPeriod, setAcademicPeriod] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true);
        // 1. Fetch Students, Events, Attendance Records, and Sessions
        void triggerSummaryRefresh();
        const [
          { data: summaryData, error: sErr },
          { data: events, error: eErr },
          { data: records, error: rErr },
          { data: sessions, error: sessErr },
          config
        ] = await Promise.all([
          supabase.rpc("get_student_attendance_summary"),
          supabase.from("events").select("id, name, location, date"),
          supabase.from("attendance_records").select(`
            id,
            event_id,
            status,
            created_at,
            events ( name, location, date )
          `),
          supabase.from("qr_sessions").select(`date, section, attendance_records(status)`),
          getSystemConfig().catch(() => null)
        ]);

        if (sErr) throw sErr;
        if (eErr) throw eErr;
        if (rErr) throw rErr;
        if (sessErr) throw sessErr;

        const riskThreshold = config ? parseInt(config.minAttendance, 10) || 75 : 75;
        setMinAttendance(riskThreshold);
        if (config) setAcademicPeriod(config.academicPeriod);

        const parsedStudents = (summaryData || []).map((s: any) => ({
          id: s.student_id_number || s.student_id.substring(0, 8),
          name: s.full_name || "Unknown Student",
          section: s.section || "N/A",
          rate: Number(s.attendance_rate) || 0,
          total_records: s.total_records || 0,
          present_count: s.present_count || 0,
          late_count: s.late_count || 0,
          absent_count: s.absent_count || 0,
          incomplete_count: s.incomplete_count || 0,
        }));
        setAllStudents(parsedStudents);
        setTotalEvents(events?.length || 0);

        // Group records to calculate Most Attended Events dynamically
        const eventStatsMap: Record<string, { id: string, name: string, location: string, date: string, attended: number, total: number }> = {};
        records?.forEach((r: any) => {
          if (!r.event_id || !r.events) return;
          const evt = r.events;
          const key = r.event_id;
          if (!eventStatsMap[key]) {
            eventStatsMap[key] = {
              id: key,
              name: evt.name,
              location: evt.location || "N/A",
              date: evt.date,
              attended: 0,
              total: 0
            };
          }
          eventStatsMap[key].total += 1;
          if (r.status === "present" || r.status === "late") {
            eventStatsMap[key].attended += 1;
          }
        });

        const sortedEvents = Object.values(eventStatsMap)
          .map(e => ({
            ...e,
            rate: e.total > 0 ? Math.round((e.attended / e.total) * 100) : 0
          }))
          .sort((a, b) => b.rate - a.rate)
          .slice(0, 5);
        setTopEvents(sortedEvents);

        // Group students to calculate Section Breakdown dynamically
        const sectionsMap: Record<string, { total: number, attended: number, count: number }> = {};
        parsedStudents.forEach((s: any) => {
          if (!sectionsMap[s.section]) {
            sectionsMap[s.section] = { total: 0, attended: 0, count: 0 };
          }
          sectionsMap[s.section].total += s.total_records;
          sectionsMap[s.section].attended += (s.present_count + s.late_count);
          sectionsMap[s.section].count += 1;
        });

        const calculatedSections = Object.entries(sectionsMap).map(([name, data]) => ({
          name,
          count: data.count,
          total: data.total,
          rate: data.total > 0 ? Math.round((data.attended / data.total) * 100) : 0
        })).sort((a, b) => b.rate - a.rate);
        setSectionBreakdown(calculatedSections);

        // At-risk students (rate below the configured threshold and has records)
        const riskStudents = parsedStudents.filter((s: any) => s.rate < riskThreshold && s.total_records > 0);
        setAtRisk(riskStudents);

        // Perfect attendance (rate === 100% and has records)
        const perfectStudents = parsedStudents.filter((s: any) => s.rate === 100 && s.total_records > 0);
        setPerfectCount(perfectStudents.length);

        // Average Attendance Rate
        const totalOverallRecords = parsedStudents.reduce((sum: number, s: any) => sum + s.total_records, 0);
        const totalOverallAttended = parsedStudents.reduce((sum: number, s: any) => sum + (s.present_count + s.late_count), 0);
        const overallAvgRate = totalOverallRecords > 0 ? Math.round((totalOverallAttended / totalOverallRecords) * 100) : 0;
        setAvgAttendanceRate(overallAvgRate);

        // Monthly Trend
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyStats: Record<string, { total: number, attended: number }> = {};
        
        const validSessions = sessions || [];
        validSessions.forEach(s => {
          if (!s.date) return;
          const date = new Date(s.date);
          const m = months[date.getMonth()];
          if (!monthlyStats[m]) monthlyStats[m] = { total: 0, attended: 0 };
          
          const recs = s.attendance_records as any[];
          if (recs) {
            recs.forEach(r => {
              monthlyStats[m].total++;
              if (r.status === "present" || r.status === "late") monthlyStats[m].attended++;
            });
          }
        });

        const monthKeys = Object.keys(monthlyStats).sort((a,b) => months.indexOf(a) - months.indexOf(b));
        const finalMonthly = monthKeys.length > 0 ? monthKeys.map(m => ({
          month: m,
          rate: monthlyStats[m].total > 0 ? Math.round((monthlyStats[m].attended / monthlyStats[m].total) * 100) : 0
        })) : [{ month: months[new Date().getMonth()], rate: 0 }];

        const calculatedTrend = finalMonthly.map(d => ({
          month: d.month,
          rate: d.rate
        }));
        
        setAttendanceTrend(calculatedTrend);

      } catch (err) {
        console.error("Error loading reports:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  function exportCSV() {
    const rows = [
      ["Student Name", "ID", "Section", "Attendance Rate (%)", "Present", "Late", "Absent"],
      ...allStudents.map(s => [s.name, s.id, s.section, `${s.rate}%`, s.present_count, s.late_count, s.absent_count]),
    ];
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PharmaTrack_Facilitator_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    // Per-student sheet
    const studentRows = allStudents.map(s => ({
      "Student Name": s.name,
      "Student ID": s.id,
      "Section": s.section,
      "Present": s.present_count,
      "Late": s.late_count,
      "Absent": s.absent_count,
      "Incomplete": s.incomplete_count,
      "Total Sessions": s.total_records,
      "Attendance Rate (%)": s.rate,
    }));

    // Most-attended-events sheet
    const eventRows = topEvents.map((e, i) => ({
      "Rank": i + 1,
      "Event": e.name,
      "Location": e.location,
      "Date": e.date,
      "Attended": e.attended,
      "Total Records": e.total,
      "Attendance Rate (%)": e.rate,
    }));

    // Section breakdown sheet
    const sectionRows = sectionBreakdown.map(s => ({
      "Section": s.name,
      "Student Count": s.count,
      "Avg Attendance Rate (%)": s.rate,
    }));

    // Summary sheet
    const summary = [
      { Metric: "Avg Attendance Rate (%)", Value: avgAttendanceRate },
      { Metric: "Total Events", Value: totalEvents },
      { Metric: "Perfect Attendance", Value: perfectCount },
      { Metric: "At-Risk Students", Value: atRisk.length },
      { Metric: "Report Generated", Value: new Date().toLocaleString() },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), "Per Student");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventRows), "Top Events");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sectionRows), "Sections");

    XLSX.writeFile(wb, `PharmaTrack_Facilitator_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
      <head>
        <title>PharmaTrack - Facilitator Attendance Analytics</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 40px; color: #111827; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: 800; color: #111827; margin: 0; }
          .subtitle { font-size: 13px; color: #4b5563; margin-top: 4px; }
          .meta { font-size: 13px; text-align: right; color: #4b5563; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .stat-card { border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
          .stat-val { font-size: 20px; font-weight: 700; color: #4f46e5; }
          .stat-lbl { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px; }
          th { background: #f9fafb; text-align: left; padding: 10px 12px; font-weight: 600; border-bottom: 1.5px solid #d1d5db; color: #374151; }
          td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563; }
          .rate-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-family: monospace; }
          .green { background: #d1fae5; color: #065f46; }
          .amber { background: #fef3c7; color: #92400e; }
          .red { background: #fee2e2; color: #991b1b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Attendance Analytics & Reports</h1>
            <div class="subtitle">PharmaTrack Facilitator Portal</div>
          </div>
          <div class="meta">
             <div>Date Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
             <div>Scope: Department-wide Student Records</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-val">${avgAttendanceRate}%</div>
            <div class="stat-lbl">Avg Attendance Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${totalEvents}</div>
            <div class="stat-lbl">Total Events</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${perfectCount}</div>
            <div class="stat-lbl">Perfect Attendance</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${atRisk.length}</div>
            <div class="stat-lbl">At-Risk Students</div>
          </div>
        </div>

        <h2 style="font-size: 15px; font-weight: 700; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Per-Student Attendance Listing</h2>
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Student ID</th>
              <th>Section</th>
              <th>Present</th>
              <th>Late</th>
              <th>Absent</th>
              <th>Attendance Rate</th>
            </tr>
          </thead>
          <tbody>
            ${allStudents.map(s => {
              const cls = s.rate >= 85 ? "green" : s.rate >= minAttendance ? "amber" : "red";
              return `
                <tr>
                  <td style="font-weight: 600; color: #111827;">${s.name}</td>
                  <td>${s.id}</td>
                  <td>${s.section}</td>
                  <td>${s.present_count}</td>
                  <td>${s.late_count}</td>
                  <td>${s.absent_count}</td>
                  <td><span class="rate-badge ${cls}">${s.rate}%</span></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `);
    win.document.close();
  }

  const getRateColor = (rate: number, totalRecords: number = 1) => {
    if (totalRecords === 0) return { color: "#6b7280", bg: "rgba(107, 114, 128, 0.08)", border: "rgba(107, 114, 128, 0.15)" };
    if (rate >= 85) return { color: "#16a34a", bg: "rgba(22, 163, 74, 0.08)", border: "rgba(22, 163, 74, 0.15)" };
    if (rate >= minAttendance) return { color: "#d97706", bg: "rgba(217, 119, 6, 0.08)", border: "rgba(217, 119, 6, 0.15)" };
    return { color: "#dc2626", bg: "rgba(220, 38, 38, 0.08)", border: "rgba(220, 38, 38, 0.15)" };
  };

  const filteredStudentsForTab = allStudents.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasRecords = allStudents.some(s => s.total_records > 0);



  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 className="animate-spin" size={24} color="#4f46e5" />
      </div>
    );
  }

  return (
    <div className="fade-in facilitator-reports-page">
      {showStudentModal && <StudentModal onClose={() => setShowStudentModal(false)} allStudents={allStudents} minAttendance={minAttendance} />}

      {/* TOAST MESSAGE NOTIFICATION */}
      {toastMessage && (
        <div className="reports-toast">
          <Award size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* PAGE HEADER */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Facilitator › Reports & Analytics</p>
          <h1 className="sd-header-title">Reports & Analytics</h1>
        </div>
        <div className="reports-header-actions">
          <button onClick={exportCSV} className="btn-export secondary">
            <Download size={13} />
            <span>CSV</span>
          </button>
          <button onClick={exportExcel} className="btn-export success-btn">
            <Table size={13} />
            <span>Excel</span>
          </button>
          <button onClick={exportPDF} className="btn-export primary">
            <FileDown size={13} />
            <span>PDF Report</span>
          </button>
        </div>
      </header>

      {/* STAT TILES */}
      <div className="reports-stats-strip">
        <div className="reports-stat-tile tile-green">
          <div className="tile-icon-wrap">
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="tile-val">{avgAttendanceRate}%</div>
            <div className="tile-lbl">Avg Attendance Rate</div>
          </div>
        </div>

        <div className="reports-stat-tile tile-indigo">
          <div className="tile-icon-wrap">
            <CalendarCheck size={18} />
          </div>
          <div>
            <div className="tile-val">{totalEvents}</div>
            <div className="tile-lbl">Total Events</div>
          </div>
        </div>

        <div className="reports-stat-tile tile-gold">
          <div className="tile-icon-wrap">
            <Star size={18} />
          </div>
          <div>
            <div className="tile-val">{perfectCount}</div>
            <div className="tile-lbl">Perfect Attendance</div>
          </div>
        </div>

        <div className="reports-stat-tile tile-red">
          <div className="tile-icon-wrap">
            <AlertTriangle size={18} />
          </div>
          <div>
            <div className="tile-val">{atRisk.length}</div>
            <div className="tile-lbl">At-Risk Students</div>
          </div>
        </div>
      </div>

      {/* VISUAL ANALYTICS DASHBOARD GRID */}
      {hasRecords ? (
        <div className="reports-visual-grid" style={{ display: "grid", gap: "20px", marginBottom: "24px" }}>
          
          {/* Card A: Monthly Attendance Trend */}
          <div className="reports-card" style={{ padding: "24px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#111827", margin: 0 }}>Monthly Attendance Trend</h3>
              <span style={{ fontSize: "11px", color: "#6b7280" }}>{academicPeriod || "Academic Year 2026"}</span>
            </div>
            
            <div style={{ height: "220px", width: "100%" }}>
              {attendanceTrend.length < 2 ? (
                <div style={{ color: "#6b7280", fontSize: "12px", textAlign: "center", paddingTop: "50px" }}>
                  Not enough historical monthly data to render trend.
                </div>
              ) : (
                <TrendChart data={attendanceTrend} />
              )}
            </div>

            <div style={{ marginTop: "16px", padding: "16px 0 0", borderTop: "1px solid rgba(0, 0, 0, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>Semester Average Participation</span>
              <strong style={{ fontSize: "14px", color: "#4f46e5" }}>{avgAttendanceRate}%</strong>
            </div>
          </div>
          
          {/* Card B: Section Ranking Bar Chart */}
          <div className="reports-card" style={{ padding: "24px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 className="card-title" style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Award size={16} color="#16a34a" />
                Section Standings
              </h3>
              <span style={{ fontSize: "11px", color: "#16a34a", background: "rgba(22, 163, 74, 0.05)", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>
                Section Comparison
              </span>
            </div>
            
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", justifyContent: "center", overflowY: "auto" }}>
              {sectionBreakdown.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: "12px", textAlign: "center" }}>
                  No sections data available yet.
                </div>
              ) : (
                sectionBreakdown.slice(0, 4).map((sec, idx) => {
                  const colors = [
                    { bar: "linear-gradient(90deg, #4f46e5, #818cf8)", bg: "rgba(79, 70, 229, 0.05)" },
                    { bar: "linear-gradient(90deg, #16a34a, #4ade80)", bg: "rgba(22, 163, 74, 0.05)" },
                    { bar: "linear-gradient(90deg, #d97706, #fbbf24)", bg: "rgba(217, 119, 6, 0.05)" },
                    { bar: "linear-gradient(90deg, #dc2626, #f87171)", bg: "rgba(220, 38, 38, 0.05)" }
                  ];
                  const colScheme = colors[idx % colors.length];
                  return (
                    <div key={sec.name} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600 }}>
                        <span style={{ color: "#111827" }}>{sec.name} <span style={{ fontWeight: 400, color: "#6b7280", fontSize: "11px" }}>({sec.count} {sec.count === 1 ? "student" : "students"})</span></span>
                        <span style={{ color: "#4f46e5" }}>{sec.rate}%</span>
                      </div>
                      <div style={{ width: "100%", height: "12px", background: "#f3f4f6", borderRadius: "99px", overflow: "hidden" }}>
                        <div 
                          className="rank-bar-fill"
                          style={{ 
                            width: `${sec.rate}%`, 
                            height: "100%", 
                            background: colScheme.bar, 
                            borderRadius: "99px",
                            transition: "width 1s ease" 
                          }} 
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
        </div>
      ) : (
        /* Empty Visuals Dashboard */
        <div className="reports-card" style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "220px", marginBottom: "24px", gap: "12px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "12px", background: "rgba(79, 70, 229, 0.05)", border: "1px dashed rgba(79, 70, 229, 0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={24} color="#6b7280" />
          </div>
          <div>
            <h3 className="card-title" style={{ fontSize: "15px", marginBottom: "4px" }}>Visual Analytics Dashboard</h3>
            <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>Data will appear once events are logged</p>
          </div>
        </div>
      )}

      {/* SUB-NAVBAR TABS */}
      <div className="reports-sub-navbar">
        {SUB_TABS.map(tab => {
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveSubTab(tab.key); setSearchQuery(""); }}
              className={`sub-tab-btn ${isActive ? "active" : ""}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: Attendance Per Student */}
      {activeSubTab === "students" && (
        <div className="reports-card">
          <div className="card-header">
            <h3 className="card-title">Attendance Per Student</h3>
            <div className="search-wrap">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button onClick={() => setShowStudentModal(true)} className="btn-expand">
                View All Details
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "24px" }}>Student Profile</th>
                  <th>Student ID</th>
                  <th>Section</th>
                  <th>Attendance Progress</th>
                  <th style={{ textAlign: "right", paddingRight: "24px" }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudentsForTab.slice(0, 8).map(s => {
                  const rc = getRateColor(s.rate, s.total_records);
                  const hasSessions = s.total_records > 0;
                  return (
                    <tr key={s.id}>
                      <td style={{ paddingLeft: "24px", fontWeight: 600, color: "#111827" }}>
                        {s.name}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "12.5px", color: "#4b5563" }}>{s.id}</td>
                      <td>
                        <span className="reports-section-badge">{s.section}</span>
                      </td>
                      <td>
                        <div className="progress-wrap">
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${hasSessions ? s.rate : 0}%`, background: rc.color }} />
                          </div>
                          <span style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "nowrap" }}>
                            {s.present_count + s.late_count} present / {s.total_records} sessions
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", paddingRight: "24px" }}>
                        <span className="rate-capsule" style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                          {hasSessions ? `${s.rate}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredStudentsForTab.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "48px 24px", textAlign: "center", color: "#4b5563" }}>
                      No students found matching the search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredStudentsForTab.length > 8 && (
            <div className="card-footer">
              <span>Showing 8 of {filteredStudentsForTab.length} students</span>
              <button onClick={() => setShowStudentModal(true)} className="footer-link">
                View remaining students <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Most Attended Events */}
      {activeSubTab === "events" && (
        <div className="reports-card">
          <div className="card-header">
            <h3 className="card-title">Most Attended Events</h3>
            <span className="badge-subtitle">Top events by attendance records</span>
          </div>

          <div className="table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "24px", width: "80px" }}>Rank</th>
                  <th>Event Name</th>
                  <th>Location / Venue</th>
                  <th>Date</th>
                  <th>Attended Log</th>
                  <th style={{ textAlign: "right", paddingRight: "24px" }}>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {topEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div style={{ padding: "64px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "rgba(79, 70, 229, 0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <CalendarCheck size={20} color="#6b7280" />
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>Most Attended Events</div>
                        <p style={{ color: "#6b7280", fontSize: "12.5px", margin: 0, maxWidth: "320px" }}>Data will appear once events are logged</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  topEvents.map((e, idx) => {
                    const rc = getRateColor(e.rate);
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <tr key={e.id}>
                        <td style={{ paddingLeft: "24px", fontSize: "14px" }}>
                          {idx < 3 ? medals[idx] : `#${idx + 1}`}
                        </td>
                        <td style={{ fontWeight: 600, color: "#111827" }}>{e.name}</td>
                        <td style={{ color: "#4b5563" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <MapPin size={12} color="#4f46e5" />
                            <span>{e.location}</span>
                          </div>
                        </td>
                        <td style={{ color: "#4b5563", fontSize: "12.5px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Calendar size={12} color="#4f46e5" />
                            <span>{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: "12.5px" }}>
                          {e.attended} <span style={{ color: "#9ca3af" }}>/ {e.total}</span>
                        </td>
                        <td style={{ textAlign: "right", paddingRight: "24px" }}>
                          <span className="rate-capsule" style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                            {e.rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Section Breakdown */}
      {activeSubTab === "sections" && (
        <div className="reports-card">
          <div className="card-header">
            <h3 className="card-title">Section Breakdown</h3>
            <span className="badge-subtitle">Dynamic performance comparison per academic section</span>
          </div>

          <div className="table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "24px" }}>Academic Section</th>
                  <th>Total Enrolled Students</th>
                  <th>Average Attendance Performance</th>
                  <th style={{ textAlign: "right", paddingRight: "24px" }}>Avg Rate</th>
                </tr>
              </thead>
              <tbody>
                {sectionBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div style={{ padding: "64px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "rgba(22, 163, 74, 0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Award size={20} color="#6b7280" />
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>Section Breakdown</div>
                        <p style={{ color: "#6b7280", fontSize: "12.5px", margin: 0, maxWidth: "320px" }}>Data will appear once events are logged</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sectionBreakdown.map(s => {
                    const rc = getRateColor(s.rate, s.total);
                    const hasSessions = s.total > 0;
                    return (
                      <tr key={s.name}>
                        <td style={{ paddingLeft: "24px", fontWeight: 600, color: "#111827" }}>{s.name}</td>
                        <td style={{ color: "#4b5563", fontWeight: 500 }}>{s.count} students</td>
                        <td>
                          <div className="progress-wrap" style={{ maxWidth: "320px" }}>
                            <div className="progress-bar-bg">
                              <div className="progress-bar-fill" style={{ width: `${hasSessions ? s.rate : 0}%`, background: rc.color }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "right", paddingRight: "24px" }}>
                          <span className="rate-capsule" style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                            {hasSessions ? `${s.rate}%` : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: At-Risk Students */}
      {activeSubTab === "atrisk" && (
        <div className="reports-card">
          <div className="card-header">
            <h3 className="card-title" style={{ color: "#dc2626" }}>At-Risk Students</h3>
            <span className="badge-subtitle" style={{ background: "rgba(220, 38, 38, 0.08)", color: "#dc2626" }}>Below {minAttendance}% Attendance Rate</span>
          </div>

          <div className="table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "24px" }}>Student Profile</th>
                  <th>Student ID</th>
                  <th>Section</th>
                  <th>Current Rate</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      {!hasRecords ? (
                        <div style={{ padding: "64px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
                          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "rgba(220, 38, 38, 0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <AlertTriangle size={20} color="#6b7280" />
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>At-Risk Students</div>
                          <p style={{ color: "#6b7280", fontSize: "12.5px", margin: 0, maxWidth: "320px" }}>Data will appear once events are logged</p>
                        </div>
                      ) : (
                        <div style={{ padding: "48px 24px", textAlign: "center", color: "#16a34a", fontWeight: 500 }}>
                          No students are currently in the at-risk attendance threshold.
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  atRisk.map(s => (
                    <tr key={s.id}>
                      <td style={{ paddingLeft: "24px", fontWeight: 600, color: "#111827" }}>{s.name}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "12.5px", color: "#4b5563" }}>{s.id}</td>
                      <td>
                        <span className="reports-section-badge">{s.section}</span>
                      </td>
                      <td>
                        <span className="rate-capsule" style={{ background: "rgba(220, 38, 38, 0.08)", color: "#dc2626", border: "1px solid rgba(220, 38, 38, 0.15)" }}>
                          {s.rate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCRAMBLED COLOR FIX SYSTEM FOR FACILITATOR REPORTS PAGE */}
      <style>{`
        .facilitator-reports-page {
          width: 100%;
        }

        .facilitator-reports-page .sd-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          margin-bottom: 24px;
        }

        .facilitator-reports-page .sd-header-eyebrow {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280 !important;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }

        .facilitator-reports-page .sd-header-title {
          font-size: 22px;
          font-weight: 700;
          color: #111827 !important;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }

        .facilitator-reports-page .reports-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .facilitator-reports-page .btn-export {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .facilitator-reports-page .btn-export.secondary {
          background: #ffffff !important;
          border: 1px solid #d1d5db !important;
          color: #374151 !important;
        }
        .facilitator-reports-page .btn-export.secondary:hover {
          background: #f9fafb !important;
          border-color: #4f46e5 !important;
        }

        .facilitator-reports-page .btn-export.success-btn {
          background: #ffffff !important;
          border: 1px solid rgba(22, 163, 74, 0.3) !important;
          color: #16a34a !important;
        }
        .facilitator-reports-page .btn-export.success-btn:hover {
          background: rgba(22, 163, 74, 0.05) !important;
          border-color: #16a34a !important;
        }

        .facilitator-reports-page .btn-export.primary {
          background: #4f46e5 !important;
          border: none !important;
          color: #ffffff !important;
        }
        .facilitator-reports-page .btn-export.primary:hover {
          background: #4338ca !important;
        }

        /* ── STAT TILES ── */
        .facilitator-reports-page .reports-stats-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        @media (max-width: 900px) {
          .facilitator-reports-page .reports-stats-strip {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .facilitator-reports-page .reports-stat-tile {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 10px !important;
          padding: 16px 20px !important;
          display: flex !important;
          align-items: center !important;
          gap: 14px !important;
          transition: transform 0.18s ease, box-shadow 0.18s ease !important;
        }

        .facilitator-reports-page .reports-stat-tile:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08) !important;
        }

        .facilitator-reports-page .tile-icon-wrap {
          width: 38px !important;
          height: 38px !important;
          border-radius: 8px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
        }

        .facilitator-reports-page .tile-green .tile-icon-wrap { background: rgba(22, 163, 74, 0.08) !important; color: #16a34a !important; }
        .facilitator-reports-page .tile-indigo .tile-icon-wrap { background: rgba(79, 70, 229, 0.08) !important; color: #4f46e5 !important; }
        .facilitator-reports-page .tile-gold .tile-icon-wrap { background: rgba(217, 119, 6, 0.08) !important; color: #d97706 !important; }
        .facilitator-reports-page .tile-red .tile-icon-wrap { background: rgba(220, 38, 38, 0.08) !important; color: #dc2626 !important; }

        .facilitator-reports-page .tile-val {
          font-size: 22px !important;
          font-weight: 800 !important;
          color: #111827 !important;
          line-height: 1.1 !important;
        }

        .facilitator-reports-page .tile-lbl {
          font-size: 11px !important;
          color: #6b7280 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          font-weight: 600 !important;
          margin-top: 4px !important;
        }

        /* ── VISUAL ANALYTICS ── */
        .facilitator-reports-page .reports-visual-grid {
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 900px) {
          .facilitator-reports-page .reports-visual-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .facilitator-reports-page .rank-bar-fill {
          transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ── SUB-NAVBAR TABS ── */
        .facilitator-reports-page .reports-sub-navbar {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(79, 70, 229, 0.05);
          border: 1px solid rgba(79, 70, 229, 0.12);
          border-radius: 8px;
          padding: 4px;
          margin-bottom: 20px;
        }

        .facilitator-reports-page .sub-tab-btn {
          flex: 1;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #4b5563;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .facilitator-reports-page .sub-tab-btn:hover:not(.active) {
          color: #111827;
          background: rgba(79, 70, 229, 0.04);
        }

        .facilitator-reports-page .sub-tab-btn.active {
          background: #4f46e5 !important;
          color: #ffffff !important;
          font-weight: 600;
        }

        /* ── REPORTS CARD ── */
        .facilitator-reports-page .reports-card {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 8px !important;
          overflow: hidden !important;
          margin-bottom: 20px !important;
        }

        .facilitator-reports-page .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .facilitator-reports-page .card-title {
          font-size: 15px;
          font-weight: 600;
          color: #111827 !important;
          margin: 0;
        }

        .facilitator-reports-page .badge-subtitle {
          font-size: 11px;
          font-weight: 600;
          color: #4f46e5;
          background: rgba(79, 70, 229, 0.06);
          border: 1px solid rgba(79, 70, 229, 0.12);
          padding: 3px 10px;
          border-radius: 4px;
        }

        .facilitator-reports-page .search-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .facilitator-reports-page .search-input {
          height: 34px;
          width: 200px;
          padding: 0 12px;
          border-radius: 6px;
          border: 1px solid #d1d5db;
          font-size: 12.5px;
          outline: none;
        }

        .facilitator-reports-page .search-input:focus {
          border-color: #4f46e5;
        }

        .facilitator-reports-page .btn-expand {
          height: 34px;
          padding: 0 14px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .facilitator-reports-page .btn-expand:hover {
          background: #f9fafb;
          border-color: #4f46e5;
          color: #4f46e5;
        }

        .facilitator-reports-page .table-wrap {
          overflow-x: auto;
        }

        .facilitator-reports-page .reports-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .facilitator-reports-page .reports-table th {
          background: #f9fafb;
          color: #6b7280 !important;
          font-weight: 600 !important;
          font-size: 10.5px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          padding: 12px 16px !important;
          border-bottom: 1.5px solid rgba(0, 0, 0, 0.08) !important;
          text-align: left;
        }

        .facilitator-reports-page .reports-table td {
          padding: 14px 16px !important;
          border-bottom: 1px solid rgba(0, 0, 0, 0.04) !important;
          color: #374151 !important;
        }

        .facilitator-reports-page .reports-table tr:hover {
          background: rgba(79, 70, 229, 0.02) !important;
        }

        .facilitator-reports-page .reports-section-badge {
          background: rgba(79, 70, 229, 0.06) !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          color: #4f46e5 !important;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .facilitator-reports-page .progress-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .facilitator-reports-page .progress-bar-bg {
          flex: 1;
          max-width: 140px;
          height: 6px;
          background: #f3f4f6;
          border-radius: 99px;
          overflow: hidden;
        }

        .facilitator-reports-page .progress-bar-fill {
          height: 100%;
          border-radius: 99px;
        }

        .facilitator-reports-page .rate-capsule {
          display: inline-block;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          font-family: monospace;
          min-width: 44px;
          text-align: center;
        }

        .facilitator-reports-page .btn-notify {
          background: #ffffff;
          border: 1px solid #d1d5db;
          color: #dc2626;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 11px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .facilitator-reports-page .btn-notify:hover {
          background: rgba(220, 38, 38, 0.05);
          border-color: #dc2626;
        }

        .facilitator-reports-page .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          font-size: 12px;
          color: #6b7280;
          background: #f9fafb;
        }

        .facilitator-reports-page .footer-link {
          background: transparent;
          border: none;
          color: #4f46e5;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }
        .facilitator-reports-page .footer-link:hover {
          color: #4338ca;
        }

        /* ── MODAL OVERLAY ── */
        .reports-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .reports-modal-card {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          width: 100%;
          maxWidth: 680px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        }

        .reports-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          flex-shrink: 0;
        }

        .reports-modal-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #4f46e5;
          margin-bottom: 4px;
        }

        .reports-modal-subtitle {
          font-size: 13px;
          color: #4b5563;
        }

        .reports-modal-close {
          background: transparent;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 6px 12px;
          color: #4b5563;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .reports-modal-close:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .reports-modal-filters {
          display: flex;
          gap: 12px;
          padding: 14px 24px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          flex-shrink: 0;
          background: #f9fafb;
        }

        .reports-search-input {
          flex: 1;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 14px;
          color: #111827;
          font-size: 13px;
          outline: none;
        }

        .reports-select-input {
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 16px;
          color: #111827;
          font-size: 13px;
          cursor: pointer;
          outline: none;
        }

        .reports-select-input option {
          color: #111827 !important;
          background-color: #ffffff !important;
        }

        .reports-modal-table-wrap {
          overflow-y: auto;
          flex: 1;
          padding: 0 12px;
        }

        .reports-th {
          padding: 12px !important;
          text-align: left;
          font-size: 10px !important;
          color: #6b7280 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          font-weight: 600 !important;
        }

        .reports-td {
          padding: 12px !important;
        }

        /* ── TOAST NOTIFICATION ── */
        .reports-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: #111827;
          color: #ffffff;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 2000;
          font-size: 13.5px;
          font-weight: 500;
          animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
