import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted refs (available inside vi.mock factory closures) ───────────────

const { mockDeleteUser, mockGetBackendUser, getUsersById, setUser, clearUsers } = vi.hoisted(() => {
  const usersById: Record<string, { data: unknown; error: unknown }> = {};
  return {
    mockDeleteUser: vi.fn(),
    mockGetBackendUser: vi.fn(),
    getUsersById: () => usersById,
    setUser: (id: string, value: { data: unknown; error: unknown }) => {
      usersById[id] = value;
    },
    clearUsers: () => {
      for (const k of Object.keys(usersById)) delete usersById[k];
    },
  };
});

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  getBackendUser: mockGetBackendUser,
}));

vi.mock("@supabase/supabase-js", () => {
  function buildUsersChain() {
    let lastId: string | undefined;
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (_col: string, val: string) => {
        lastId = val;
        return chain;
      },
      single: () =>
        Promise.resolve(
          getUsersById()[lastId ?? ""] ?? { data: null, error: { message: "not found" } }
        ),
    };
    return chain;
  }

  return {
    createClient: vi.fn(() => ({
      from: (table: string) => {
        if (table === "users") return buildUsersChain();
        throw new Error(`Unexpected table in test: ${table}`);
      },
      auth: {
        admin: { deleteUser: mockDeleteUser },
      },
    })),
  };
});

// ── Import route AFTER mocks are declared ──────────────────────────────────

import { POST } from "@/app/api/admin/delete-account/route";

// ── Helpers ────────────────────────────────────────────────────────────────

const ADMIN_ID = "admin-uuid-1";
const TARGET_ID = "target-uuid-1";

function makeReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/delete-account", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  mockDeleteUser.mockReset();
  mockGetBackendUser.mockReset();
  clearUsers();

  mockGetBackendUser.mockResolvedValue({ id: ADMIN_ID, email: "admin@usa.edu.ph" });
  setUser(ADMIN_ID, { data: { account_type: "admin", status: "approved" }, error: null });
  mockDeleteUser.mockResolvedValue({ error: null });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/admin/delete-account", () => {
  it("returns 401 when there is no authenticated caller", async () => {
    mockGetBackendUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ userId: TARGET_ID }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is not an approved admin", async () => {
    setUser(ADMIN_ID, { data: { account_type: "facilitator", status: "approved" }, error: null });
    const res = await POST(makeReq({ userId: TARGET_ID }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when userId is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the admin tries to delete their own account", async () => {
    const res = await POST(makeReq({ userId: ADMIN_ID }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cannot delete your own account/i);
  });

  it("returns 404 when the target user does not exist", async () => {
    const res = await POST(makeReq({ userId: "nonexistent-uuid" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when the target account is an admin", async () => {
    setUser(TARGET_ID, { data: { account_type: "admin", full_name: "Other Admin" }, error: null });
    const res = await POST(makeReq({ userId: TARGET_ID }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/admin accounts cannot be deleted/i);
  });

  it("returns 200 and deletes a valid student target", async () => {
    setUser(TARGET_ID, { data: { account_type: "student", full_name: "Test Student" }, error: null });
    const res = await POST(makeReq({ userId: TARGET_ID }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(mockDeleteUser).toHaveBeenCalledWith(TARGET_ID);
  });

  it("returns 200 and deletes a valid facilitator target", async () => {
    setUser(TARGET_ID, { data: { account_type: "facilitator", full_name: "Test Facilitator" }, error: null });
    const res = await POST(makeReq({ userId: TARGET_ID }));
    expect(res.status).toBe(200);
    expect(mockDeleteUser).toHaveBeenCalledWith(TARGET_ID);
  });

  it("returns a friendly 409 (not the raw Postgres error) when the target has a foreign-key conflict", async () => {
    setUser(TARGET_ID, { data: { account_type: "facilitator", full_name: "Prof. Jane Doe" }, error: null });
    mockDeleteUser.mockResolvedValueOnce({
      error: {
        code: "23503",
        message:
          'update or delete on table "users" violates foreign key constraint "events_created_by_fkey" on table "events"',
      },
    });
    const res = await POST(makeReq({ userId: TARGET_ID }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/prof\. jane doe/i);
    expect(json.error).toMatch(/created events or recorded attendance/i);
    expect(json.error).not.toMatch(/constraint|violates foreign key/i);
  });
});
