import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

// ── Hoisted refs (available inside vi.mock factory closures) ───────────────

const { mockSignUp, mockDeleteUser, mockGetBackendUser, getTableResults } = vi.hoisted(() => {
  const tableResults: Record<string, { data: unknown; error: unknown }> = {};

  return {
    mockSignUp: vi.fn(),
    mockDeleteUser: vi.fn(),
    mockGetBackendUser: vi.fn(),
    getTableResults: () => tableResults,
  };
});

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  getBackendUser: mockGetBackendUser,
}));

vi.mock("@supabase/supabase-js", () => {
  function makeInsertReturn(result: { data: unknown; error: unknown }) {
    const p = Promise.resolve(result) as any;
    p.select = () => ({ single: () => Promise.resolve(result) });
    return p;
  }

  function buildChain(table: string) {
    const result = () => getTableResults()[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      single: () => Promise.resolve(result()),
      insert: () => makeInsertReturn(result()),
      upsert: () => Promise.resolve(result()),
    };
    return chain;
  }

  return {
    createClient: vi.fn(() => ({
      from: (table: string) => buildChain(table),
      auth: {
        signUp: mockSignUp,
        admin: { deleteUser: mockDeleteUser },
      },
    })),
  };
});

// ── Import route AFTER mocks are declared ──────────────────────────────────

import { POST } from "@/app/api/auth/register/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function setTable(table: string, value: { data: unknown; error: unknown }) {
  getTableResults()[table] = value;
}

function clearTables() {
  const t = getTableResults();
  for (const k of Object.keys(t)) delete t[k];
}

function makeReq(body: unknown, extraHeaders?: Record<string, string>): NextRequest {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost", ...extraHeaders },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const VALID_STUDENT_BODY = {
  email: "student@usa.edu.ph",
  password: "SecurePass1!",
  full_name: "Test Student",
  account_type: "student",
  student_profile: {
    student_id_number: "USA-2026-0001",
    section: "PH 1A",
    current_year: "1st Year",
  },
};

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSignUp.mockReset();
  mockDeleteUser.mockReset();
  mockGetBackendUser.mockReset();
  clearTables();

  mockSignUp.mockResolvedValue({
    data: { user: { id: "user-uuid-123", identities: [{ id: "identity-1" }] } },
    error: null,
  });
  mockDeleteUser.mockResolvedValue({ error: null });
  mockGetBackendUser.mockResolvedValue(null);

  setTable("users", { data: { id: "user-uuid-123" }, error: null });
  setTable("student_profiles", { data: {}, error: null });
  setTable("facilitator_profiles", { data: {}, error: null });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  // ── Validation ─────────────────────────────────────────────────────────

  it("returns 400 when email is missing", async () => {
    const { email: _, ...body } = VALID_STUDENT_BODY;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing required/i);
  });

  it("returns 400 when full_name is missing", async () => {
    const body = { ...VALID_STUDENT_BODY, full_name: undefined };
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid account_type", async () => {
    const body = { ...VALID_STUDENT_BODY, account_type: "hacker" };
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid account type/i);
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const body = { ...VALID_STUDENT_BODY, password: "short" };
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/8 characters/i);
  });

  it("returns 400 when student_profile fields are missing", async () => {
    const body = { ...VALID_STUDENT_BODY, student_profile: { student_id_number: "USA-001" } };
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing student profile/i);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid json/i);
  });

  // ── Duplicate / phantom user ────────────────────────────────────────────

  it("returns 409 when Supabase returns phantom user (empty identities)", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "ghost-uuid", identities: [] } },
      error: null,
    });
    const res = await POST(makeReq(VALID_STUDENT_BODY));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already registered/i);
  });

  it("returns 409 when DB insert hits foreign-key conflict (code 23503)", async () => {
    setTable("users", { data: null, error: { code: "23503", message: "fk violation" } });
    const res = await POST(makeReq(VALID_STUDENT_BODY));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already registered/i);
  });

  // ── Auth errors ─────────────────────────────────────────────────────────

  it("returns 429 when Supabase signUp returns a rate-limit error", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "rate limit exceeded" },
    });
    const res = await POST(makeReq(VALID_STUDENT_BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/slow down|wait/i);
  });

  it("returns 400 when Supabase signUp returns a generic auth error", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "unexpected auth failure" },
    });
    const res = await POST(makeReq(VALID_STUDENT_BODY));
    expect(res.status).toBe(400);
  });

  // ── Security: userId ownership check ───────────────────────────────────

  it("returns 401 when userId is provided without password and no session exists", async () => {
    const body = {
      email: "student@usa.edu.ph",
      full_name: "Test Student",
      account_type: "student",
      userId: "some-user-uuid",
      student_profile: VALID_STUDENT_BODY.student_profile,
    };
    const res = await POST(makeReq(body));
    expect(mockGetBackendUser).toHaveBeenCalledOnce();
    expect(res.status).toBe(401);
  });

  it("returns 401 when userId is provided without password and session belongs to a different user", async () => {
    mockGetBackendUser.mockResolvedValueOnce({ id: "different-user-uuid" });
    const body = {
      email: "student@usa.edu.ph",
      full_name: "Test Student",
      account_type: "student",
      userId: "victim-user-uuid",
      student_profile: VALID_STUDENT_BODY.student_profile,
    };
    const res = await POST(makeReq(body));
    expect(mockGetBackendUser).toHaveBeenCalledOnce();
    expect(res.status).toBe(401);
  });

  it("proceeds when userId matches the session user (onboarding flow)", async () => {
    const userId = "oauth-user-uuid-abc";
    mockGetBackendUser.mockResolvedValueOnce({ id: userId });
    setTable("users", { data: { id: userId }, error: null });
    setTable("student_profiles", { data: {}, error: null });

    const body = {
      email: "student@usa.edu.ph",
      full_name: "Test Student",
      account_type: "student",
      userId,
      student_profile: VALID_STUDENT_BODY.student_profile,
    };
    const res = await POST(makeReq(body));
    expect(mockGetBackendUser).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.userId).toBe(userId);
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it("returns 200 and userId for valid student registration", async () => {
    const res = await POST(makeReq(VALID_STUDENT_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.userId).toBe("user-uuid-123");
  });

  it("returns 200 for valid facilitator registration", async () => {
    const body = {
      email: "facilitator@usa.edu.ph",
      password: "SecurePass1!",
      full_name: "Test Facilitator",
      account_type: "facilitator",
    };
    const res = await POST(makeReq(body));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  // ── Orphan cleanup ──────────────────────────────────────────────────────

  it("calls deleteUser to clean up auth user when DB insert fails", async () => {
    setTable("users", { data: null, error: { code: "DB_DOWN", message: "db error" } });
    await POST(makeReq(VALID_STUDENT_BODY));
    expect(mockDeleteUser).toHaveBeenCalledWith("user-uuid-123");
  });
});

// ── Security: cleanup route deleted ────────────────────────────────────────

describe("Security: /api/auth/cleanup", () => {
  it("route file has been deleted and does not exist", () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const routePath = resolve(testDir, "../../app/api/auth/cleanup/route.ts");
    const { existsSync } = require("fs");
    expect(existsSync(routePath)).toBe(false);
  });
});
