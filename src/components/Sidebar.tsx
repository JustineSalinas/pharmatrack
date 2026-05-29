"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/lib/auth-client";
import { 
  Home, 
  Camera, 
  ClipboardList, 
  Calendar, 
  User, 
  Bell, 
  QrCode, 
  Users, 
  BarChart, 
  Settings, 
  ChevronDown
} from "lucide-react";

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
        { href: "/dashboard/facilitator/events", label: "Manage Events", icon: <Calendar size={16} /> },
        { href: "/dashboard/facilitator/generate", label: "QR Scanner", icon: <QrCode size={16} /> },
        { href: "/dashboard/facilitator/attendance", label: "Attendance Logs", icon: <ClipboardList size={16} /> },
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
      section: "Main",
      items: [
        { href: "/dashboard/admin", label: "Dashboard", icon: <Home size={16} /> },
        { href: "/dashboard/admin/users", label: "User Management", icon: <Users size={16} /> },
        { href: "/dashboard/admin/attendance", label: "Attendance Logs", icon: <ClipboardList size={16} /> },
        { href: "/dashboard/admin/scanner", label: "QR Scanner", icon: <QrCode size={16} /> },
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
      {/* Brand Logo & Name */}
      <div className="sidebar-logo">
        <div style={{ 
          width: "36px", 
          height: "36px", 
          borderRadius: "50%", 
          background: "var(--gold-dim)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          flexShrink: 0,
          border: "1px solid rgba(180, 83, 9, 0.15)"
        }}>
          <img 
            src="/pham-logo.png" 
            alt="PharmaTrack Logo" 
            style={{ width: "20px", height: "20px", objectFit: "contain" }} 
          />
        </div>
        <div
          onClick={() => window.location.reload()}
          style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}
          role="button"
        >
          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--white)", letterSpacing: "-0.015em" }}>
            PharmaTrack
          </span>
        </div>
      </div>

      {/* User Dropdown Card (Logout trigger) */}
      <div className="sidebar-user-card" onClick={handleLogout} role="button" title="Click to log out">
        <div className="avatar" style={{ 
          width: "32px", 
          height: "32px", 
          borderRadius: "50%", 
          background: "var(--surface2)", 
          color: "var(--white-shade)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          fontSize: "12px", 
          fontWeight: 600, 
          flexShrink: 0 
        }}>
          {role === "admin" ? "SA" : avatarInitials}
        </div>
        <div className="user-info" style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1, overflow: "hidden" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {role === "admin" ? "System Admin" : userName}
          </span>
          <span style={{ fontSize: "10.5px", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {role === "admin" ? "Admin Account" : role === "facilitator" ? "Facilitator" : "Student Account"}
          </span>
        </div>
        <ChevronDown size={14} style={{ color: "var(--dimmed)", flexShrink: 0, marginLeft: "4px" }} />
      </div>

      {/* Nav Menu Sections */}
      {(navByRole[role] ?? navByRole.student).map((group) => (
        <div className="nav-section" key={group.section}>
          <div className="nav-section-label">
            {group.section === "Main" ? "MAIN MENU" : group.section.toUpperCase()}
          </div>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href as any}
              className={`nav-item ${pathname === item.href ? "active" : ""}`}
            >
              <span className="ni-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </aside>
  );
}
