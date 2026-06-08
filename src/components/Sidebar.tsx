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
  AlertTriangle,
  Mail,
  ShoppingBag
} from "lucide-react";

interface NavItem { href: string; label: string; icon: React.ReactNode; }

interface SidebarProps {
  role: "student" | "facilitator" | "admin";
  userName: string;
  userSub: string;
  avatarInitials: string;
  onClose?: () => void;
}

const navByRole: Record<string, { section: string; items: NavItem[] }[]> = {
  student: [
    {
      section: "Main",
      items: [
        { href: "/dashboard", label: "Overview", icon: <Home size={18} /> },
        { href: "/dashboard?checkin=true", label: "Check-In", icon: <Camera size={18} /> },
        { href: "/dashboard/records", label: "My Records", icon: <ClipboardList size={18} /> },
        { href: "/dashboard/calendar", label: "Calendar", icon: <Calendar size={18} /> },
        { href: "/dashboard/schedule", label: "Schedule", icon: <Calendar size={18} /> },
        { href: "/dashboard/merch", label: "Merch Catalogue", icon: <ShoppingBag size={18} /> },
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
        { href: "/dashboard/facilitator/scanner", label: "QR Scanner", icon: <Camera size={18} /> },
        { href: "/dashboard/facilitator/attendance", label: "Attendance Logs", icon: <ClipboardList size={18} /> },
        { href: "/dashboard/facilitator/students", label: "Students", icon: <Users size={18} /> },
        { href: "/dashboard/facilitator/reports", label: "Reports", icon: <BarChart size={18} /> },
        { href: "/dashboard/merch", label: "Merch Catalogue", icon: <ShoppingBag size={18} /> },
      ],
    },
    {
      section: "Account",
      items: [{ href: "/dashboard/facilitator/profile", label: "Profile", icon: <User size={18} /> }],
    },
  ],
  admin: [
    {
      section: "Main",
      items: [
        { href: "/dashboard/admin", label: "Dashboard", icon: <Home size={18} /> },
        { href: "/dashboard/merch", label: "Merch Catalogue", icon: <ShoppingBag size={18} /> },
      ],
    },
    {
      section: "Management",
      items: [
        { href: "/dashboard/admin/users", label: "User Management", icon: <Users size={18} /> },
        { href: "/dashboard/admin/events", label: "Manage Events", icon: <Calendar size={18} /> },
      ],
    },
    {
      section: "Attendance",
      items: [
        { href: "/dashboard/admin/scanner", label: "QR Scanner", icon: <QrCode size={18} /> },
        { href: "/dashboard/admin/attendance", label: "Attendance Logs", icon: <ClipboardList size={18} /> },
      ],
    },
    {
      section: "Analytics & Settings",
      items: [
        { href: "/dashboard/admin/reports", label: "Analytics", icon: <BarChart size={18} /> },
        { href: "/dashboard/admin/settings", label: "Settings", icon: <Settings size={18} /> },
      ],
    },
    {
      section: "Account",
      items: [{ href: "/dashboard/admin/profile", label: "Profile", icon: <User size={18} /> }],
    },
  ],
};

const SUPPORT_CATEGORIES = [
  "Technical Issue",
  "Login / Access Problem",
  "Attendance Dispute",
  "Missing QR Code",
  "Missing Records",
  "Other",
];

export default function Sidebar({ role, userName, userSub, avatarInitials, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [supportCategory, setSupportCategory] = useState("");
  const [supportDesc, setSupportDesc] = useState("");
  const [copied, setCopied] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutUser();
    window.location.href = "/login";
  };

  function buildSupportEmail() {
    const subject = `PharmaTrack Support: ${supportCategory || "General"} — ${userName}`;
    const body = [
      `Name: ${userName}`,
      `Role: ${userSub}`,
      `Category: ${supportCategory || "Not specified"}`,
      ``,
      `Description:`,
      supportDesc.trim() || "(no description provided)",
      ``,
      `---`,
      `Sent from PharmaTrack Portal`,
    ].join("\n");
    return { subject, body };
  }

  function handleOpenEmail() {
    const { subject, body } = buildSupportEmail();
    const mailtoUrl = `mailto:cdg.solutionsph@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
  }

  async function handleCopyMessage() {
    const { subject, body } = buildSupportEmail();
    const full = `To: cdg.solutionsph@gmail.com\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback for browsers that block clipboard API
      alert(`Copy this and send to cdg.solutionsph@gmail.com:\n\n${full}`);
    }
  }

  function openSupportModal() {
    setSupportCategory("");
    setSupportDesc("");
    setCopied(false);
    setShowSupportModal(true);
  }

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
              PHARMATRACK
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
                  // Items that carry a query string (e.g. the student "Check-In"
                  // link → /dashboard?checkin=true) open a modal rather than a
                  // distinct page, so they should never claim the active state —
                  // otherwise they'd double-highlight alongside "Overview".
                  const hrefPath = item.href.split("?")[0];
                  const hasQuery = item.href.includes("?");
                  const isActive = !hasQuery && (
                    pathname === hrefPath || (
                      hrefPath !== "/dashboard" &&
                      hrefPath !== "/dashboard/admin" &&
                      hrefPath !== "/dashboard/facilitator" &&
                      pathname.startsWith(hrefPath + "/")
                    )
                  );
                  return (
                    <Link
                      key={item.href}
                      href={item.href as any}
                      className={`nav-link${isActive ? " nav-link--active" : ""}`}
                      onClick={onClose}
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
          {(role === "admin" || role === "facilitator") && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)", marginBottom: "8px" }}>
              <div style={{ background: "rgba(255, 255, 255, 0.06)", borderRadius: "50%", padding: "2px", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", flexShrink: 0 }}>
                <img src="/usa.png" alt="USA Logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#ffffff", lineHeight: 1.2, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{userName}</span>
                <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{userSub}</span>
              </div>
            </div>
          )}

          <button className="sidebar-support-btn" onClick={openSupportModal}>
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

      {/* Contact Support Modal */}
      {showSupportModal && (
        <div className="support-overlay" onClick={() => setShowSupportModal(false)}>
          <div className="support-card" onClick={(e) => e.stopPropagation()}>

            {/* Close button */}
            <button className="support-x-btn" onClick={() => setShowSupportModal(false)} aria-label="Close">
              ×
            </button>

            {/* Header */}
            <div className="support-header">
              <div className="support-icon-wrap">
                <HeadphonesIcon size={20} />
              </div>
              <div>
                <h3 className="support-title">Contact Support</h3>
                <p className="support-desc">We'll compose a structured email to our support team.</p>
              </div>
            </div>

            {/* Sender chip */}
            <div className="support-sender-chip">
              <Mail size={13} />
              <span>Sending as <strong>{userName}</strong> · {userSub}</span>
            </div>

            {/* Form */}
            <div className="support-form">
              <div className="support-field">
                <label className="support-field-label">Issue Category</label>
                <select
                  className="support-select"
                  value={supportCategory}
                  onChange={(e) => setSupportCategory(e.target.value)}
                >
                  <option value="">Select a category…</option>
                  {SUPPORT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="support-field">
                <label className="support-field-label">Describe your issue</label>
                <textarea
                  className="support-textarea"
                  placeholder="What happened? What were you trying to do?"
                  value={supportDesc}
                  onChange={(e) => setSupportDesc(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="support-footer">
              <button className="support-cancel-btn" onClick={() => setShowSupportModal(false)}>
                Cancel
              </button>
              <button className="support-send-btn" onClick={handleOpenEmail}>
                <Mail size={14} />
                Send via Email
              </button>
            </div>

            {/* Clipboard fallback */}
            <div className="support-copy-row">
              <span>No email app?</span>
              <button className="support-copy-link" onClick={handleCopyMessage}>
                {copied ? "✓ Copied!" : "Copy message"}
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
          background: linear-gradient(145deg, rgba(30, 20, 50, 0.98), rgba(15, 10, 30, 0.98));
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          width: 100%;
          max-width: 360px;
          padding: 32px 28px 24px;
          text-align: center;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.08);
          animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .logout-title {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff !important;
          margin: 0 0 8px !important;
        }

        .logout-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.75) !important;
          margin: 0 0 24px !important;
          line-height: 1.5;
        }

        .logout-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(220, 38, 38, 0.12);
          border: 1px solid rgba(220, 38, 38, 0.25);
          color: #f87171;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .logout-actions {
          display: flex;
          gap: 10px;
        }

        .logout-cancel-btn {
          flex: 1;
          height: 40px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.85);
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-sans);
        }

        .logout-cancel-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
          color: #ffffff;
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
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .logout-confirm-btn:hover {
          background: #b91c1c;
          box-shadow: 0 0 15px rgba(220, 38, 38, 0.4);
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

