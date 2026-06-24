"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-client";
import { supabase, parseDateLocal } from "@/lib/supabase";
import { Loader2, Bell, CheckCheck, X, Calendar, CheckCircle2, Clock, AlertCircle, Info } from "lucide-react";
import type { NotificationItem, PharmaUser, Event, AttendanceRecord } from "@/lib/schema";

type NotifType = "success" | "warning" | "info" | "danger";

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    if (d === 1) return "Yesterday";
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return iso; }
}

function buildEventNotif(event: Event): NotificationItem {
  // Use parseDateLocal so a YYYY-MM-DD date string is treated as local midnight,
  // not UTC midnight — which would shift the displayed date by -1 day in UTC+8.
  const localDate = parseDateLocal(event.date);
  const displayDate = localDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const startTime = event.check_in_start
    ? new Date(event.check_in_start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;
  const endTime = event.check_in_end
    ? new Date(event.check_in_end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  const timePart = startTime && endTime ? `${startTime} – ${endTime}` : startTime ?? null;
  const dateLine = [displayDate, timePart].filter(Boolean).join(" · ");
  const locationLine = event.location ? event.location : null;
  const descLine = event.description ?? null;
  const body = [dateLine, locationLine, descLine].filter(Boolean).join(" — ");

  return {
    id: `event-${event.id}`,
    icon: "📅",
    type: "info",
    title: event.name,
    body,
    time: displayDate,
    read: false,
    sortKey: event.created_at,
  };
}

function buildAttendanceNotif(record: AttendanceRecord & {
  qr_sessions: { subject: string; section: string; date: string } | null;
  events: { name: string; date: string; location: string | null } | null;
}): NotificationItem {
  const map: Record<string, { icon: string; type: NotifType; verb: string }> = {
    present: { icon: "✅", type: "success", verb: "Check-In Confirmed" },
    late:    { icon: "⏰", type: "warning", verb: "Marked Late" },
    absent:  { icon: "⚠️", type: "danger",  verb: "Absent Record" },
  };
  const { icon, type, verb } = map[record.status] ?? { icon: "📋", type: "info", verb: "Attendance Updated" };

  let context = "";
  if (record.events) {
    const d = parseDateLocal(record.events.date);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    context = `${record.events.name} on ${dateStr}`;
    if (record.events.location) context += ` · ${record.events.location}`;
  } else if (record.qr_sessions) {
    const dateStr = record.qr_sessions.date
      ? parseDateLocal(record.qr_sessions.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;
    context = record.qr_sessions.subject;
    if (record.qr_sessions.section) context += ` — ${record.qr_sessions.section}`;
    if (dateStr) context += ` on ${dateStr}`;
  } else {
    context = "a class";
  }

  const timeIn = record.time_in
    ? new Date(record.time_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  const body =
    record.status === "absent"
      ? `You were marked absent from ${context}. Contact your facilitator if this is an error.`
      : record.status === "late"
      ? `You were marked late for ${context}${timeIn ? ` — checked in at ${timeIn}` : ""}.`
      : `Attendance confirmed for ${context}${timeIn ? ` — checked in at ${timeIn}` : ""}.`;

  return { id: `attendance-${record.id}`, icon, type, title: verb, body, time: formatRelativeTime(record.created_at), read: false, sortKey: record.created_at };
}

const TYPE_ICON: Record<NotifType, React.ReactNode> = {
  success: <CheckCircle2 size={14} color="var(--success)" />,
  warning: <Clock size={14} color="var(--gold)" />,
  danger:  <AlertCircle size={14} color="var(--danger)" />,
  info:    <Calendar size={14} color="var(--teal)" />,
};
const TYPE_ACCENT: Record<NotifType, { border: string; dot: string; glow: string }> = {
  success: { border: "rgba(74,222,128,0.2)",  dot: "var(--success)", glow: "rgba(74,222,128,0.06)" },
  warning: { border: "rgba(232,184,75,0.2)",  dot: "var(--gold)",    glow: "rgba(232,184,75,0.06)" },
  danger:  { border: "rgba(248,113,113,0.2)", dot: "var(--danger)",  glow: "rgba(248,113,113,0.06)" },
  info:    { border: "rgba(45,212,191,0.2)",  dot: "var(--teal)",    glow: "rgba(45,212,191,0.06)" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    async function load() {
      try {
        const u = await getCurrentUser();
        if (!u) { router.push("/login"); return; }
        const { data: events } = await supabase.from("events")
          .select("id, name, description, location, date, check_in_start, check_in_end, created_at")
          .order("date", { ascending: false }).limit(10);
        const { data: attRaw } = await supabase.from("attendance_records")
          .select("id, student_id, session_id, event_id, status, time_in, time_out, remarks, created_at, qr_sessions(subject, section, date), events(name, date, location)")
          .eq("student_id", u.id).order("created_at", { ascending: false }).limit(10);
        const merged = [
          ...(events ?? []).map((e) => buildEventNotif(e as Event)),
          ...(attRaw ?? []).map((r) => buildAttendanceNotif(r as any)),
        ].sort((a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime());
        setNotifs(merged);
      } catch { setError("Failed to load notifications. Please refresh."); }
      finally { setLoading(false); }
    }
    load();
  }, [router]);

  const unread = notifs.filter((n) => !n.read).length;
  const visible = filter === "unread" ? notifs.filter((n) => !n.read) : notifs;
  const markAllRead = () => setNotifs((n) => n.map((x) => ({ ...x, read: true })));
  const markRead = (id: string) => setNotifs((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
  const dismiss = (id: string) => setNotifs((n) => n.filter((x) => x.id !== id));

  if (loading) return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;

  return (
    <div className="fade-in sd-root">
      {/* ── Header ── */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Student · Inbox</p>
          <h1 className="sd-header-title">
            Notifications
            {unread > 0 && <span className="sp-notif-badge">{unread}</span>}
          </h1>
          <p className="sp-sched-subtitle">Stay updated on your attendance and upcoming events</p>
        </div>
        {unread > 0 && (
          <button className="sp-mark-all-btn" onClick={markAllRead}>
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </header>

      {error && (
        <div className="sp-error-banner">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* ── Filter Tabs ── */}
      <div className="sp-notif-tabs">
        <button className={`sp-notif-tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          All <span className="sp-tab-count">{notifs.length}</span>
        </button>
        <button className={`sp-notif-tab ${filter === "unread" ? "active" : ""}`} onClick={() => setFilter("unread")}>
          Unread <span className="sp-tab-count sp-tab-count-unread">{unread}</span>
        </button>
      </div>

      {/* ── Feed ── */}
      {visible.length === 0 ? (
        <div className="sp-empty-state">
          <Bell size={32} color="var(--dimmed)" />
          <p>{filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
          <span>You're all caught up!</span>
        </div>
      ) : (
        <div className="sp-notif-feed">
          {visible.map((n) => {
            const accent = TYPE_ACCENT[n.type];
            return (
              <div
                key={n.id}
                className={`sp-notif-item ${n.read ? "read" : "unread"}`}
                style={{
                  borderColor: n.read ? "var(--border)" : accent.border,
                  background: n.read ? "var(--surface)" : accent.glow,
                }}
                onClick={() => markRead(n.id)}
              >
                <div className="sp-notif-icon-col">
                  <div className="sp-notif-type-icon">{TYPE_ICON[n.type]}</div>
                </div>

                <div className="sp-notif-body-col">
                  <div className="sp-notif-title-row">
                    <strong className="sp-notif-title">{n.title}</strong>
                    <span className="sp-notif-time">{n.time}</span>
                  </div>
                  <p className="sp-notif-body">{n.body}</p>
                </div>

                <div className="sp-notif-right-col">
                  {!n.read && <div className="sp-notif-dot" style={{ background: accent.dot }} />}
                  <button
                    className="sp-notif-dismiss"
                    onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                    title="Dismiss"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
