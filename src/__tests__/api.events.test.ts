import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted refs (available inside vi.mock factory closures) ─────────────────

const { mockGetBackendUser, mockSendEventBroadcast, getTableResults } = vi.hoisted(() => {
  const tableResults: Record<string, { data: unknown; error: unknown }> = {};

  return {
    mockGetBackendUser: vi.fn(),
    mockSendEventBroadcast: vi.fn(),
    getTableResults: () => tableResults,
  };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  getBackendUser: mockGetBackendUser,
}));

vi.mock("@/lib/email", () => ({
  sendEventBroadcast: mockSendEventBroadcast,
}));

vi.mock("@supabase/supabase-js", () => {
  function buildChain(table: string) {
    const result = () => getTableResults()[table] ?? { data: null, error: null };

    const chain: Record<string, unknown> = {};

    chain.select = () => chain;
    chain.eq = () => chain;
    chain.ilike = () => chain;
    chain.in = () => chain;
    chain.single = () => Promise.resolve(result());

    chain.insert = () => ({
      select: () => ({
        single: () => Promise.resolve(result()),
      }),
    });

    return chain;
  }

  return {
    createClient: vi.fn(() => ({
      from: (table: string) => buildChain(table),
    })),
  };
});

// ── Import route AFTER mocks are declared ────────────────────────────────────

import { POST } from "@/app/api/events/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function setTable(table: string, value: { data: unknown; error: unknown }) {
  getTableResults()[table] = value;
}

function clearTables() {
  const t = getTableResults();
  for (const k of Object.keys(t)) delete t[k];
}

function makeReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const VALID_EVENT_BODY = {
  name: "PharmaTrack Integration Test Event",
  location: "USA Main Hall",
  date: "2026-08-01",
  check_in_start: "08:00",
  check_in_late: "08:30",
  check_in_end: "09:00",
  event_type: "Academic",
  target_year_levels: ["1st Year", "2nd Year"],
};

const APPROVED_FACILITATOR = {
  account_type: "facilitator",
  status: "approved",
  email: "facilitator@usa.edu.ph",
};

const APPROVED_ADMIN = {
  account_type: "admin",
  status: "approved",
  email: "admin@usa.edu.ph",
};

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockGetBackendUser.mockReset();
  mockSendEventBroadcast.mockReset();
  clearTables();

  mockGetBackendUser.mockResolvedValue({ id: "facilitator-uuid-123" });
  setTable("users", { data: APPROVED_FACILITATOR, error: null });
  setTable("events", {
    data: { id: "event-uuid-456", ...VALID_EVENT_BODY, created_by: "facilitator-uuid-123" },
    error: null,
  });
  mockSendEventBroadcast.mockResolvedValue(undefined);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/events", () => {

  // ── Authentication ────────────────────────────────────────────────────────

  it("returns 401 when there is no session", async () => {
    mockGetBackendUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq(VALID_EVENT_BODY));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/unauthorized/i);
  });

  // ── Authorisation ─────────────────────────────────────────────────────────

  it("returns 403 when caller is a student", async () => {
    setTable("users", {
      data: { account_type: "student", status: "approved", email: "student@usa.edu.ph" },
      error: null,
    });
    const res = await POST(makeReq(VALID_EVENT_BODY));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/facilitator|admin/i);
  });

  it("returns 403 when facilitator status is pending", async () => {
    setTable("users", {
      data: { account_type: "facilitator", status: "pending", email: "new@usa.edu.ph" },
      error: null,
    });
    const res = await POST(makeReq(VALID_EVENT_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 403 when facilitator status is suspended", async () => {
    setTable("users", {
      data: { account_type: "facilitator", status: "suspended", email: "suspended@usa.edu.ph" },
      error: null,
    });
    const res = await POST(makeReq(VALID_EVENT_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller profile cannot be fetched from DB", async () => {
    setTable("users", { data: null, error: { code: "PGRST116", message: "not found" } });
    const res = await POST(makeReq(VALID_EVENT_BODY));
    expect(res.status).toBe(403);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 when event name is missing", async () => {
    const { name: _, ...body } = VALID_EVENT_BODY;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing required/i);
  });

  it("returns 400 when location is missing", async () => {
    const { location: _, ...body } = VALID_EVENT_BODY;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when date is missing", async () => {
    const { date: _, ...body } = VALID_EVENT_BODY;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when check_in_start is missing", async () => {
    const { check_in_start: _, ...body } = VALID_EVENT_BODY;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when check_in_late is missing", async () => {
    const { check_in_late: _, ...body } = VALID_EVENT_BODY;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when check_in_end is missing", async () => {
    const { check_in_end: _, ...body } = VALID_EVENT_BODY;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{{not-json",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid json/i);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("returns 200 and the new event for an approved facilitator", async () => {
    const res = await POST(makeReq(VALID_EVENT_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.event).toBeDefined();
    expect(json.event.id).toBe("event-uuid-456");
  });

  it("returns 200 when an approved admin creates an event", async () => {
    setTable("users", { data: APPROVED_ADMIN, error: null });
    const res = await POST(makeReq(VALID_EVENT_BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("returns 200 when target_year_levels is empty (all years)", async () => {
    const body = { ...VALID_EVENT_BODY, target_year_levels: [] };
    const res = await POST(makeReq(body));
    expect(res.status).toBe(200);
  });

  it("returns 200 when event_type is omitted (optional field)", async () => {
    const { event_type: _, ...body } = VALID_EVENT_BODY;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(200);
  });

  // ── DB failure ────────────────────────────────────────────────────────────

  it("returns 500 when the events DB insert fails", async () => {
    setTable("events", { data: null, error: { code: "DB_ERR", message: "insert failed" } });
    const res = await POST(makeReq(VALID_EVENT_BODY));
    expect(res.status).toBe(500);
  });

  // ── Broadcast resilience ──────────────────────────────────────────────────

  it("still returns 200 even when broadcast throws (fire-and-forget resilience)", async () => {
    mockSendEventBroadcast.mockRejectedValueOnce(new Error("SMTP timeout"));
    const res = await POST(makeReq(VALID_EVENT_BODY));
    expect(res.status).toBe(200);
  });

});
