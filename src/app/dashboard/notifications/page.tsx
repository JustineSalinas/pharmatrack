"use client";
import { useState } from "react";

type NotifType = "success" | "warning" | "info" | "danger";

interface Notif {
  id: number;
  icon: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const initialNotifs: Notif[] = [
  { id: 1, icon: "✅", type: "success", title: "Check-In Confirmed", body: "Attendance confirmed for Pharmacology 301 at 7:28 AM.", time: "2 hours ago", read: false },
  { id: 2, icon: "⚠️", type: "warning", title: "Absent Record", body: "You were marked absent for Clinical Pharmacy on Mar 21. Contact your facilitator if this is an error.", time: "Yesterday", read: false },
  { id: 3, icon: "📲", type: "info", title: "New QR Session", body: "A new QR code has been generated for Pharmacognosy — PharmA.", time: "Mar 21", read: true },
  { id: 4, icon: "📉", type: "danger", title: "Attendance Alert", body: "Your attendance in Clinical Pharmacy dropped to 84%. Minimum required is 75%.", time: "Mar 20", read: true },
  { id: 5, icon: "✅", type: "success", title: "Check-In Confirmed", body: "Attendance confirmed for Pharma Chem at 7:45 AM (marked as Late).", time: "Mar 20", read: true },
  { id: 6, icon: "📅", type: "info", title: "Schedule Reminder", body: "Pharmacognosy Lab tomorrow at 1:00 PM in Lab 2. Don't forget your lab coat.", time: "Mar 19", read: true },
  { id: 7, icon: "🎓", type: "info", title: "Semester Update", body: "2nd Semester midterms are scheduled for April 7–11, 2026.", time: "Mar 15", read: true },
];

const borderColor: Record<NotifType, string> = {
  success: "rgba(78,205,196,0.25)",
  warning: "rgba(232,200,74,0.25)",
  info: "rgba(255,255,255,0.1)",
  danger: "rgba(255,107,107,0.25)",
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>(initialNotifs);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unread = notifs.filter(n => !n.read).length;
  const visible = filter === "unread" ? notifs.filter(n => !n.read) : notifs;

  const markAllRead = () => setNotifs(n => n.map(x => ({ ...x, read: true })));
  const markRead = (id: number) => setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  const dismiss = (id: number) => setNotifs(n => n.filter(x => x.id !== id));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Student</span><span>›</span><span>Notifications</span></div>
          <h2>Notifications {unread > 0 && <span style={{ background: "var(--danger)", color: "#fff", fontSize: 12, borderRadius: 99, padding: "2px 8px", marginLeft: 8 }}>{unread}</span>}</h2>
          <p>Stay updated on your attendance status</p>
        </div>
        <div className="header-actions">
          {unread > 0 && <button className="btn btn-outline" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }} onClick={markAllRead}>Mark All Read</button>}
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["all", "unread"] as const).map((f) => (
          <button key={f} className={`btn ${filter === f ? "btn-gold" : "btn-outline"}`} style={{ width: "auto", padding: "7px 18px", fontSize: 13 }} onClick={() => setFilter(f)}>
            {f === "all" ? `All (${notifs.length})` : `Unread (${unread})`}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.length === 0 && (
          <div className="panel" style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)", fontSize: 14 }}>
            🔔 No {filter === "unread" ? "unread " : ""}notifications
          </div>
        )}
        {visible.map((n) => (
          <div
            key={n.id}
            style={{
              background: n.read ? "var(--surface)" : "rgba(232,200,74,0.06)",
              border: `1px solid ${n.read ? "var(--border)" : borderColor[n.type]}`,
              borderRadius: "var(--radius)", padding: "16px 18px",
              display: "flex", gap: 14, alignItems: "flex-start",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onClick={() => markRead(n.id)}
          >
            <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2 }}>{n.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <strong style={{ fontSize: 14 }}>{n.title}</strong>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{n.time}</span>
                  {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--gold)", flexShrink: 0 }} />}
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{n.body}</p>
            </div>
            <button
              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16, padding: "0 4px", lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
            >×</button>
          </div>
        ))}
      </div>
    </>
  );
}
