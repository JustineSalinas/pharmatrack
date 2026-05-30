"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  HeadphonesIcon,
  AlertTriangle
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutUser();
    window.location.href = "/login";
  };

  return (
    <>
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

          <button className="sidebar-logout-btn" onClick={() => setShowLogoutModal(true)}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-overlay" onClick={() => !loggingOut && setShowLogoutModal(false)}>
          <div className="logout-card" onClick={(e) => e.stopPropagation()}>
            <div className="logout-icon-wrap">
              <LogOut size={24} />
            </div>
            <h3 className="logout-title">Log out of PharmaTrack?</h3>
            <p className="logout-desc">
              You will need to sign in again to access your dashboard.
            </p>
            <div className="logout-actions">
              <button
                className="logout-cancel-btn"
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
              >
                Cancel
              </button>
              <button
                className="logout-confirm-btn"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "Logging out…" : "Log Out"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .logout-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.15s ease;
        }

        .logout-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 32px 28px 24px;
          width: 100%;
          max-width: 360px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .logout-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .logout-title {
          font-size: 17px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 6px;
          letter-spacing: -0.01em;
        }

        .logout-desc {
          font-size: 13.5px;
          color: #6b7280;
          margin: 0 0 24px;
          line-height: 1.5;
        }

        .logout-actions {
          display: flex;
          gap: 10px;
        }

        .logout-cancel-btn {
          flex: 1;
          height: 40px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-sans);
        }

        .logout-cancel-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .logout-confirm-btn {
          flex: 1;
          height: 40px;
          border-radius: 8px;
          border: none;
          background: #dc2626;
          color: #ffffff;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-sans);
        }

        .logout-confirm-btn:hover {
          background: #b91c1c;
        }

        .logout-confirm-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
