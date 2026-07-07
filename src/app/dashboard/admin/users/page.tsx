"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getAuthHeader } from "@/lib/auth-client";
import { useCurrentUser } from "@/lib/current-user-context";
import { Loader2, Search, CheckCircle, XCircle, UserPlus, ShieldAlert, KeyRound, MailCheck, ChevronUp, ChevronDown, Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

type FilterRole = "All" | "student" | "facilitator" | "admin";
type SortField = "full_name" | "email" | "section" | "current_year";

export default function AdminUsers() {
  const currentUser = useCurrentUser();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterRole>("All");
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [busyActions, setBusyActions] = useState<Set<string>>(new Set());
  const [userToDelete, setUserToDelete] = useState<{ id: string; full_name: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Clearing any previous timeout before scheduling a new one prevents an
  // earlier, slower action's stale timer from wiping out a toast that a
  // later action just set — without this, two actions resolving close
  // together (easy to trigger with no click-guard on the buttons) could
  // make a notification disappear right after it appears, or never
  // visibly render at all.
  function showToast(message: string, type: "success" | "error" = "success") {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  }

  function setActionBusy(key: string, busy: boolean) {
    setBusyActions(prev => {
      const next = new Set(prev);
      if (busy) next.add(key); else next.delete(key);
      return next;
    });
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  useEffect(() => {
    if (currentUser) fetchUsers();
  }, [currentUser]);

  async function fetchUsers() {
    try {
      setLoading(true);
      const u = currentUser as any;

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

      const [{ data, error }, { data: profiles }] = await Promise.all([
        supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase.from("student_profiles").select("user_id, section, current_year"),
      ]);

      if (error) throw error;

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p])
      );

      const merged = (data || []).map((u: any) => ({
        ...u,
        section: profileMap.get(u.id)?.section ?? null,
        current_year: profileMap.get(u.id)?.current_year ?? null,
      }));

      setUsers(merged);
    } catch (err) {
      console.error("Error fetching users", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(userId: string, newStatus: string, name: string, actionLabel: string) {
    const key = `status:${userId}:${newStatus}`;
    if (busyActions.has(key)) return;
    setActionBusy(key, true);
    try {
      const { error } = await (supabase.from("users") as any)
        .update({ status: newStatus })
        .eq("id", userId);

      if (error) throw error;

      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      showToast(`${actionLabel} for ${name}.`, "success");
    } catch (err: any) {
      showToast("Error updating status: " + err.message, "error");
    } finally {
      setActionBusy(key, false);
    }
  }

  async function handleResetPassword(email: string, name: string) {
    const key = `reset:${email}`;
    if (busyActions.has(key)) return;
    setActionBusy(key, true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(`Password reset email sent to ${email}.`, "success");
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    } finally {
      setActionBusy(key, false);
    }
  }

  async function handleForceVerifyEmail(userId: string, email: string) {
    const key = `verify:${userId}`;
    if (busyActions.has(key)) return;
    setActionBusy(key, true);
    try {
      const res = await fetch("/api/admin/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(`Email verified for ${email}.`, "success");
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    } finally {
      setActionBusy(key, false);
    }
  }

  async function handleDeleteAccount() {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch("/api/admin/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({ userId: userToDelete.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setUsers(users.filter(u => u.id !== userToDelete.id));
      showToast(`${userToDelete.full_name}'s account was deleted.`, "success");
      setUserToDelete(null);
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    } finally {
      setIsDeletingUser(false);
    }
  }

  const availableSections = Array.from(new Set(users.map(u => u.section).filter(Boolean))).sort() as string[];
  const availableYears = Array.from(new Set(users.map(u => u.current_year).filter(Boolean))).sort() as string[];

  const filtered = users.filter(u => {
    const roleMatch = filter === "All" || u.account_type === filter;
    const sectionMatch = filterSection === "All" || u.section === filterSection;
    const yearMatch = filterYear === "All" || u.current_year === filterYear;
    const searchMatch = u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return roleMatch && sectionMatch && yearMatch && searchMatch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    const av = a[sortField];
    const bv = b[sortField];
    // nulls (e.g. section/current_year on facilitator/admin rows) always sort last
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
    return sortDirection === "asc" ? cmp : -cmp;
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
      <div style={{ display: "flex", gap: "24px", marginBottom: "24px", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
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

        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ height: "24px", width: "1px", background: "var(--border)", margin: "0 8px" }} />
          <select
            className="search-input select-input"
            style={{ width: "auto", minWidth: "140px", height: "36px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", fontSize: "13px", padding: "0 12px", outline: "none", cursor: "pointer" }}
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
          >
            <option value="All">All Sections</option>
            {availableSections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className="search-input select-input"
            style={{ width: "auto", minWidth: "140px", height: "36px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", fontSize: "13px", padding: "0 12px", outline: "none", cursor: "pointer" }}
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            <option value="All">All Year Levels</option>
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="panel indigo-table-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="attendance-table" style={{ width: "100%", minWidth: "1100px" }}>
            <thead>
              <tr>
                <th className="sortable-th" style={{ cursor: "pointer" }} onClick={() => handleSort("full_name")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    Profile {sortField === "full_name" && (sortDirection === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                  </span>
                </th>
                <th className="sortable-th" style={{ cursor: "pointer" }} onClick={() => handleSort("email")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    Institutional Email {sortField === "email" && (sortDirection === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                  </span>
                </th>
                <th>Access Level</th>
                <th className="sortable-th" style={{ cursor: "pointer" }} onClick={() => handleSort("section")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    Section {sortField === "section" && (sortDirection === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                  </span>
                </th>
                <th className="sortable-th" style={{ cursor: "pointer" }} onClick={() => handleSort("current_year")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    Year Level {sortField === "current_year" && (sortDirection === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                  </span>
                </th>
                <th>Account Status</th>
                <th>Registration Date</th>
                <th style={{ textAlign: "right", paddingRight: "24px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
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
                    <td style={{ color: "var(--dimmed)", fontSize: "13px" }}>{u.section || "—"}</td>
                    <td style={{ color: "var(--dimmed)", fontSize: "13px" }}>{u.current_year || "—"}</td>
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
                              data-tooltip="Approve User"
                              aria-label="Approve User"
                              disabled={busyActions.has(`status:${u.id}:approved`)}
                              onClick={() => handleUpdateStatus(u.id, "approved", u.full_name, "User approved")}
                            >
                              {busyActions.has(`status:${u.id}:approved`) ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                            </button>
                            <button
                              className="action-btn-hover reject-btn"
                              data-tooltip="Reject User"
                              aria-label="Reject User"
                              disabled={busyActions.has(`status:${u.id}:rejected`)}
                              onClick={() => handleUpdateStatus(u.id, "rejected", u.full_name, "User rejected")}
                            >
                              {busyActions.has(`status:${u.id}:rejected`) ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                            </button>
                          </>
                        )}
                        {u.status === "approved" && u.account_type !== "admin" && (
                          <button
                            className="action-btn-hover suspend-btn"
                            data-tooltip="Suspend Access"
                            aria-label="Suspend Access"
                            disabled={busyActions.has(`status:${u.id}:rejected`)}
                            onClick={() => handleUpdateStatus(u.id, "rejected", u.full_name, "Access suspended")}
                          >
                            {busyActions.has(`status:${u.id}:rejected`) ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                          </button>
                        )}
                        {u.status === "rejected" && (
                          <button
                            className="action-btn-hover restore-btn"
                            data-tooltip="Restore Access"
                            aria-label="Restore Access"
                            disabled={busyActions.has(`status:${u.id}:approved`)}
                            onClick={() => handleUpdateStatus(u.id, "approved", u.full_name, "Access restored")}
                          >
                            {busyActions.has(`status:${u.id}:approved`) ? <Loader2 size={13} className="animate-spin" /> : "Restore"}
                          </button>
                        )}
                        <button
                          className="action-btn-hover reset-btn"
                          data-tooltip="Reset Password"
                          aria-label="Reset Password"
                          disabled={busyActions.has(`reset:${u.email}`)}
                          onClick={() => handleResetPassword(u.email, u.full_name)}
                        >
                          {busyActions.has(`reset:${u.email}`) ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                        </button>
                        <button
                          className="action-btn-hover verify-btn"
                          data-tooltip="Force Verify Email"
                          aria-label="Force Verify Email"
                          disabled={busyActions.has(`verify:${u.id}`)}
                          onClick={() => handleForceVerifyEmail(u.id, u.email)}
                        >
                          {busyActions.has(`verify:${u.id}`) ? <Loader2 size={13} className="animate-spin" /> : <MailCheck size={13} />}
                        </button>
                        {u.account_type !== "admin" && (
                          <button
                            className="action-btn-hover delete-btn"
                            data-tooltip="Delete Account"
                            aria-label="Delete Account"
                            onClick={() => setUserToDelete({ id: u.id, full_name: u.full_name })}
                          >
                            <Trash2 size={13} />
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
      {userToDelete && (
        <div className="modal-overlay" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000,
          padding: "20px", paddingTop: "15vh"
        }}>
          <div className="modal-card" style={{
            width: "100%", maxWidth: "480px",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "12px", padding: "28px", position: "relative",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--danger)", flexShrink: 0 }}>
                <AlertTriangle size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--white)", marginBottom: "8px" }}>Delete Account</h3>
                <p style={{ color: "var(--dimmed)", fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
                  Are you sure you want to delete <strong>{userToDelete.full_name}</strong>&apos;s account? This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="btn-ghost"
                style={{ padding: "0 16px", height: "36px", fontSize: "13px", fontWeight: 500, borderRadius: "var(--radius-sm)", color: "var(--white-shade)", border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", transition: "all 0.15s ease" }}
                disabled={isDeletingUser}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="btn-danger"
                style={{ padding: "0 20px", height: "36px", fontSize: "13px", fontWeight: 600, borderRadius: "var(--radius-sm)", color: "#fff", background: "var(--danger)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", opacity: isDeletingUser ? 0.7 : 1, transition: "all 0.15s ease" }}
                disabled={isDeletingUser}
              >
                {isDeletingUser ? (
                  <><Loader2 size={14} className="animate-spin" /> Deleting...</>
                ) : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
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

        .action-btn-hover:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }
        
        .search-input:focus {
          border-color: rgba(0, 0, 0, 0.15) !important;
        }

        .sortable-th:hover {
          color: var(--gold) !important;
          cursor: pointer;
        }

        .table-wrap {
          overflow-x: auto;
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
