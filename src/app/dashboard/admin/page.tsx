import Link from "next/link";

const activityLog = [
  { msg: "Dr. Reyes created a QR session for Pharmacology 301", time: "10:24 AM", icon: "📲" },
  { msg: "Juan Dela Cruz checked in — PharmA", time: "10:25 AM", icon: "✅" },
  { msg: "Clara Tan marked absent — PharmB", time: "10:25 AM", icon: "❌" },
  { msg: "New student registered: Felix Tan", time: "9:58 AM", icon: "👤" },
  { msg: "System backup completed successfully", time: "9:00 AM", icon: "💾" },
  { msg: "QR session expired — Pharmacognosy PharmB", time: "8:50 AM", icon: "⏱️" },
];

const systemHealth = [
  { name: "Database", status: "Online", ok: true },
  { name: "QR Service", status: "Active", ok: true },
  { name: "Email Notifications", status: "Active", ok: true },
  { name: "Last Backup", status: "9:00 AM", ok: true },
  { name: "API Status", status: "Operational", ok: true },
];

export default function AdminDashboard() {
  const r = 54, circ = 2 * Math.PI * r, dash = circ * 0.873;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Admin</span><span>›</span><span>Dashboard</span></div>
          <h2>Admin Dashboard <span className="admin-badge" style={{ fontSize: 14 }}>ADMIN</span></h2>
          <p>System-wide overview · Pharmacy Department</p>
        </div>
        <div className="header-actions">
          <Link href="/dashboard/admin/reports" className="btn btn-gold" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}>📊 Generate Report</Link>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { icon: "👥", label: "Total Users", value: "186", sub: "124 students, 12 faculty" },
          { icon: "📅", label: "Sessions Today", value: "8", trend: "Active now", trendClass: "trend-up" },
          { icon: "✅", label: "Avg Rate Today", value: "87%", color: "var(--success)" },
          { icon: "🚨", label: "At-Risk Students", value: "14", color: "var(--danger)", sub: "Below 75%" },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{ color: s.color }}>{s.value}</div>
            {s.sub && <div className="stat-sub">{s.sub}</div>}
            {s.trend && <span className={`stat-trend ${s.trendClass}`}>{s.trend}</span>}
          </div>
        ))}
      </div>

      <div className="content-grid">
        {/* Activity log */}
        <div className="panel">
          <div className="panel-header">
            <h3>Recent Activity Log</h3>
            <Link href="/dashboard/admin/attendance" style={{ color: "var(--gold)", fontSize: 12 }}>View All →</Link>
          </div>
          {activityLog.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 18 }}>{l.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13 }}>{l.msg}</p>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{l.time}</span>
              </div>
            </div>
          ))}
        </div>

        <div>
          {/* Overall rate ring */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header"><h3>Department Rate</h3></div>
            <div className="rate-ring-wrap">
              <svg width="130" height="130" viewBox="0 0 130 130">
                <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                <circle cx="65" cy="65" r={r} fill="none" stroke="var(--gold)" strokeWidth="10"
                  strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 65 65)" />
                <text x="65" y="68" textAnchor="middle" fill="white" fontSize="20" fontFamily="Syne, sans-serif" fontWeight="800">87.3%</text>
                <text x="65" y="84" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">Dept Average</text>
              </svg>
              <div className="rate-legend">
                {[["var(--success)", "Present (87.3%)"], ["var(--danger)", "Absent (8.7%)"], ["var(--gold)", "Late (4.0%)"]].map(([c, l]) => (
                  <div className="leg-item" key={l}><div className="leg-dot" style={{ background: c }} /><span style={{ fontSize: 12 }}>{l}</span></div>
                ))}
              </div>
            </div>
          </div>

          {/* System health */}
          <div className="panel">
            <div className="panel-header"><h3>System Health</h3></div>
            {systemHealth.map((s) => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                <span>{s.name}</span>
                <span style={{ color: s.ok ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                  {s.ok ? "● " : "● "}{s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
