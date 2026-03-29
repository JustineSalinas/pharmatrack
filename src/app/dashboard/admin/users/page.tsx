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
        <Loader2 className="animate-spin" size={48} color="var(--gold)" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "0.85rem", color: "var(--muted)", letterSpacing: "0.5px", marginBottom: "4px" }}>
            <span>Admin Control</span><span style={{ margin: "0 6px" }}>·</span><span>Users</span>
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>User Management</h2>
          <p style={{ color: "var(--muted)", marginTop: "4px" }}>{users.length} registered accounts in the database</p>
        </div>
        <div className="header-actions">
          <div className="search-bar-wrap" style={{ position: "relative", width: "280px" }}>
            <Search style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} size={18} />
            <input
              className="inp"
              placeholder="Search by name or email..."
              style={{ paddingLeft: "42px", height: "44px", borderRadius: "12px" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-gold" style={{ width: "auto", padding: "0 20px", height: "44px", borderRadius: "12px", gap: "8px" }}>
            <UserPlus size={18} /> Add User
          </button>
        </div>
      </div>

      {/* Role Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "32px", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "12px", color: "var(--muted)", fontSize: "0.9rem" }}>
          <Filter size={16} /> Filter by:
        </div>
        {(["All", "student", "facilitator", "admin"] as FilterRole[]).map((f) => {
          const count = f === "All" ? users.length : f === "student" ? studentsCount : f === "facilitator" ? facilitatorCount : adminsCount;
          const label = f === "student" ? "Students" : f === "facilitator" ? "Facilitators" : f === "admin" ? "Admins" : "All";
          return (
            <button
              key={f}
              className={`btn ${filter === f ? "btn-gold" : "btn-outline"}`}
              style={{ width: "auto", padding: "8px 18px", fontSize: "0.85rem", height: "38px", borderRadius: "10px" }}
              onClick={() => setFilter(f)}
            >
              {label} <span style={{ opacity: 0.6, marginLeft: "6px" }}>{count}</span>
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
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div className="avatar" style={{ width: "36px", height: "36px", fontSize: "14px", flexShrink: 0, background: "var(--surface2)", border: "1px solid var(--gold-dim)" }}>
                          {initials}
                        </div>
                        <span style={{ fontWeight: 700, color: "var(--white)" }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{u.email}</td>
                    <td>
                      <span className="tag" style={{ textTransform: "capitalize", background: "rgba(255,255,255,0.03)", color: "var(--white)" }}>
                        {u.account_type.charAt(0).toUpperCase() + u.account_type.slice(1)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${u.status === 'approved' ? 'present' : u.status === 'pending' ? 'late' : 'absent'}`} style={{ fontSize: "0.75rem", padding: "4px 10px" }}>
                        {u.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{dateJoined}</td>
                    <td style={{ textAlign: "right", paddingRight: "24px" }}>
                      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                        {u.status === "pending" && (
                          <>
                            <button
                              className="btn"
                              style={{ width: "36px", height: "36px", padding: 0, borderRadius: "10px", background: "var(--success)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}
                              onClick={() => handleUpdateStatus(u.id, "approved")}
                              title="Approve User"
                            >
                              <CheckCircle size={18} />
                            </button>
                            <button
                              className="btn"
                              style={{ width: "36px", height: "36px", padding: 0, borderRadius: "10px", background: "var(--danger)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}
                              onClick={() => handleUpdateStatus(u.id, "rejected")}
                              title="Reject User"
                            >
                              <XCircle size={18} />
                            </button>
                          </>
                        )}
                        {u.status === "approved" && u.account_type !== "admin" && (
                          <button
                            className="btn btn-outline"
                            style={{ padding: "6px 12px", width: "auto", fontSize: "0.75rem", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.3)", gap: "6px" }}
                            onClick={() => {
                              if (confirm(`Are you sure you want to suspend access for ${u.full_name}?`)) {
                                handleUpdateStatus(u.id, "rejected");
                              }
                            }}
                          >
                            <ShieldAlert size={14} /> Suspend
                          </button>
                        )}
                        {u.status === "rejected" && (
                          <button
                            className="btn btn-outline"
                            style={{ padding: "6px 12px", width: "auto", fontSize: "0.75rem" }}
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
            <div style={{ padding: "80px", textAlign: "center", color: "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <Search size={48} opacity={0.2} />
              <p>No users found matching your search or filter.</p>
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
