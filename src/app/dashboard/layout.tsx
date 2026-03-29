"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logoutUser, getCurrentUser } from "@/lib/auth-client";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const u = await getCurrentUser();
        if (!u) {
          router.push("/login");
          return;
        }
        setUser(u);
      } catch (err) {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  const handleLogout = async () => {
    await logoutUser();
    router.push("/login");
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg)", color: "var(--gold)" }}>
        <div className="loader">Loading Portal...</div>
      </div>
    );
  }

  // If Admin is pending, show restricted view
  if (user?.account_type === "admin" && user?.status === "pending") {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
        <div className="card" style={{ maxWidth: "500px" }}>
          <h2 style={{ color: "var(--gold)" }}>Approval Pending</h2>
          <p style={{ margin: "20px 0" }}>Your admin account is currently awaiting verification by the Department Head. You will be granted full access once approved.</p>
          <button onClick={handleLogout} className="btn btn-outline" style={{ width: "100%" }}>Log Out</button>
        </div>
      </div>
    );
  }

  const role = user?.account_type || "student";
  const userName = user?.full_name || "User";
  const userSub = role === "admin" ? "System Admin" : role === "facilitator" ? "Facilitator" : "Student";
  const avatarInitials = typeof userName === "string" ? userName.substring(0, 2).toUpperCase() : "U";

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

      {/* Wrapping Sidebar in a div that controls mobile open state if needed */}
      <div className={`sidebar-wrapper ${sidebarOpen ? "open" : ""}`}>
        <Sidebar
          role={role as any}
          userName={userName}
          userSub={userSub}
          avatarInitials={avatarInitials}
        />
      </div>

      {/* Mobile Overlay — only renders when sidebar is open to handle closing without broad listeners */}
      {sidebarOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)"
          }}
        />
      )}

      <main className="main-content page-enter">
        {children}
      </main>
    </div>
  );
}
