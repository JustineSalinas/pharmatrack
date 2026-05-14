"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { FileText, Download, TrendingUp, AlertTriangle, Calendar, Loader2, Award } from "lucide-react";

const TrendChart = ({ data }: { data: { month: string, rate: number }[] }) => {
  const width = 600;
  const height = 180;
  const paddingX = 30;
  const paddingY = 15;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const yTicks = [60, 70, 80, 90, 100];

  const getY = (rate: number) => {
    const min = 50;
    const max = 100;
    const clamped = Math.max(min, Math.min(max, rate));
    return height - paddingY - ((clamped - min) / (max - min)) * chartHeight;
  };

  const getX = (index: number) => {
    if (data.length <= 1) return width / 2;
    return paddingX + (index / (data.length - 1)) * chartWidth;
  };

  const points = data.map((d, i) => `${getX(i)},${getY(d.rate)}`).join(" ");
  const areaPoints = data.length > 1 ? `${getX(0)},${height - paddingY} ${points} ${getX(data.length - 1)},${height - paddingY}` : "";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%", overflow: "visible", marginTop: "16px" }}>
      {/* Grid lines and Y labels */}
      {yTicks.map(tick => {
        const y = getY(tick);
        return (
          <g key={tick}>
            <text x={paddingX - 10} y={y + 3} fill="var(--dimmed)" fontSize="10" textAnchor="end" fontFamily="var(--font-sans)">{tick}%</text>
            <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
          </g>
        );
      })}
      
      {/* Area under line */}
      {data.length > 1 && <polygon points={areaPoints} fill="url(#gradient)" opacity={0.3} />}
      
      {/* The Line */}
      {data.length > 1 && <polyline points={points} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      
      {/* Data points and X labels */}
      {data.map((d, i) => {
        const x = getX(i);
        const y = getY(d.rate);
        return (
          <g key={d.month}>
            <circle cx={x} cy={y} r="3" fill="var(--surface)" stroke="var(--gold)" strokeWidth="2" />
            <text x={x} y={height} fill="var(--dimmed)" fontSize="10" textAnchor="middle" fontFamily="var(--font-sans)">{d.month}</text>
          </g>
        );
      })}

      <defs>
        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [metrics, setMetrics] = useState({ avgRate: 0, totalSessions: 0, perfectRecords: 0, flaggedStudents: 0 });
  const [monthlyData, setMonthlyData] = useState<{month: string, rate: number}[]>([]);
  const [sectionData, setSectionData] = useState<{name: string, rate: number, count: number}[]>([]);
  const [riskList, setRiskList] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const u = await getCurrentUser();
        if (!u || u.account_type === "student") {
          router.push("/dashboard");
          return;
        }

        const [ { data: studentStats, error: sErr }, { data: sessions, error: rErr } ] = await Promise.all([
           supabase.from("student_attendance_summary").select("*"),
           supabase.from("qr_sessions").select(`date, section, attendance_records(status)`)
        ]);

        if (sErr) throw sErr;
        if (rErr) throw rErr;

        const validStats = studentStats || [];
        const validSessions = sessions || [];

        // Overall Metrics
        let totalRecs = 0;
        let totalAttended = 0;
        let perfect = 0;
        let flagged = 0;
        const risks: any[] = [];
        const sectionsMap: Record<string, { total: number, attended: number, count: number }> = {};

        validStats.forEach(s => {
          totalRecs += s.total_records;
          totalAttended += (s.present_count + s.late_count);

          if (s.total_records > 0) {
             if (s.attendance_rate === 100) perfect++;
             if (s.attendance_rate < 75) {
                flagged++;
                risks.push({
                   id: s.student_id_number || s.student_id.substring(0,8),
                   name: s.full_name,
                   section: s.section,
                   rate: s.attendance_rate
                });
             }
          }

          // Section mapping
          if (!sectionsMap[s.section]) {
            sectionsMap[s.section] = { total: 0, attended: 0, count: 0 };
          }
          sectionsMap[s.section].total += s.total_records;
          sectionsMap[s.section].attended += (s.present_count + s.late_count);
          sectionsMap[s.section].count++;
        });

        risks.sort((a,b) => a.rate - b.rate);

        const avgRate = totalRecs > 0 ? Math.round((totalAttended / totalRecs) * 100) : 0;
        
        // Section Breakdown
        const finalSections = Object.keys(sectionsMap).map(sec => ({
          name: sec,
          rate: sectionsMap[sec].total > 0 ? Math.round((sectionsMap[sec].attended / sectionsMap[sec].total) * 100) : 0,
          count: sectionsMap[sec].count
        })).sort((a,b) => b.rate - a.rate);

        // Monthly Trend
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyStats: Record<string, { total: number, attended: number }> = {};
        
        validSessions.forEach(s => {
           if (!s.date) return;
           const date = new Date(s.date);
           const m = months[date.getMonth()];
           if (!monthlyStats[m]) monthlyStats[m] = { total: 0, attended: 0 };
           
           const records = s.attendance_records as any[];
           if (records) {
             records.forEach(r => {
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

        setMetrics({
          avgRate,
          totalSessions: validSessions.length,
          perfectRecords: perfect,
          flaggedStudents: flagged
        });
        setMonthlyData(finalMonthly);
        setSectionData(finalSections);
        setRiskList(risks);

      } catch (err) {
        console.error("Error fetching admin reports", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  const getBarColor = (rate: number) => {
    if (rate >= 85) return "var(--success)";
    if (rate >= 75) return "var(--gold)";
    return "var(--danger)";
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 className="animate-spin" size={24} color="var(--dimmed)" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "var(--dimmed)", letterSpacing: "0.06em", marginBottom: "8px" }}>
            <span>Admin Control</span><span style={{ margin: "0 8px" }}>/</span><span>Analytics</span>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.03em", color: "var(--white)" }}>Analytics & Reports</h2>
          <p style={{ color: "var(--dimmed)", fontSize: "13px", marginTop: "4px", margin: 0 }}>Department-wide participation and performance insights</p>
        </div>
        <div className="header-actions" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
           <button className="btn-ghost" style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white-shade)", fontSize: "13px", fontWeight: 500, cursor: "pointer", gap: "6px", transition: "all 0.15s ease" }}>
             <Download size={14} /> Export CSV
           </button>
           <button className="btn-ghost" style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white-shade)", fontSize: "13px", fontWeight: 500, cursor: "pointer", gap: "6px", transition: "all 0.15s ease" }}>
             <FileText size={14} /> Export PDF
           </button>
        </div>
      </div>

      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", marginBottom: "32px" }}>
        {/* Dept Avg */}
        <div className="stat-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dept. Avg Rate</div>
            <TrendingUp size={16} color="var(--dimmed)" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--white)", letterSpacing: "-0.02em" }}>{metrics.avgRate}%</div>
        </div>

        {/* Total Sessions */}
        <div className="stat-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total QR Sessions</div>
            <Calendar size={16} color="var(--dimmed)" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--white)", letterSpacing: "-0.02em" }}>{metrics.totalSessions}</div>
          <div style={{ fontSize: "11px", color: "var(--dimmed)", marginTop: "6px" }}>Active this semester</div>
        </div>

        {/* Perfect Records */}
        <div className="stat-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Perfect Records</div>
            <Award size={16} color="var(--dimmed)" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--white)", letterSpacing: "-0.02em" }}>{metrics.perfectRecords}</div>
          <div style={{ fontSize: "11px", color: "var(--dimmed)", marginTop: "6px" }}>Students with 100%</div>
        </div>

        {/* Flagged Students - Elevated Warning */}
        <div className="stat-card" style={{ background: "linear-gradient(180deg, var(--surface) 0%, rgba(212, 175, 55, 0.05) 100%)", border: "1px solid var(--gold-dim)", borderRadius: "var(--radius)", padding: "20px", display: "flex", flexDirection: "column", boxShadow: "0 4px 20px rgba(212, 175, 55, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Flagged Students</div>
            <AlertTriangle size={16} color="var(--gold)" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--gold)", letterSpacing: "-0.02em" }}>{metrics.flaggedStudents}</div>
          <div style={{ fontSize: "11px", color: "var(--gold)", opacity: 0.8, marginTop: "6px" }}>Critical attendance &lt; 75%</div>
        </div>
      </div>

      <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", marginBottom: "24px" }}>
        {/* Monthly Trend Chart */}
        <div className="panel" style={{ padding: "24px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <div className="panel-header" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--white)" }}>Monthly Attendance Trend</h3>
            <span style={{ fontSize: "11px", color: "var(--dimmed)" }}>Academic Year 2026</span>
          </div>
          
          <div style={{ height: "200px", width: "100%" }}>
            <TrendChart data={monthlyData} />
          </div>

          <div style={{ marginTop: "16px", padding: "16px 0 0", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--dimmed)" }}>Semester Average Participation</span>
            <strong style={{ fontSize: "14px", color: "var(--gold)" }}>{metrics.avgRate}%</strong>
          </div>
        </div>

        {/* Section breakdown */}
        <div className="panel" style={{ padding: "24px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", display: "flex", flexDirection: "column" }}>
          <div className="panel-header" style={{ marginBottom: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--white)" }}>Section Breakdown</h3>
          </div>
          {sectionData.length === 0 ? (
             <div style={{ padding: "40px", textAlign: "center", color: "var(--dimmed)", fontSize: "13px" }}>No section data available</div>
          ) : (
             <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
               {sectionData.map((sec) => (
                 <div key={sec.name}>
                   <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px" }}>
                     <div style={{ fontWeight: 500, color: "var(--white-shade)" }}>
                       {sec.name} <span style={{ color: "var(--dimmed)", fontWeight: 400, marginLeft: "8px", fontSize: "11px" }}>{sec.count} students</span>
                     </div>
                     <strong style={{ color: "var(--white)" }}>{sec.rate}%</strong>
                   </div>
                   <div style={{ background: "var(--surface2)", borderRadius: "10px", height: "6px", overflow: "hidden" }}>
                     <div style={{ width: `${sec.rate}%`, height: "100%", background: getBarColor(sec.rate), borderRadius: "10px" }} />
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>

      <div className="content-grid" style={{ display: "flex", flexDirection: "column" }}>
        {/* At risk */}
        <div className="panel" style={{ padding: 0, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <div className="panel-header" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--white)", display: "flex", alignItems: "center", gap: "8px" }}>
               <AlertTriangle size={16} color="var(--danger)" /> Attendance Risk List
            </h3>
            <span style={{ fontSize: "11px", color: "var(--danger)", fontWeight: 600, letterSpacing: "0.06em" }}>INTERVENTION REQ.</span>
          </div>
          <div className="table-wrap">
            <table className="attendance-table" style={{ width: "100%" }}>
              <thead><tr><th style={{ paddingLeft: "24px" }}>Student</th><th>Section</th><th>Rate</th><th style={{ textAlign: "right", paddingRight: "24px" }}>Action</th></tr></thead>
              <tbody>
                {riskList.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "var(--dimmed)" }}>
                       No students are currently flagged for low attendance.
                    </td>
                  </tr>
                ) : (
                  riskList.map((s) => (
                    <tr key={s.id} className="user-row">
                      <td style={{ paddingLeft: "24px" }}>
                        <div style={{ fontWeight: 500, fontSize: "13px", color: "var(--white-shade)" }}>{s.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--dimmed)", fontFamily: "var(--font-sans)", marginTop: "2px" }}>{s.id}</div>
                      </td>
                      <td><span className="tag" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--dimmed)", fontSize: "11px" }}>{s.section}</span></td>
                      <td><span style={{ color: "var(--danger)", fontWeight: 600, fontSize: "13px" }}>{s.rate}%</span></td>
                      <td style={{ textAlign: "right", paddingRight: "24px" }}>
                        <button className="action-btn-hover" style={{ width: "auto", padding: "6px 12px", marginLeft: "auto", color: "var(--white-shade)", border: "1px solid var(--border)", opacity: 1 }}>Notify Agent</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <style jsx>{`
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

        .action-btn-hover:hover {
          background: var(--surface2) !important;
          color: var(--white) !important;
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
