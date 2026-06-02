"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logoutUser, getCurrentUser, getAuthUser } from "@/lib/auth-client";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import type { PharmaUser, StudentProfile, FacilitatorProfile } from "@/lib/schema";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<
    | (PharmaUser & { student_profiles: StudentProfile | null })
    | (PharmaUser & { facilitator_profiles: FacilitatorProfile | null })
    | PharmaUser
    | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const authUser = await getAuthUser();
        if (!authUser) {
          router.push("/login");
          return;
        }

        const u = await getCurrentUser();
        if (!u) {
          console.log("Dashboard layout: User authenticated but no profile, redirecting to onboarding.");
          router.push("/onboarding");
          return;
        }
        console.log("Dashboard layout: User loaded successfully:", u.email);
        setUser(u);
      } catch (err: any) {
        console.error("Dashboard layout: Error loading user:", err.message);
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

  // If Admin is pending or rejected, show restricted view
  if (user?.account_type === "admin" && user?.status !== "approved") {
    const isRejected = user?.status === "rejected";
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
        <div className="card" style={{ maxWidth: "500px" }}>
          <h2 style={{ color: isRejected ? "var(--danger)" : "var(--gold)" }}>
            {isRejected ? "Account Rejected" : "Approval Pending"}
          </h2>
          <p style={{ margin: "20px 0" }}>
            {isRejected
              ? "Your administrator account has been rejected. Please contact the Department Head for more information."
              : "Your admin account is currently awaiting verification by the Department Head. You will be granted full access once approved."}
          </p>
          <button onClick={handleLogout} className="btn btn-outline" style={{ width: "100%" }}>Log Out</button>
        </div>
      </div>
    );
  }

  // If Facilitator is pending or rejected, show restricted view
  if (user?.account_type === "facilitator" && user?.status !== "approved") {
    const isRejected = user?.status === "rejected";
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
        <div className="card" style={{ maxWidth: "500px" }}>
          <h2 style={{ color: isRejected ? "var(--danger)" : "var(--gold)" }}>
            {isRejected ? "Account Rejected" : "Pending Approval"}
          </h2>
          <p style={{ margin: "20px 0" }}>
            {isRejected
              ? "Your facilitator account has been rejected. Please contact the System Administrator for more information."
              : "Your facilitator account is currently awaiting approval by the System Administrator. You will be granted access once approved."}
          </p>
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
      {/* Mobile toggle FAB */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="mobile-menu-btn"
        aria-label={sidebarOpen ? "Close menu" : "Open menu"}
      >
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Wrapping Sidebar in a div that controls mobile open state if needed */}
      <div className={`sidebar-wrapper ${sidebarOpen ? "open" : ""}`}>
        <Sidebar
          role={role as any}
          userName={userName}
          userSub={userSub}
          avatarInitials={avatarInitials}
          onClose={() => setSidebarOpen(false)}
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
