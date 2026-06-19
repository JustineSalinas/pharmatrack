"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { Loader2, Search, CheckCircle, XCircle, UserPlus, ShieldAlert, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";

type FilterRole = "All" | "student" | "facilitator" | "admin";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterRole>("All");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const router = useRouter();

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const u = await getCurrentUser() as any;

      if (!u) {
        // Let root DashboardLayout handle redirect to login to avoid hydration race conditions
        return;
      }

      if (u.account_type !== "admin") {
        // Authenticated but wrong role — send to their own dashboard
        if (u.account_type === "facilitator") {
          router.push("/dashboard/facilitator");
        } else {
          router.push("/dashboard");
        }
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(userId: string, newStatus: string) {
    try {
      const { error } = await (supabase.from("users") as any)
        .update({ status: newStatus })
        .eq("id", userId);

      if (error) throw error;

      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err: any) {
      showToast("Error updating status: " + err.message, "error");
    }
  }

  async function handleResetPassword(email: string, name: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(`Password reset email sent to ${email}.`, "success");
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    }
  }

  const filtered = users.filter(u => {
    const roleMatch = filter === "All" || u.account_type === filter;
    const searchMatch = u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return roleMatch && searchMatch;
  });

  const studentsCount = users.filter(u => u.account_type === "student").length;
  const facilitatorCount = users.filter(u => u.account_type === "facilitator").length;
  const adminsCount = users.filter(u => u.account_type === "admin").length;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 className="animate-spin" size={24} color="var(--dimmed)" />
      </div>
    );
  }

  return (
    <div className="fade-in sd-root">
      {/* Header and Actions in a single row */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Admin Control</p>
          <h1 className="sd-header-title">User Management</h1>
        </div>
        <div className="header-actions" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div className="search-bar-wrap" style={{ position: "relative", width: "260px" }}>
            <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--dimmed)" }} size={14} />
            <input
              className="search-input"
              placeholder="Search by name or email..."
              style={{ paddingLeft: "36px", height: "36px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", width: "100%", fontSize: "13px", outline: "none", transition: "border-color 0.15s ease" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Role Filters - Tab Style */}
      <div style={{ display: "flex", gap: "24px", marginBottom: "24px", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        {(["All", "student", "facilitator", "admin"] as FilterRole[]).map((f) => {
          const count = f === "All" ? users.length : f === "student" ? studentsCount : f === "facilitator" ? facilitatorCount : adminsCount;
          const label = f === "student" ? "Students" : f === "facilitator" ? "Facilitators" : f === "admin" ? "Admins" : "All";
          return (
            <button
              key={f}
              style={{ 
                background: "transparent", 
                border: "none", 
                borderBottom: filter === f ? "2px solid var(--gold)" : "2px solid transparent", 
                color: filter === f ? "var(--white)" : "var(--dimmed)", 
                padding: "0 4px 12px", 
                fontSize: "13px", 
                fontWeight: filter === f ? 500 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "-1px"
              }}
              onClick={() => setFilter(f)}
            >
              {label} 
              <span style={{ 
                fontSize: "11px", 
                background: filter === f ? "rgba(180, 83, 9, 0.08)" : "var(--surface2)", 
                color: filter === f ? "var(--gold)" : "var(--dimmed)",
                padding: "2px 6px", 
                borderRadius: "10px",
                transition: "all 0.15s ease"
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="panel indigo-table-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="attendance-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Profile</th>
                <th>Institutional Email</th>
                <th>Access Level</th>
                <th>Account Status</th>
                <th>Registration Date</th>
                <th style={{ textAlign: "right", paddingRight: "24px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const initials = u.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "U";
                const dateJoined = new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

                return (
                  <tr key={u.id} className="user-row">
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div className="avatar" style={{ width: "32px", height: "32px", fontSize: "12px", fontWeight: 600, flexShrink: 0, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--dimmed)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {u.account_type === "admin" || u.account_type === "facilitator" ? (
                            <img src="/usa.png" alt="USA Logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "2px" }} />
                          ) : (
                            initials
                          )}
                        </div>
                        <span style={{ fontWeight: 500, color: "var(--white)" }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--dimmed)", fontSize: "13px" }}>{u.email}</td>
                    <td style={{ color: "var(--white-shade)", textTransform: "capitalize", fontSize: "13px" }}>
                      {u.account_type}
                    </td>
                    <td>
                      {u.account_type === "facilitator" || u.status !== "approved" ? (
                        <span className={`status-badge ${u.status === 'approved' ? 'present' : u.status === 'pending' ? 'late' : 'absent'}`} style={{ fontSize: "11px", padding: "4px 8px" }}>
                          {u.status.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--dimmed)", fontWeight: 500 }}>Active</span>
                      )}
                    </td>
                    <td style={{ fontSize: "13px", color: "var(--dimmed)" }}>{dateJoined}</td>
                    <td style={{ textAlign: "right", paddingRight: "24px" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        {u.status === "pending" && (
                          <>
                            <button
                              className="action-btn-hover approve-btn"
                              title="Approve User"
                              onClick={() => handleUpdateStatus(u.id, "approved")}
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button
                              className="action-btn-hover reject-btn"
                              title="Reject User"
                              onClick={() => handleUpdateStatus(u.id, "rejected")}
                            >
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                        {u.status === "approved" && u.account_type !== "admin" && (
                          <button
                            className="action-btn-hover suspend-btn"
                            title="Suspend Access"
                            onClick={() => handleUpdateStatus(u.id, "rejected")}
                          >
                            <ShieldAlert size={14} />
                          </button>
                        )}
                        {u.status === "rejected" && (
                          <button
                            className="action-btn-hover restore-btn"
                            title="Restore Access"
                            onClick={() => handleUpdateStatus(u.id, "approved")}
                          >
                            Restore
                          </button>
                        )}
                        {u.account_type !== "student" && (
                          <button
                            className="action-btn-hover reset-btn"
                            title="Reset Password"
                            onClick={() => handleResetPassword(u.email, u.full_name)}
                          >
                            <KeyRound size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "64px 24px", textAlign: "center", color: "var(--dimmed)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 48, height: 48, border: "1px dashed rgba(79, 70, 229, 0.3)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(79, 70, 229, 0.04)" }}>
                <Search size={20} color="var(--dimmed)" />
              </div>
              <p style={{ fontSize: 13, margin: 0 }}>No users found matching your search or filter.</p>
            </div>
          )}
        </div>
      </div>
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          background: toast.type === "success" ? "var(--surface)" : "var(--surface)",
          border: `1px solid ${toast.type === "success" ? "rgba(22,163,74,0.4)" : "rgba(220,38,38,0.4)"}`,
          color: toast.type === "success" ? "#16a34a" : "#dc2626",
          padding: "12px 20px", borderRadius: "var(--radius-sm)", fontSize: "13px",
          fontWeight: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "slideUp 0.3s ease",
        }}>
          {toast.message}
        </div>
      )}
      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .search-input:focus {
          border-color: rgba(0, 0, 0, 0.15) !important;
        }

        .btn-ghost-amber:hover {
          border-color: var(--gold) !important;
          color: var(--gold) !important;
          background: rgba(180, 83, 9, 0.04) !important;
        }

        .indigo-table-panel {
          background: rgba(79, 70, 229, 0.04) !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
        }
        
        .indigo-table-panel :global(.attendance-table) {
          background: transparent !important;
        }

        .indigo-table-panel :global(.attendance-table th) {
          background: rgba(79, 70, 229, 0.09) !important;
          color: var(--gold) !important;
          font-weight: 600 !important;
          border-bottom: 1px solid rgba(79, 70, 229, 0.12) !important;
        }

        .indigo-table-panel :global(.attendance-table td) {
          border-bottom: 1px solid rgba(79, 70, 229, 0.05) !important;
        }

        /* Alternate zebra rows for premium look and easier scanning */
        .indigo-table-panel :global(.attendance-table tr:nth-child(even)) {
          background: rgba(79, 70, 229, 0.02) !important;
        }

        .indigo-table-panel :global(.attendance-table tr:nth-child(odd)) {
          background: rgba(79, 70, 229, 0.005) !important;
        }

        .indigo-table-panel :global(.attendance-table tr:hover) {
          background: rgba(79, 70, 229, 0.07) !important;
        }

        .indigo-table-panel :global(.avatar) {
          background: rgba(79, 70, 229, 0.08) !important;
          border-color: rgba(79, 70, 229, 0.15) !important;
          color: var(--gold) !important;
        }
      `}</style>
    </div>
  );
}
