const schedule: Record<string, { subject: string; time: string; room: string; type?: string }[]> = {
  MON: [
    { subject: "Pharmacology 301", time: "7:30 AM – 9:30 AM", room: "Rm 201" },
    { subject: "Pharmacognosy", time: "9:30 AM – 11:30 AM", room: "Rm 205" },
    { subject: "Clinical Pharmacy", time: "1:00 PM – 3:00 PM", room: "Lab 3" },
  ],
  TUE: [
    { subject: "Pharmaceutical Chem", time: "7:30 AM – 9:30 AM", room: "Rm 210" },
    { subject: "Pharmacy Law & Ethics", time: "1:00 PM – 2:00 PM", room: "Rm 102" },
  ],
  WED: [
    { subject: "Pharmacology 301", time: "7:30 AM – 9:30 AM", room: "Rm 201", type: "lab" },
    { subject: "Pharmacognosy Lab", time: "1:00 PM – 4:00 PM", room: "Lab 2", type: "lab" },
  ],
  THU: [
    { subject: "Clinical Pharmacy", time: "9:30 AM – 11:30 AM", room: "Lab 3" },
    { subject: "Pharmaceutical Chem", time: "1:00 PM – 3:00 PM", room: "Rm 210", type: "lab" },
  ],
  FRI: [
    { subject: "Pharmacology 301", time: "7:30 AM – 9:30 AM", room: "Rm 201" },
    { subject: "Free Period / Review", time: "1:00 PM – 3:00 PM", room: "Library", type: "free" },
  ],
};

const COLOR_MAP: Record<string, string> = {
  "Pharmacology 301": "rgba(232,200,74,0.15)",
  "Pharmacognosy": "rgba(78,205,196,0.15)",
  "Clinical Pharmacy": "rgba(120,100,220,0.2)",
  "Pharmaceutical Chem": "rgba(255,150,80,0.15)",
  "Pharmacy Law & Ethics": "rgba(255,107,107,0.12)",
  "Free Period / Review": "rgba(255,255,255,0.05)",
  default: "rgba(255,255,255,0.07)",
};

const BORDER_MAP: Record<string, string> = {
  "Pharmacology 301": "rgba(232,200,74,0.4)",
  "Pharmacognosy": "rgba(78,205,196,0.4)",
  "Clinical Pharmacy": "rgba(120,100,220,0.5)",
  "Pharmaceutical Chem": "rgba(255,150,80,0.4)",
  "Pharmacy Law & Ethics": "rgba(255,107,107,0.3)",
  default: "rgba(255,255,255,0.13)",
};

const days = ["MON", "TUE", "WED", "THU", "FRI"];

export default function SchedulePage() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Student</span><span>›</span><span>Schedule</span></div>
          <h2>Class Schedule</h2>
          <p>Academic Year 2025–2026 · 2nd Semester · PharmA · 2nd Year</p>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[["Pharmacology 301", "var(--gold)"], ["Pharmacognosy", "var(--success)"], ["Clinical Pharmacy", "#7864DC"], ["Pharma Chem", "#FF9650"], ["Law & Ethics", "var(--danger)"]].map(([l, c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
            <span style={{ color: "var(--muted)" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Weekly grid */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map((day) => (
            <div key={day} style={{ borderRight: "1px solid var(--border)" }}>
              {/* Day header */}
              <div style={{
                padding: "14px 16px", textAlign: "center", fontWeight: 700,
                fontSize: 13, color: day === "MON" ? "var(--gold)" : "var(--muted)",
                borderBottom: "1px solid var(--border)",
                background: day === "MON" ? "rgba(232,200,74,0.07)" : "transparent",
              }}>
                {day}
              </div>
              {/* Subject blocks */}
              <div style={{ padding: "12px 8px", display: "flex", flexDirection: "column", gap: 10, minHeight: 220 }}>
                {(schedule[day] ?? []).map((cls) => (
                  <div
                    key={cls.subject}
                    style={{
                      padding: "10px 12px", borderRadius: "var(--radius-sm)",
                      background: COLOR_MAP[cls.subject] ?? COLOR_MAP.default,
                      border: `1px solid ${BORDER_MAP[cls.subject] ?? BORDER_MAP.default}`,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{cls.subject}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{cls.time}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{cls.room}</div>
                    {cls.type === "lab" && (
                      <span style={{ display: "inline-block", marginTop: 6, fontSize: 9, background: "rgba(78,205,196,0.2)", color: "var(--success)", padding: "1px 6px", borderRadius: 4 }}>LAB</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subject list */}
      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-header"><h3>Subject Details</h3></div>
        <table>
          <thead><tr><th>Subject</th><th>Faculty</th><th>Units</th><th>Days</th><th>Room</th></tr></thead>
          <tbody>
            {[
              ["Pharmacology 301", "Dr. Maria Reyes", "3", "Mon / Wed / Fri", "Rm 201"],
              ["Pharmacognosy", "Prof. Juan Santos", "3", "Mon / Wed", "Rm 205 / Lab 2"],
              ["Clinical Pharmacy", "Dr. Ana Cruz", "3", "Mon / Thu", "Lab 3"],
              ["Pharmaceutical Chem", "Prof. Ben Lim", "3", "Tue / Thu", "Rm 210"],
              ["Pharmacy Law & Ethics", "Atty. Grace Tan", "2", "Tue", "Rm 102"],
            ].map(([sub, fac, u, days, room]) => (
              <tr key={sub}>
                <td><strong>{sub}</strong></td>
                <td style={{ fontSize: 13 }}>{fac}</td>
                <td><span className="tag">{u} units</span></td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{days}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{room}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
