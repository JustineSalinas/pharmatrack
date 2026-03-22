"use client";

import { useState, useEffect } from "react";
import { getCurrentUser } from "@/lib/auth-client";
import { QRCodeSVG } from "qrcode.react";
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText, 
  Maximize2, 
  Download,
  LayoutDashboard,
  Users,
  ScanLine,
  PlusCircle
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const u = await getCurrentUser();
        setUser(u);
        
        if (u?.account_type === "student") {
          const { data } = await supabase
            .from("student_attendance_summary")
            .select("*")
            .eq("student_id", u.id)
            .single();
          setStats(data);
        } else if (u?.account_type === "admin") {
          // Admin overview stats (example)
          const { count: eventsCount } = await supabase.from("events").select("*", { count: 'exact', head: true });
          const { count: totalStudents } = await supabase.from("users").select("*", { count: 'exact', head: true }).eq("account_type", "student");
          setStats({ eventsCount, totalStudents });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) return null; // Handled by layout loader

  const isStudent = user?.account_type === "student";
  const studentProfile = user?.student_profiles?.[0];

  return (
    <div className="fade-in" style={{ padding: "10px 0" }}>
      <header style={{ marginBottom: "40px" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "15px" }}>
          <LayoutDashboard size={32} color="var(--gold)" />
          {isStudent ? "Student Dashboard" : "Admin Control Center"}
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "8px" }}>
          Welcome back, <span style={{ color: "var(--white)", fontWeight: "600" }}>{user?.full_name}</span>. 
          Manage your {isStudent ? "attendance" : "council events"} here.
        </p>
      </header>

      <div className="cards-row" style={{ display: "grid", gridTemplateColumns: isStudent ? "repeat(auto-fit, minmax(300px, 1fr))" : "repeat(2, 1fr)", gap: "24px" }}>
        
        {/* LEFT COLUMN: PRIMARY ACTION */}
        {isStudent ? (
          <div className="card" style={{ textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, padding: "15px", opacity: 0.1 }}>
              <ScanLine size={100} />
            </div>
            <h3 style={{ color: "var(--gold)", marginBottom: "20px" }}>Personal ID QR Code</h3>
            <div style={{ 
              backgroundColor: "white", 
              padding: "20px", 
              borderRadius: "16px", 
              display: "inline-block",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              marginBottom: "20px"
            }}>
              <QRCodeSVG 
                value={studentProfile?.qr_code_id || "NO_ID"} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: "600", letterSpacing: "2px" }}>
              {studentProfile?.qr_code_id}
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "12px" }}>
               Present this to any Council Member for scanning.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
               <button className="btn btn-outline" style={{ flex: 1, fontSize: "0.9rem", padding: "10px" }}>
                 <Download size={16} /> Save Image
               </button>
               <button className="btn btn-outline" style={{ flex: 1, fontSize: "0.9rem", padding: "10px" }}>
                 <Maximize2 size={16} /> Fullscreen
               </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ background: "linear-gradient(145deg, rgba(232, 200, 74, 0.1), transparent)" }}>
            <h3 style={{ color: "var(--gold)", marginBottom: "25px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ScanLine size={24} /> Quick Scan Students
            </h3>
            <p style={{ color: "var(--muted)", marginBottom: "30px", lineHeight: "1.6" }}>
              Launch the optical scanner to record attendance for the current council activity.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Link href="/dashboard/admin/scanner" className="btn btn-gold pulse-btn" style={{ textDecoration: "none", textAlign: "center" }}>
                Launch QR Scanner
              </Link>
              <Link href="/dashboard/admin/events" className="btn btn-outline" style={{ textDecoration: "none", textAlign: "center" }}>
                <PlusCircle size={18} /> Create New Event
              </Link>
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: STATS / RECENT */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div className="card" style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ color: "var(--success)", opacity: 0.8, marginBottom: "8px" }}><CheckCircle size={24} style={{ margin: "0 auto" }} /></div>
              <div style={{ fontSize: "2rem", fontWeight: "800" }}>{stats?.present_count ?? 0}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Present</div>
            </div>
            <div className="card" style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ color: "var(--gold)", opacity: 0.8, marginBottom: "8px" }}><Clock size={24} style={{ margin: "0 auto" }} /></div>
              <div style={{ fontSize: "2rem", fontWeight: "800" }}>{stats?.late_count ?? 0}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Late</div>
            </div>
            <div className="card" style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ color: "#ef4444", opacity: 0.8, marginBottom: "8px" }}><AlertCircle size={24} style={{ margin: "0 auto" }} /></div>
              <div style={{ fontSize: "2rem", fontWeight: "800" }}>{stats?.absent_count ?? 0}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Absent</div>
            </div>
            <div className="card" style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ color: "#a855f7", opacity: 0.8, marginBottom: "8px" }}><FileText size={24} style={{ margin: "0 auto" }} /></div>
              <div style={{ fontSize: "2rem", fontWeight: "800" }}>{stats?.incomplete_count ?? 0}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Incomplete</div>
            </div>
          </div>

          {!isStudent && (
             <div className="card">
               <h3 style={{ fontSize: "1.1rem", marginBottom: "20px", color: "var(--muted)" }}>Platform Reach</h3>
               <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                  <div style={{ padding: "12px", borderRadius: "12px", backgroundColor: "rgba(232, 200, 74, 0.1)", color: "var(--gold)" }}>
                    <Users size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: "1.4rem", fontWeight: "700" }}>{stats?.totalStudents ?? 0}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Registered Students</div>
                  </div>
               </div>
             </div>
          )}

          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "20px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "10px" }}>
              <Calendar size={18} /> Upcoming Activity
            </h3>
            <div style={{ padding: "15px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", backgroundColor: "rgba(0,0,0,0.2)" }}>
              <strong style={{ display: "block", fontSize: "1rem", color: "var(--white)" }}>Pharmacy Council Week Launch</strong>
              <div style={{ fontSize: "0.85rem", color: "var(--gold)", marginTop: "4px" }}>March 28, 2026 • 9:00 AM</div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "8px" }}>USA Alumni Hall</div>
            </div>
            <Link href="/dashboard/schedule" style={{ display: "block", marginTop: "15px", color: "var(--gold)", fontSize: "0.85rem", textDecoration: "none" }}>
              View full calendar →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
