"use client";
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Download,
  Maximize2
} from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function StudentDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadDashboard() {
      try {
        const u = await getCurrentUser();
        if (!u) {
          router.push("/login");
          return;
        }

        // Redirect admin users to their specific dashboard
        if (u.account_type === "admin") {
          router.push("/dashboard/admin");
          return;
        }

        setUser(u);
        
        if (u.account_type === "student") {
          const { data } = await supabase
            .from("student_attendance_summary")
            .select("*")
            .eq("student_id", u.id)
            .single();
          setStats(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [router]);

  if (loading) return null; // Handled by layout loader

  const isStudent = user?.account_type === "student";
  const studentProfile = user?.student_profiles?.[0];
  const qrCodeValue = studentProfile?.qr_code_id || "NOT_READY_YET";

  return (
    <div className="fade-in">
      {/* HEADER */}
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="breadcrumb-text">{isStudent ? "Student Portal" : "Faculty Portal"}</span>
          <h1>Dashboard</h1>
        </div>
      </header>

      {/* STAT CARDS */}
      <div className="stat-cards-row">
        <div className="admin-stat-card">
          <div className="stat-icon-badge green"><CheckCircle size={20} /></div>
          <div>
            <div className="stat-value">{stats?.present_count ?? 0}</div>
            <div className="stat-label">Present</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge orange"><Clock size={20} /></div>
          <div>
            <div className="stat-value">{stats?.late_count ?? 0}</div>
            <div className="stat-label">Late</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge" style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="stat-value">{stats?.absent_count ?? 0}</div>
            <div className="stat-label">Absent</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge purple" style={{ color: "var(--gold)", background: "var(--gold-dim)" }}>
            <Calendar size={20} />
          </div>
          <div>
            <div className="stat-value">{stats?.attendance_rate ?? 0}%</div>
            <div className="stat-label">Attendance Rate</div>
          </div>
        </div>
      </div>

      <div className="dash-content-grid" style={{ gridTemplateColumns: "320px 1fr" }}>
        
        {/* LEFT COL: QR CODE */}
        <div className="dash-actions-col">
          <div className="student-qr-card">
            <h3>Personal ID QR Code</h3>
            
            <div className="qr-wrapper">
              <QRCodeSVG 
                value={qrCodeValue} 
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>
            
            <div className="qr-id-text">{qrCodeValue}</div>
            <p className="qr-help">Present this to any Council Member for scanning.</p>
            
            <div className="student-actions">
              <button className="btn btn-outline" style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
                <Download size={16} /> Save
              </button>
              <button className="btn btn-outline" style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
                <Maximize2 size={16} /> Full
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COL: RECENT RECORDS OR UPCOMING EVENTS */}
        <div className="trend-panel">
          <div className="trend-header">
            <h3>Upcoming Activity</h3>
          </div>
          <div className="trend-subtitle">Next required attendance</div>
          
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginTop: "16px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
              <div style={{ background: "var(--surface2)", padding: "12px", borderRadius: "12px", textAlign: "center", minWidth: "60px" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--gold)", fontWeight: 700, textTransform: "uppercase" }}>Mar</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--white)" }}>28</div>
              </div>
              <div>
                <h4 style={{ fontSize: "1.1rem", color: "var(--white)", fontWeight: 700, marginBottom: "4px" }}>Pharmacy Council Week Launch</h4>
                <div style={{ fontSize: "0.85rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <Clock size={12} /> 9:00 AM - 12:00 PM
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "12px" }}>📍</span> USA Alumni Hall
                </div>
              </div>
            </div>
          </div>

          <Link href="/dashboard/schedule" style={{ display: "inline-block", marginTop: "20px", color: "var(--gold)", fontSize: "0.85rem", fontWeight: 600 }}>
            View full calendar →
          </Link>
        </div>
      </div>
      
    </div>
  );
}
