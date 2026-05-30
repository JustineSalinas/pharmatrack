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
  LogOut,
  HeadphonesIcon
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
        { href: "/dashboard/facilitator", label: "Dashboard", icon: <Home size={18} /> },
        { href: "/dashboard/facilitator/events", label: "Manage Events", icon: <Calendar size={18} /> },
        { href: "/dashboard/facilitator/generate", label: "QR Scanner", icon: <QrCode size={18} /> },
        { href: "/dashboard/facilitator/attendance", label: "Attendance Logs", icon: <ClipboardList size={18} /> },
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
      section: "Main",
      items: [
        { href: "/dashboard/admin", label: "Dashboard", icon: <Home size={18} /> },
        { href: "/dashboard/admin/users", label: "User Management", icon: <Users size={18} /> },
        { href: "/dashboard/admin/attendance", label: "Attendance Logs", icon: <ClipboardList size={18} /> },
        { href: "/dashboard/admin/scanner", label: "QR Scanner", icon: <QrCode size={18} /> },
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
      {/* Scrollable Nav Area */}
      <div className="sidebar-scroll-area">

        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <img
              src="/pham-logo.png"
              alt="PharmaTrack Logo"
              style={{ width: "20px", height: "20px", objectFit: "contain" }}
            />
          </div>
          <span
            className="sidebar-brand-name"
            onClick={() => window.location.reload()}
            role="button"
            style={{ cursor: "pointer" }}
          >
            PharmaTrack
          </span>
        </div>

        {/* Nav Sections */}
        <nav className="sidebar-nav">
          {(navByRole[role] ?? navByRole.student).map((group) => (
            <div className="nav-group" key={group.section}>
              <p className="nav-group-label">
                {group.section === "Main" ? "Main Menu" : group.section}
              </p>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    className={`nav-link${isActive ? " nav-link--active" : ""}`}
                  >
                    <span className="nav-link-icon">{item.icon}</span>
                    <span className="nav-link-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-support-btn" onClick={() => {}}>
          <HeadphonesIcon size={16} />
          <span>Contact Support</span>
        </button>

        <button className="sidebar-logout-btn" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
