"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/lib/auth-client";
import { Home, Camera, ClipboardList, Calendar, User, Bell, QrCode, Users, BarChart, Settings, LogOut } from "lucide-react";

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
        { href: "/dashboard", label: "Overview", icon: <Home size={16} /> },
        { href: "/check-in", label: "Check-In", icon: <Camera size={16} /> },
        { href: "/dashboard/records", label: "My Records", icon: <ClipboardList size={16} /> },
        { href: "/dashboard/schedule", label: "Schedule", icon: <Calendar size={16} /> },
      ],
    },
    {
      section: "Account",
      items: [
        { href: "/dashboard/profile", label: "Profile", icon: <User size={16} /> },
        { href: "/dashboard/notifications", label: "Notifications", icon: <Bell size={16} /> },
      ],
    },
  ],
  facilitator: [
    {
      section: "Main",
      items: [
        { href: "/dashboard/facilitator", label: "Dashboard", icon: <Home size={16} /> },
        { href: "/dashboard/facilitator/generate", label: "Generate QR", icon: <QrCode size={16} /> },
        { href: "/dashboard/facilitator/students", label: "Students", icon: <Users size={16} /> },
        { href: "/dashboard/facilitator/reports", label: "Reports", icon: <BarChart size={16} /> },
      ],
    },
    {
      section: "Account",
      items: [{ href: "/dashboard/profile", label: "Profile", icon: <User size={16} /> }],
    },
  ],
  admin: [
    {
      section: "Admin",
      items: [
        { href: "/dashboard/admin", label: "Dashboard", icon: <Home size={16} /> },
        { href: "/dashboard/admin/users", label: "User Management", icon: <Users size={16} /> },
        { href: "/dashboard/admin/attendance", label: "Attendance Logs", icon: <ClipboardList size={16} /> },
        { href: "/dashboard/admin/reports", label: "Analytics", icon: <BarChart size={16} /> },
        { href: "/dashboard/admin/settings", label: "Settings", icon: <Settings size={16} /> },
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
      <div className="sidebar-logo" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <img src="/pham-logo.png" alt="PharmaTrack Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div
          onClick={() => window.location.reload()}
          style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 1 }}
          role="button"
        >
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: "var(--white)", textTransform: "uppercase" }}>PharmaTrack</span>
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
          <div className="avatar">
            {role === "admin" ? "SA" : avatarInitials}
          </div>
          <div className="user-info">
            <strong>{role === "admin" ? "System Admin" : userName}</strong>
            {role !== "admin" && <span>{userSub}</span>}
          </div>
          <span style={{ color: "var(--dimmed)", marginLeft: "auto", display: "flex" }}>
            <LogOut size={14} />
          </span>
        </div>
      </div>
    </aside>
  );
}
