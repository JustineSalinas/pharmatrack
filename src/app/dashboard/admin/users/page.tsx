"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { Loader2, Search, CheckCircle, XCircle, UserPlus, ShieldAlert, Filter } from "lucide-react";
import { useRouter } from "next/navigation";

type FilterRole = "All" | "student" | "facilitator" | "admin";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterRole>("All");
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const u = await getCurrentUser() as any;
      if (!u || u.account_type !== "admin") {
        router.push("/dashboard");
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
      alert("Error updating status: " + err.message);
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
    <div className="fade-in">
      {/* Header and Actions in a single row */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "var(--dimmed)", letterSpacing: "0.06em", marginBottom: "8px" }}>
            <span>Admin Control</span><span style={{ margin: "0 8px" }}>/</span><span>Users</span>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.03em", color: "var(--white)" }}>User Management</h2>
          <p style={{ color: "var(--dimmed)", fontSize: "13px", marginTop: "4px", margin: 0 }}>{users.length} registered accounts in the database</p>
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
          <button 
            className="btn-ghost-amber"
            style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white-shade)", fontSize: "13px", fontWeight: 500, cursor: "pointer", gap: "6px", transition: "all 0.15s ease" }}
          >
            <UserPlus size={14} /> Add User
          </button>
        </div>
      </div>

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
                background: filter === f ? "rgba(232,184,75,0.1)" : "var(--surface2)", 
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
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
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
                        <div className="avatar" style={{ width: "32px", height: "32px", fontSize: "12px", fontWeight: 600, flexShrink: 0, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--dimmed)" }}>
                          {initials}
                        </div>
                        <span style={{ fontWeight: 500, color: "var(--white)" }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--dimmed)", fontSize: "13px" }}>{u.email}</td>
                    <td style={{ color: "var(--white-shade)", textTransform: "capitalize", fontSize: "13px" }}>
                      {u.account_type}
                    </td>
                    <td>
                      <span className={`status-badge ${u.status === 'approved' ? 'present' : u.status === 'pending' ? 'late' : 'absent'}`} style={{ fontSize: "11px", padding: "4px 8px" }}>
                        {u.status.toUpperCase()}
                      </span>
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
                            onClick={() => {
                              if (confirm(`Are you sure you want to suspend access for ${u.full_name}?`)) {
                                handleUpdateStatus(u.id, "rejected");
                              }
                            }}
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "64px 24px", textAlign: "center", color: "var(--dimmed)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 48, height: 48, border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Search size={20} color="var(--dimmed)" />
              </div>
              <p style={{ fontSize: 13, margin: 0 }}>No users found matching your search or filter.</p>
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .search-input:focus {
          border-color: rgba(255,255,255,0.15) !important;
        }

        .btn-ghost-amber:hover {
          border-color: var(--gold) !important;
          color: var(--gold) !important;
          background: rgba(232,184,75,0.05) !important;
        }

        .user-row {
          transition: background 0.15s ease;
        }
        .user-row:hover {
          background: var(--surface2);
        }

        .action-btn-hover {
          background: transparent;
          border: 1px solid transparent;
          color: var(--dimmed);
          cursor: pointer;
          padding: 6px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.15s ease;
          font-size: 11px;
          font-family: var(--font-sans);
          font-weight: 500;
        }
        .user-row:hover .action-btn-hover {
          opacity: 1;
        }
        
        /* Always show if it's pending so admin doesn't miss it */
        .user-row .approve-btn, .user-row .reject-btn {
           opacity: 1;
           border: 1px solid var(--border);
        }

        .suspend-btn:hover, .reject-btn:hover {
          color: var(--danger);
          background: rgba(248, 113, 113, 0.1);
          border-color: rgba(248, 113, 113, 0.2);
        }

        .approve-btn:hover, .restore-btn:hover {
          color: var(--success);
          background: rgba(74, 222, 128, 0.1);
          border-color: rgba(74, 222, 128, 0.2);
        }
      `}</style>
    </div>
  );
}
