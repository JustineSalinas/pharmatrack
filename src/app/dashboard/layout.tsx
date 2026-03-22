"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/lib/auth-client";

const studentNav = [
  { href: "/dashboard", label: "Overview", icon: "🏠" },
  { href: "/check-in", label: "Check-In", icon: "📷" },
  { href: "/dashboard/records", label: "My Records", icon: "📋" },
  { href: "/dashboard/schedule", label: "Schedule", icon: "🗓️" },
];
const accountNav = [
  { href: "/dashboard/profile", label: "Profile", icon: "👤" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "🔔" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = "/login";
  };

  const NavLink = ({ href, label, icon }: { href: string; label: string; icon: string }) => (
    <Link
      href={href}
      className={`nav-item ${pathname === href ? "active" : ""}`}
      onClick={() => setSidebarOpen(false)}
    >
      <span className="ni-icon">{icon}</span> {label}
    </Link>
  );

  return (
    <div className="dash-layout">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: "fixed", top: 16, left: 16, zIndex: 30,
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "8px 10px", cursor: "pointer",
          display: "none", fontSize: 18,
        }}
        className="mobile-menu-btn"
      >☰</button>

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <Link href="/" className="logo-row" style={{ margin: 0, justifyContent: "flex-start" }}>
            <div className="logo-mark" style={{ width: 34, height: 34, fontSize: 14 }}>⚗️</div>
            <span style={{ fontSize: 13 }}>PHARMATRACK</span>
          </Link>
        </div>
        <div className="nav-section">
          <div className="nav-section-label">Main</div>
          {studentNav.map((n) => <NavLink key={n.href} {...n} />)}
        </div>
        <div className="nav-section">
          <div className="nav-section-label">Account</div>
          {accountNav.map((n) => <NavLink key={n.href} {...n} />)}
        </div>
        <div className="sidebar-footer">
          <div className="user-chip" onClick={handleLogout} style={{ cursor: "pointer" }}>
            <div className="avatar">JD</div>
            <div className="user-info">
              <strong>Juan Dela Cruz</strong>
              <span>PharmA · 2nd Year</span>
            </div>
            <span style={{ color: "var(--muted)" }}>⏻</span>
          </div>
        </div>
      </aside>

      <main className="main-content page-enter">{children}</main>
    </div>
  );
}
