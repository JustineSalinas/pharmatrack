"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Search, 
  Bell, 
  Plus, 
  Users, 
  Calendar, 
  ScanLine, 
  TrendingUp, 
  CalendarDays, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Activity,
  ShieldCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({ totalStudents: 0, activeEvents: 0, scansToday: 0, attendanceRate: 0 });
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const u = await getCurrentUser();
        if (!u || u.account_type === "student") {
          router.push("/dashboard");
          return;
        }

        // Fetch Total Students
        const { count: studentCount } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("account_type", "student");

        // Fetch upcoming active events
        const today = new Date().toISOString().split("T")[0];
        const { data: eventsData } = await supabase
          .from("events")
          .select("id, date, name", { count: "exact" })
          .gte("date", today);
        
        const activeEventsCount = eventsData?.length || 0;

        // Fetch ALL attendance records for rate calculation and today's scans
        const { data: allAtt } = await supabase
          .from("attendance_records")
          .select("id, created_at, status");

        let scansToday = 0;
        let presentLateCount = 0;
        let totalLogs = 0;

        if (allAtt && allAtt.length > 0) {
          totalLogs = allAtt.length;
          const todayStr = new Date().toDateString();
          
          allAtt.forEach(att => {
            if (new Date(att.created_at).toDateString() === todayStr) {
              scansToday++;
            }
            if (att.status === "present" || att.status === "late") {
              presentLateCount++;
            }
          });
        }

        const rate = totalLogs > 0 ? ((presentLateCount / totalLogs) * 100).toFixed(1) : 0;

        setStats({
          totalStudents: studentCount || 0,
          activeEvents: activeEventsCount,
          scansToday,
          attendanceRate: rate
        });

        // Fetch recent 5 scans for the feed
        const { data: recentAtt } = await supabase
          .from("attendance_records")
          .select(`
            id,
            time_in,
            status,
            events ( name ),
            users ( full_name )
          `)
          .order("created_at", { ascending: false })
          .limit(5);

        setRecentScans(recentAtt || []);
      } catch (err) {
        console.error("Dashboard error", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [router]);

  if (loading) {
     return (
       <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
          <Loader2 className="animate-spin" size={48} color="var(--gold)" />
       </div>
     );
  }

  const systemHealth = [
    { name: "Database", status: "Online", ok: true },
    { name: "QR Service", status: "Active", ok: true },
    { name: "Auth Engine", status: "Operational", ok: true },
    { name: "API Gateway", status: "Active", ok: true },
  ];

  return (
    <div className="fade-in">
      {/* HEADER */}
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="breadcrumb-text">Admin Panel</span>
          <h1>Dashboard Overview</h1>
        </div>
        <div className="dash-header-right">
          <button className="dash-search">
            <Search size={16} /> Search Records
          </button>
          <Link href="/dashboard/admin/reports" className="btn btn-gold" style={{ padding: "8px 16px", borderRadius: "10px", gap: "6px" }}>
            <Activity size={16} /> Reports
          </Link>
          <button className="dash-notif-btn">
            <Bell size={18} />
            <span className="notif-dot"></span>
          </button>
        </div>
      </header>

      {/* STAT CARDS */}
      <div className="stat-cards-row">
        <div className="admin-stat-card">
          <div className="stat-icon-badge purple"><Users size={20} /></div>
          <div>
            <div className="stat-value">{stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge blue"><Calendar size={20} /></div>
          <div>
            <div className="stat-value">{stats.activeEvents}</div>
            <div className="stat-label">Active Events</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge green"><ScanLine size={20} /></div>
          <div>
            <div className="stat-value">{stats.scansToday}</div>
            <div className="stat-label">Scans Today</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge orange"><TrendingUp size={20} /></div>
          <div>
            <div className="stat-value">{stats.attendanceRate}%</div>
            <div className="stat-label">Attendance Rate</div>
          </div>
        </div>
      </div>

      <div className="dash-content-grid" style={{ gridTemplateColumns: "1fr 340px" }}>
        {/* LEFT COL: TREND & RECENT */}
        <div className="main-feed-col" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div className="trend-panel">
            <div className="trend-header">
              <h3>Attendance Trend</h3>
              <div className="trend-tabs">
                <button className="trend-tab active">30 Days</button>
              </div>
            </div>
            <div className="trend-subtitle">Real-time attendance fluctuations</div>
            
            <div className="trend-chart-area">
              <div className="chart-bar" style={{ height: "40%" }}></div>
              <div className="chart-bar" style={{ height: "65%" }}></div>
              <div className="chart-bar" style={{ height: "55%" }}></div>
              <div className="chart-bar" style={{ height: "45%" }}></div>
              <div className="chart-bar" style={{ height: "80%" }}></div>
              <div className="chart-bar" style={{ height: "75%" }}></div>
              <div className="chart-bar" style={{ height: "65%" }}></div>
              <div className="chart-bar" style={{ height: "60%" }}></div>
              <div className="chart-bar" style={{ height: "70%" }}></div>
              
              <svg className="chart-line-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M 5 60 Q 15 35 25 45 T 45 55 T 65 20 T 75 35 T 85 40 T 95 30" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="recent-scans panel">
            <div className="recent-scans-header" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
              <h3>Live Activity Feed</h3>
              <Link href="/dashboard/admin/attendance" style={{ color: "var(--gold)", fontSize: "0.85rem" }}>View All →</Link>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {recentScans.length > 0 ? (
                recentScans.map(scan => {
                  const fname = scan.users?.full_name || "Unknown User";
                  const initials = fname.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "U";
                  const timeIn = scan.time_in ? new Date(scan.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'}) : "No time";
                  return (
                    <div className="scan-item" key={scan.id} style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                      <div className="scan-avatar" style={{ background: "var(--surface2)", border: "1px solid var(--gold-dim)" }}>{initials}</div>
                      <div className="scan-info">
                        <div className="scan-name" style={{ color: "var(--white)", fontWeight: 600 }}>{fname}</div>
                        <div className="scan-detail" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{scan.events?.name || "Event Scan"} · {timeIn}</div>
                      </div>
                      <div className={`status-badge ${scan.status}`} style={{ fontSize: "0.7rem", padding: "4px 8px" }}>{scan.status.toUpperCase()}</div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>No recent activity.</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COL: SYSTEM STATUS & QUICK ACTIONS */}
        <div className="side-panels-col" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div className="panel" style={{ background: "linear-gradient(135deg, var(--surface), #1a0b36)", border: "1px solid var(--gold-dim)" }}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}><ShieldCheck size={18} color="var(--success)" /> System Health</h3>
            </div>
            {systemHealth.map((s) => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--muted)" }}>{s.name}</span>
                <span style={{ color: "var(--success)", fontWeight: 700 }}>● {s.status}</span>
              </div>
            ))}
          </div>

          <div className="dash-actions-col" style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
            <Link href="/check-in" className="action-card purple-grad" style={{ height: "auto", padding: "20px" }}>
              <div className="action-card-icon"><ScanLine size={24} /></div>
              <div className="action-card-text">
                <h4>Open Scanner</h4>
                <p>Record attendance</p>
              </div>
            </Link>
            <Link href="/dashboard/admin/users" className="action-card orange-grad" style={{ height: "auto", padding: "20px" }}>
              <div className="action-card-icon"><Plus size={24} /></div>
              <div className="action-card-text">
                <h4>Manage Users</h4>
                <p>Review and Approve</p>
              </div>
            </Link>
            <Link href="/dashboard/admin/events" className="action-card" style={{ height: "auto", padding: "20px", background: "var(--surface2)", border: "1px solid var(--border)" }}>
               <div className="action-card-icon" style={{ background: "rgba(255,255,255,0.05)" }}><CalendarDays size={24} /></div>
               <div className="action-card-text">
                 <h4>Event List</h4>
                 <p>Schedule activities</p>
               </div>
            </Link>
          </div>

        </div>
      </div>
      
      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
