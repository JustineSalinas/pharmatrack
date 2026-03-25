"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/lib/auth-client";

interface NavItem { href: string; label: string; icon: string; }

interface SidebarProps {
  role: "student" | "faculty" | "admin";
  userName: string;
  userSub: string;
  avatarInitials: string;
}

const navByRole: Record<string, { section: string; items: NavItem[] }[]> = {
  student: [
    {
      section: "Main",
      items: [
        { href: "/dashboard", label: "Overview", icon: "🏠" },
        { href: "/check-in", label: "Check-In", icon: "📷" },
        { href: "/dashboard/records", label: "My Records", icon: "📋" },
        { href: "/dashboard/schedule", label: "Schedule", icon: "🗓️" },
      ],
    },
    {
      section: "Account",
      items: [
        { href: "/dashboard/profile", label: "Profile", icon: "👤" },
        { href: "/dashboard/notifications", label: "Notifications", icon: "🔔" },
      ],
    },
  ],
  faculty: [
    {
      section: "Main",
      items: [
        { href: "/dashboard/faculty", label: "Overview", icon: "🏠" },
        { href: "/dashboard/faculty/generate", label: "Generate QR", icon: "📲" },
        { href: "/dashboard/faculty/students", label: "Students", icon: "👥" },
        { href: "/dashboard/faculty/reports", label: "Reports", icon: "📊" },
      ],
    },
    {
      section: "Account",
      items: [{ href: "/dashboard/profile", label: "Profile", icon: "👤" }],
    },
  ],
  admin: [
    {
      section: "Admin",
      items: [
        { href: "/dashboard/admin", label: "Dashboard", icon: "🏠" },
        { href: "/dashboard/admin/users", label: "User Management", icon: "👥" },
        { href: "/dashboard/admin/attendance", label: "Attendance Logs", icon: "📋" },
        { href: "/dashboard/admin/reports", label: "Analytics", icon: "📊" },
        { href: "/dashboard/admin/settings", label: "Settings", icon: "⚙️" },
      ],
    },
  ],
};

export default function Sidebar({ role, userName, userSub, avatarInitials }: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = "/login";
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link href={(role === "admin" ? "/dashboard/admin" : role === "faculty" ? "/dashboard/faculty" : "/dashboard") as any} className="logo-row" style={{ margin: 0, justifyContent: "flex-start" }}>
          <div className="logo-mark" style={{ width: 34, height: 34, fontSize: 14 }}>⚗️</div>
          <span style={{ fontSize: 13 }}>PHARMATRACK</span>
        </Link>
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
              <span className="ni-icon">{item.icon}</span>
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
