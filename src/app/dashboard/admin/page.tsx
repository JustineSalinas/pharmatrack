"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Bell, Plus, Users, Calendar, ScanLine, TrendingUp, CalendarDays, Loader2 } from "lucide-react";
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

        // Fetch recent 3 scans for the feed
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
          .limit(3);

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
     return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Loader2 className="animate-spin" size={48} color="var(--gold)" />
     </div>;
  }

  return (
    <div className="fade-in">
      {/* HEADER */}
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="breadcrumb-text">Admin Panel</span>
          <h1>Dashboard</h1>
        </div>
        <div className="dash-header-right">
          <button className="dash-search">
            <Search size={16} /> Search
          </button>
          <select className="dash-month-picker" defaultValue="mar2026">
            <option value="feb2026">Feb 2026</option>
            <option value="mar2026">Mar 2026</option>
            <option value="apr2026">Apr 2026</option>
          </select>
          <Link href="/dashboard/admin/events" className="btn btn-gold" style={{ padding: "8px 16px", borderRadius: "10px", gap: "6px", backgroundColor: "#8B5CF6", backgroundImage: "none", color: "white", boxShadow: "none" }}>
            <Plus size={16} /> Manage Events
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
            <div className="stat-label">Overall Rate</div>
          </div>
        </div>
      </div>

      <div className="dash-content-grid">
        {/* LEFT COL: CHART */}
        <div className="trend-panel">
          <div className="trend-header">
            <h3>Attendance trend</h3>
            <div className="trend-tabs">
              <button className="trend-tab">7d</button>
              <button className="trend-tab active">30d</button>
              <button className="trend-tab">90d</button>
            </div>
          </div>
          <div className="trend-subtitle">Weekly scan totals</div>
          
          <div className="trend-chart-area">
            {/* Mockup bars */}
            <div className="chart-bar" style={{ height: "40%" }}></div>
            <div className="chart-bar" style={{ height: "65%" }}></div>
            <div className="chart-bar" style={{ height: "55%" }}></div>
            <div className="chart-bar" style={{ height: "45%" }}></div>
            <div className="chart-bar" style={{ height: "80%" }}></div>
            <div className="chart-bar" style={{ height: "75%" }}></div>
            <div className="chart-bar" style={{ height: "65%" }}></div>
            <div className="chart-bar" style={{ height: "60%" }}></div>
            <div className="chart-bar" style={{ height: "70%" }}></div>
            
            {/* SVG Line Overlay to match mockup */}
            <svg className="chart-line-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path 
                d="M 5 60 Q 15 35 25 45 T 45 55 T 65 20 T 75 35 T 85 40 T 95 30" 
                fill="none" 
                stroke="#d8b4fe" 
                strokeWidth="2" 
                strokeLinecap="round"
                strokeLinejoin="round" 
              />
              <circle cx="5" cy="60" r="1.5" fill="#e9d5ff" />
              <circle cx="25" cy="45" r="1.5" fill="#e9d5ff" />
              <circle cx="45" cy="55" r="1.5" fill="#e9d5ff" />
              <circle cx="65" cy="20" r="1.5" fill="#e9d5ff" />
              <circle cx="75" cy="35" r="1.5" fill="#e9d5ff" />
              <circle cx="85" cy="40" r="1.5" fill="#e9d5ff" />
              <circle cx="95" cy="30" r="1.5" fill="#e9d5ff" />
            </svg>
          </div>
          
          {/* X Axis labels */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 5px 0", fontSize: "0.65rem", color: "var(--muted)" }}>
            <span>Mar 1</span>
            <span>Mar 5</span>
            <span>Mar 8</span>
            <span>Mar 12</span>
            <span>Mar 15</span>
            <span>Mar 19</span>
            <span>Mar 22</span>
          </div>
        </div>

        {/* RIGHT COL: ACTIONS */}
        <div className="dash-actions-col">
          <Link href="/dashboard/admin/scanner" className="action-card purple-grad">
            <div className="action-card-icon"><ScanLine size={24} /></div>
            <div className="action-card-text">
              <h4>Open<br/>Scanner</h4>
              <p>Scan student QR codes</p>
            </div>
          </Link>
          
          <Link href="/dashboard/admin/events" className="action-card orange-grad">
            <div className="action-card-icon"><CalendarDays size={24} /></div>
            <div className="action-card-text">
              <h4>Manage<br/>Events</h4>
              <p>Create & edit events</p>
            </div>
          </Link>

          <div className="quick-stats-card" style={{ gap: "10px" }}>
             <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 auto 10px", textAlign: "center", width: "100%" }}>
                Quick Action Menu
             </p>
             <Link href="/dashboard/admin/attendance" className="btn btn-outline" style={{ width: "100%", padding: "10px", fontSize: "0.9rem" }}>
                View Full Records
             </Link>
          </div>
        </div>
      </div>

      {/* RECENT SCANS LIST */}
      <div className="recent-scans">
        <div className="recent-scans-header">
          <h3>Recent Scans</h3>
          <Link href="/dashboard/admin/attendance">View all →</Link>
        </div>
        
        {recentScans.length > 0 ? (
          recentScans.map(scan => {
            const fname = scan.users?.full_name || "Unknown";
            const initials = fname.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "U";
            const timeIn = scan.time_in ? new Date(scan.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'}) : "No time";
            return (
              <div className="scan-item" key={scan.id}>
                <div className="scan-avatar">{initials}</div>
                <div className="scan-info">
                  <div className="scan-name">{fname}</div>
                  <div className="scan-detail">{scan.events?.name || "Unknown Event"} · Time In: {timeIn}</div>
                </div>
                <div className={`status-badge ${scan.status}`}>{scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}</div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
            No recent scans found.
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
