"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/lib/auth-client";
import { Home, Camera, ClipboardList, Calendar, User, Bell, QrCode, Users, BarChart, Settings } from "lucide-react";

interface NavItem { href: string; label: string; icon: React.ReactNode; }

interface SidebarProps {
  role: "student" | "facilitator" | "admin";
  userName: string;
  userSub: string;
  avatarInitials: string;
}

const navByRole: Record<string, { section: string; items: NavItem[] }[]> = {
  student: [
    {
      section: "Main",
      items: [
        { href: "/dashboard", label: "Overview", icon: <Home size={18} /> },
        { href: "/check-in", label: "Check-In", icon: <Camera size={18} /> },
        { href: "/dashboard/records", label: "My Records", icon: <ClipboardList size={18} /> },
        { href: "/dashboard/schedule", label: "Schedule", icon: <Calendar size={18} /> },
      ],
    },
    {
      section: "Account",
      items: [
        { href: "/dashboard/profile", label: "Profile", icon: <User size={18} /> },
        { href: "/dashboard/notifications", label: "Notifications", icon: <Bell size={18} /> },
      ],
    },
  ],
  facilitator: [
    {
      section: "Main",
      items: [
        { href: "/dashboard/facilitator", label: "Overview", icon: <Home size={18} /> },
        { href: "/dashboard/facilitator/generate", label: "Generate QR", icon: <QrCode size={18} /> },
        { href: "/dashboard/facilitator/students", label: "Students", icon: <Users size={18} /> },
        { href: "/dashboard/facilitator/reports", label: "Reports", icon: <BarChart size={18} /> },
      ],
    },
    {
      section: "Account",
      items: [{ href: "/dashboard/profile", label: "Profile", icon: <User size={18} /> }],
    },
  ],
  admin: [
    {
      section: "Admin",
      items: [
        { href: "/dashboard/admin", label: "Dashboard", icon: <Home size={18} /> },
        { href: "/dashboard/admin/users", label: "User Management", icon: <Users size={18} /> },
        { href: "/dashboard/admin/attendance", label: "Attendance Logs", icon: <ClipboardList size={18} /> },
        { href: "/dashboard/admin/reports", label: "Analytics", icon: <BarChart size={18} /> },
        { href: "/dashboard/admin/settings", label: "Settings", icon: <Settings size={18} /> },
      ],
    },
  ],
};

export default function Sidebar({ role, userName, userSub, avatarInitials }: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      await logoutUser();
      window.location.href = "/login";
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div
          onClick={() => window.location.reload()}
          className="logo-row"
          style={{ margin: 0, justifyContent: "flex-start", cursor: "pointer" }}
          role="button"
        >
          <div style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/pham-logo.png" alt="Pharmacy Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: "bold", letterSpacing: "0.5px" }}>PHARMATRACK</span>
        </div>
      </div>

      {(navByRole[role] ?? navByRole.student).map((group) => (
        <div className="nav-section" key={group.section}>
          <div className="nav-section-label">{group.section}</div>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? "active" : ""}`}
            >
              <span className="ni-icon" style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      ))}

      <div className="sidebar-footer">
        <div className="user-chip" onClick={handleLogout} role="button" style={{ cursor: "pointer" }}>
          <div
            className="avatar"
            style={role === "admin" ? { background: "linear-gradient(135deg, #FF6B6B, var(--bg3))" } : undefined}
          >
            {avatarInitials}
          </div>
          <div className="user-info">
            <strong>{userName}</strong>
            <span>{userSub}</span>
          </div>
          <span style={{ color: "var(--muted)" }}>⏻</span>
        </div>
      </div>
    </aside>
  );
}
