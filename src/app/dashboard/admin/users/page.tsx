"use client";
import { useState } from "react";

const users = [
  { name: "Juan Dela Cruz", email: "j.delacruz@usa.edu.ph", role: "Student", status: "Active", joined: "Jan 2026" },
  { name: "Dr. Maria Reyes", email: "m.reyes@usa.edu.ph", role: "Faculty", status: "Active", joined: "Aug 2024" },
  { name: "Ana Santos", email: "a.santos@usa.edu.ph", role: "Student", status: "Active", joined: "Jan 2026" },
  { name: "Prof. Carlos Santos", email: "c.santos@usa.edu.ph", role: "Faculty", status: "Active", joined: "Aug 2023" },
  { name: "Clara Tan", email: "c.tan@usa.edu.ph", role: "Student", status: "Inactive", joined: "Jan 2026" },
  { name: "Ben Cruz", email: "b.cruz@usa.edu.ph", role: "Student", status: "Active", joined: "Jan 2026" },
  { name: "Dr. Joel Mendez", email: "j.mendez@usa.edu.ph", role: "Faculty", status: "Active", joined: "Jun 2022" },
];

type FilterRole = "All" | "Students" | "Faculty" | "Admins";

export default function AdminUsers() {
  const [filter, setFilter] = useState<FilterRole>("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = users.filter(u => {
    const roleMatch = filter === "All" || (filter === "Students" && u.role === "Student") || (filter === "Faculty" && u.role === "Faculty") || filter === "Admins";
    const searchMatch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return roleMatch && searchMatch;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Admin</span><span>›</span><span>Users</span></div>
          <h2>User Management</h2>
          <p>{users.length} total accounts</p>
        </div>
        <div className="header-actions">
          <input className="inp" placeholder="🔍 Search..." style={{ width: 200, padding: "9px 14px", fontSize: 13 }} value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-gold" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }} onClick={() => setShowAdd(true)}>+ Add User</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["All", "Students", "Faculty", "Admins"] as FilterRole[]).map((f) => (
          <button key={f} className={`btn ${filter === f ? "btn-gold" : "btn-outline"}`} style={{ width: "auto", padding: "7px 18px", fontSize: 13 }} onClick={() => setFilter(f)}>
            {f} {f === "All" ? `(${users.length})` : f === "Students" ? `(${users.filter(u => u.role === "Student").length})` : f === "Faculty" ? `(${users.filter(u => u.role === "Faculty").length})` : "(2)"}
          </button>
        ))}
      </div>

      <div className="panel">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.email}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="avatar" style={{ width: 30, height: 30, fontSize: 12, flexShrink: 0 }}>
                      {u.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    {u.name}
                  </div>
                </td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{u.email}</td>
                <td><span className="tag">{u.role}</span></td>
                <td><span className={`badge badge-${u.status === "Active" ? "present" : "absent"}`}>{u.status}</span></td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{u.joined}</td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost" style={{ width: "auto", padding: "4px 10px", fontSize: 11 }}>Edit</button>
                    <button className="btn btn-danger" style={{ width: "auto", padding: "4px 10px", fontSize: 11 }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add user modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: "left" }}>
            <h3 style={{ marginBottom: 20 }}>Add New User</h3>
            <div className="input-group"><label>Full Name</label><div className="input-wrap"><span className="icon">👤</span><input className="inp" placeholder="Full Name" /></div></div>
            <div className="input-group"><label>Email</label><div className="input-wrap"><span className="icon">✉️</span><input className="inp" type="email" placeholder="email@usa.edu.ph" /></div></div>
            <div className="input-group">
              <label>Role</label>
              <div className="input-wrap select-wrap"><select className="inp"><option>Student</option><option>Faculty</option><option>Admin</option></select></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button className="btn btn-gold" onClick={() => setShowAdd(false)}>Create User</button>
              <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
