"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { Loader2, Search, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type FilterRole = "All" | "student" | "faculty" | "admin";

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
      const u = await getCurrentUser();
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
      const { error } = await supabase
        .from("users")
        .update({ status: newStatus })
        .eq("id", userId);

      if (error) throw error;
      
      // Update local state without refetching fully
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
  const facultyCount = users.filter(u => u.account_type === "faculty").length;
  const adminsCount = users.filter(u => u.account_type === "admin").length;

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <Loader2 className="animate-spin" size={48} color="var(--gold)" />
    </div>;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Admin</span><span>›</span><span>Users</span></div>
          <h2>User Management</h2>
          <p>{users.length} total registered accounts</p>
        </div>
        <div className="header-actions">
          <div className="input-wrap" style={{ display: "flex", alignItems: "center", background: "var(--surface2)", borderRadius: "8px", padding: "0 12px", width: "250px" }}>
            <Search size={16} color="var(--muted)" />
            <input 
              className="inp" 
              placeholder="Search names or emails..." 
              style={{ border: "none", background: "transparent", padding: "10px", width: "100%", outline: "none" }} 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["All", "student", "faculty", "admin"] as FilterRole[]).map((f) => {
          const count = f === "All" ? users.length : f === "student" ? studentsCount : f === "faculty" ? facultyCount : adminsCount;
          const label = f === "student" ? "Students" : f === "faculty" ? "Faculty" : f === "admin" ? "Admins" : "All";
          return (
            <button key={f} className={`btn ${filter === f ? "btn-gold" : "btn-outline"}`} style={{ width: "auto", padding: "7px 18px", fontSize: 13, textTransform: "capitalize" }} onClick={() => setFilter(f)}>
              {label} ({count})
            </button>
          );
        })}
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const initials = u.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "U";
                const dateJoined = new Date(u.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric", day: "numeric" });
                
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="avatar" style={{ width: 30, height: 30, fontSize: 12, flexShrink: 0 }}>
                          {initials}
                        </div>
                        <span style={{ fontWeight: 600 }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>{u.email}</td>
                    <td><span className="tag" style={{ textTransform: "capitalize", background: "rgba(255,255,255,0.05)" }}>{u.account_type}</span></td>
                    <td>
                      <span className={`badge badge-${u.status === "approved" ? "present" : u.status === "pending" ? "late" : "absent"}`} style={{ textTransform: "capitalize" }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{dateJoined}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {u.status === "pending" && (
                          <button 
                            className="btn" 
                            style={{ width: "auto", padding: "4px 10px", fontSize: 11, background: "#10b981", color: "white", border: "1px solid #059669" }}
                            onClick={() => handleUpdateStatus(u.id, "approved")}
                            title="Approve Account"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {u.status === "pending" && (
                          <button 
                            className="btn" 
                            style={{ width: "auto", padding: "4px 10px", fontSize: 11, background: "#ef4444", color: "white", border: "1px solid #b91c1c" }}
                            onClick={() => handleUpdateStatus(u.id, "rejected")}
                            title="Reject Account"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                        {u.status === "approved" && u.account_type !== "student" && (
                          <button 
                           className="btn btn-danger" 
                           style={{ width: "auto", padding: "4px 10px", fontSize: 11 }}
                           onClick={() => {
                             if (confirm(`Suspend access for ${u.full_name}?`)) {
                               handleUpdateStatus(u.id, "rejected");
                             }
                           }}
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
            No users found matching your search.
          </div>
        )}
      </div>

      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
