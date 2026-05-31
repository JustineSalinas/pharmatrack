"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import {
  Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  MapPin, Clock, X,
} from "lucide-react";
import type { Event } from "@/lib/schema";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Returns the 42 cells (6 weeks × 7 days) that make up the monthly grid. */
function buildGrid(viewMonth: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(viewMonth);
  const leading = first.getDay(); // 0 = Sun
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + (i - leading));
    cells.push({ date: d, inMonth: d.getMonth() === viewMonth.getMonth() });
  }
  return cells;
}

export default function CalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const u = await getCurrentUser();
        if (!u) { router.push("/login"); return; }
        // Fetch a slightly wider window than just this month so adjacent rows show events too.
        const winStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
        const winEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 2, 0);
        const startStr = winStart.toISOString().split("T")[0];
        const endStr = winEnd.toISOString().split("T")[0];
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .gte("date", startStr)
          .lte("date", endStr)
          .order("date", { ascending: true });
        if (error) throw error;
        if (active) setEvents((data as unknown as Event[]) ?? []);
      } catch (err) {
        console.error("Calendar load failed", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [viewMonth, router]);

  // Map date string → events on that day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const ev of events) {
      const key = ev.date; // already YYYY-MM-DD
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => buildGrid(viewMonth), [viewMonth]);
  const selectedEvents = selectedDay
    ? eventsByDay.get(selectedDay.toISOString().split("T")[0]) ?? []
    : [];

  function shift(delta: number) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  if (loading) {
    return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;
  }

  return (
    <div className="fade-in sd-root">
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Student · Calendar</p>
          <h1 className="sd-header-title">Event Calendar</h1>
          <p className="sd-header-tagline">
            Pharmacy Department activities for the month. Click a highlighted day to see details.
          </p>
        </div>
        <div className="cal-month-nav">
          <button className="cal-nav-btn" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <span className="cal-month-label">{fmtMonthYear(viewMonth)}</span>
          <button className="cal-nav-btn" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
          <button className="cal-today-btn" onClick={() => setViewMonth(startOfMonth(new Date()))}>
            Today
          </button>
        </div>
      </header>

      <div className="cal-grid-panel">
        <div className="cal-weekday-row">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday">{w}</div>
          ))}
        </div>
        <div className="cal-grid">
          {grid.map(({ date, inMonth }, i) => {
            const key = date.toISOString().split("T")[0];
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = isSameDay(date, today);
            const isSelected = selectedDay && isSameDay(date, selectedDay);
            return (
              <button
                key={i}
                type="button"
                className={[
                  "cal-cell",
                  !inMonth ? "out" : "",
                  isToday ? "today" : "",
                  isSelected ? "selected" : "",
                  dayEvents.length > 0 ? "has-events" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => setSelectedDay(date)}
                disabled={!inMonth && dayEvents.length === 0}
              >
                <span className="cal-cell-num">{date.getDate()}</span>
                {dayEvents.length > 0 && (
                  <span className="cal-cell-events">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <span key={ev.id} className="cal-cell-event-pill" title={ev.name}>
                        {ev.name}
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="cal-cell-more">+{dayEvents.length - 2} more</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event details drawer */}
      {selectedDay && (
        <div className="cal-drawer">
          <div className="cal-drawer-header">
            <div>
              <p className="sd-panel-label">Selected Day</p>
              <h3 className="cal-drawer-title">
                {selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </h3>
            </div>
            <button className="cal-drawer-close" onClick={() => setSelectedDay(null)} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          {selectedEvents.length === 0 ? (
            <div className="cal-drawer-empty">
              <CalendarIcon size={22} color="var(--dimmed)" />
              <p>No events scheduled for this day.</p>
            </div>
          ) : (
            <div className="cal-drawer-list">
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="cal-event-card">
                  <h4 className="cal-event-name">{ev.name}</h4>
                  {ev.description && <p className="cal-event-desc">{ev.description}</p>}
                  <div className="cal-event-meta-row">
                    <span className="cal-event-meta-item">
                      <MapPin size={12} /> {ev.location}
                    </span>
                    <span className="cal-event-meta-item">
                      <Clock size={12} /> {fmtTime(ev.check_in_start)} – {fmtTime(ev.check_in_end)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
