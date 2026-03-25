import Link from "next/link";
import { Search, Bell, Plus, Users, Calendar, ScanLine, TrendingUp, CalendarDays } from "lucide-react";

export default function AdminDashboard() {
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
          <Link href="/dashboard/admin/events/new" className="btn btn-gold" style={{ padding: "8px 16px", borderRadius: "10px", gap: "6px", backgroundColor: "#8B5CF6", backgroundImage: "none", color: "white", boxShadow: "none" }}>
            <Plus size={16} /> New Event
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
            <div className="stat-value">142</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge blue"><Calendar size={20} /></div>
          <div>
            <div className="stat-value">2</div>
            <div className="stat-label">Active Events</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge green"><ScanLine size={20} /></div>
          <div>
            <div className="stat-value">87</div>
            <div className="stat-label">Scans Today</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge orange"><TrendingUp size={20} /></div>
          <div>
            <div className="stat-value">91.3%</div>
            <div className="stat-label">Attendance Rate</div>
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

        {/* RIGHT COL: ACTIONS & QUICK STATS */}
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

          <div className="quick-stats-card">
            <div className="quick-stat-item">
              <div className="qs-value green">79</div>
              <div className="qs-label">Present</div>
            </div>
            <div className="quick-stat-item">
              <div className="qs-value yellow">5</div>
              <div className="qs-label">Late</div>
            </div>
            <div className="quick-stat-item">
              <div className="qs-value red">3</div>
              <div className="qs-label">Absent</div>
            </div>
          </div>
        </div>
      </div>

      {/* RECENT SCANS LIST */}
      <div className="recent-scans">
        <div className="recent-scans-header">
          <h3>Recent Scans</h3>
          <Link href="/dashboard/admin/attendance">View all →</Link>
        </div>
        
        <div className="scan-item">
          <div className="scan-avatar">JD</div>
          <div className="scan-info">
            <div className="scan-name">Juan Dela Cruz</div>
            <div className="scan-detail">Pharmacy General Assembly · Time In: 3:02 PM</div>
          </div>
          <div className="status-badge present">Present</div>
        </div>
        
        <div className="scan-item">
          <div className="scan-avatar">MS</div>
          <div className="scan-info">
            <div className="scan-name">Maria Santos</div>
            <div className="scan-detail">Pharmacology 301 · Time In: 3:15 PM</div>
          </div>
          <div className="status-badge late">Late</div>
        </div>
        
        <div className="scan-item">
          <div className="scan-avatar">CT</div>
          <div className="scan-info">
            <div className="scan-name">Clara Tan</div>
            <div className="scan-detail">Pharmacy General Assembly · No record</div>
          </div>
          <div className="status-badge absent">Absent</div>
        </div>
      </div>
      
    </div>
  );
}
