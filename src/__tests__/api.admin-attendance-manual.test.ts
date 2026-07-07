import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  getBackendUser: vi.fn(),
}));

const mockInsertRecord = vi.fn();

// Per-table QUEUE of results, consumed in order by successive .single() calls
// on that table — needed because this route queries "users" twice (caller
// profile, then student profile) with different expected shapes.
let tableQueues: Record<string, Array<{ data: unknown; error: unknown }>> = {};

function nextResult(table: string) {
  const queue = tableQueues[table];
  if (queue && queue.length > 0) return queue.shift()!;
  return { data: null, error: null };
}

function buildChain(table: string) {
  const insertChain = {
    select: () => ({ single: () => Promise.resolve(nextResult(table)) }),
  };
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    single: () => Promise.resolve(nextResult(table)),
    insert: (payload: unknown) => {
      mockInsertRecord(table, payload);
      return insertChain;
    },
  };
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => buildChain(table),
  })),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { getBackendUser } from "@/lib/auth";
import { POST } from "@/app/api/admin/attendance/manual/route";

const mockGetBackendUser = vi.mocked(getBackendUser);

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/attendance/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";

const pastEvent = { id: EVENT_ID, check_in_start: new Date(Date.now() - 60 * 60 * 1000).toISOString() };
const futureEvent = { id: EVENT_ID, check_in_start: new Date(Date.now() + 60 * 60 * 1000).toISOString() };

function setupApprovedAdmin() {
  mockGetBackendUser.mockResolvedValue({ id: ADMIN_ID } as any);
  tableQueues["users"] = [
    { data: { account_type: "admin", status: "approved", email: "admin@usa.edu.ph" }, error: null },
  ];
}

const validBody = { student_id: STUDENT_ID, event_id: EVENT_ID, status: "present" as const };

describe("POST /api/admin/attendance/manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableQueues = {};
    mockGetBackendUser.mockResolvedValue(null);
  });

  it("returns 401 when no session is present", async () => {
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not an admin", async () => {
    mockGetBackendUser.mockResolvedValue({ id: "facilitator-uuid" } as any);
    tableQueues["users"] = [
      { data: { account_type: "facilitator", status: "approved", email: "fac@usa.edu.ph" }, error: null },
    ];
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/admin/i);
  });

  it("returns 400 for invalid input", async () => {
    setupApprovedAdmin();
    const res = await POST(makeReq({ student_id: "not-a-uuid", event_id: EVENT_ID, status: "present" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the student doesn't exist", async () => {
    setupApprovedAdmin();
    tableQueues["users"].push({ data: null, error: { code: "PGRST116" } });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/student not found/i);
  });

  it("returns 400 for an event that hasn't started yet", async () => {
    setupApprovedAdmin();
    tableQueues["users"].push({ data: { id: STUDENT_ID, account_type: "student" }, error: null });
    tableQueues["events"] = [{ data: futureEvent, error: null }];
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/hasn't started/i);
  });

  it("returns 409 when the student already has a record for this event", async () => {
    setupApprovedAdmin();
    tableQueues["users"].push({ data: { id: STUDENT_ID, account_type: "student" }, error: null });
    tableQueues["events"] = [{ data: pastEvent, error: null }];
    tableQueues["attendance_records"] = [{ data: null, error: { code: "23505" } }];
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/already has an attendance record/i);
  });

  it("returns 201 and inserts the record on success", async () => {
    setupApprovedAdmin();
    tableQueues["users"].push({ data: { id: STUDENT_ID, account_type: "student" }, error: null });
    tableQueues["events"] = [{ data: pastEvent, error: null }];
    tableQueues["attendance_records"] = [
      { data: { id: "record-uuid", student_id: STUDENT_ID, event_id: EVENT_ID, status: "present" }, error: null },
    ];
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.record.id).toBe("record-uuid");
    expect(mockInsertRecord).toHaveBeenCalledWith(
      "attendance_records",
      expect.objectContaining({ student_id: STUDENT_ID, event_id: EVENT_ID, status: "present", scanned_by: ADMIN_ID })
    );
  });

  it("defaults remarks to a reconciliation note when none is supplied", async () => {
    setupApprovedAdmin();
    tableQueues["users"].push({ data: { id: STUDENT_ID, account_type: "student" }, error: null });
    tableQueues["events"] = [{ data: pastEvent, error: null }];
    tableQueues["attendance_records"] = [
      { data: { id: "record-uuid", status: "present" }, error: null },
    ];
    await POST(makeReq(validBody));
    const [, payload] = mockInsertRecord.mock.calls[0];
    expect(payload.remarks).toMatch(/manually reconciled/i);
  });
});
