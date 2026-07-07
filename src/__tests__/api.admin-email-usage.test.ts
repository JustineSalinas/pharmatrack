import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  getBackendUser: vi.fn(),
}));

let tableResults: Record<string, { data: unknown; error: unknown }> = {};

function buildChain(table: string) {
  const result = () => tableResults[table] ?? { data: null, error: null };
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(result()),
    maybeSingle: () => Promise.resolve(result()),
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
import { GET } from "@/app/api/admin/email-usage/route";

const mockGetBackendUser = vi.mocked(getBackendUser);

function makeReq(): NextRequest {
  return new Request("http://localhost/api/admin/email-usage") as unknown as NextRequest;
}

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

function setupApprovedAdmin() {
  mockGetBackendUser.mockResolvedValue({ id: ADMIN_ID } as any);
  tableResults["users"] = {
    data: { account_type: "admin", status: "approved" },
    error: null,
  };
}

describe("GET /api/admin/email-usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    tableResults = {};
    mockGetBackendUser.mockResolvedValue(null);
  });

  it("returns 401 when no session is present", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not an admin", async () => {
    mockGetBackendUser.mockResolvedValue({ id: "facilitator-uuid" } as any);
    tableResults["users"] = { data: { account_type: "facilitator", status: "approved" }, error: null };
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("defaults to 0 sent and the 5000 cap when no rows exist yet", async () => {
    setupApprovedAdmin();
    tableResults["email_usage"] = { data: null, error: null };
    tableResults["system_config"] = { data: null, error: null };
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(0);
    expect(json.cap).toBe(5000);
    expect(json.percent).toBe(0);
    expect(json.month).toMatch(/^\d{4}-\d{2}$/);
    expect(json.source).toBe("internal");
  });

  it("returns the tracked count and admin-configured cap with correct percent when MailerSend isn't configured", async () => {
    setupApprovedAdmin();
    tableResults["email_usage"] = { data: { sent_count: 2500 }, error: null };
    tableResults["system_config"] = { data: { value: "5000" }, error: null };
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(2500);
    expect(json.cap).toBe(5000);
    expect(json.percent).toBe(50);
    expect(json.source).toBe("internal");
    expect(json.internalCount).toBe(2500);
    expect(json.mailersendCount).toBeNull();
  });

  it("prefers MailerSend's real account-wide number when the API key is configured and the call succeeds", async () => {
    setupApprovedAdmin();
    tableResults["email_usage"] = { data: { sent_count: 2500 }, error: null };
    tableResults["system_config"] = { data: { value: "5000" }, error: null };
    vi.stubEnv("MAILERSEND_API_KEY", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { stats: [{ sent: 4321 }] } }),
    }));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe("mailersend");
    expect(json.count).toBe(4321);
    expect(json.mailersendCount).toBe(4321);
    expect(json.internalCount).toBe(2500);
    expect(json.percent).toBe(Math.round((4321 / 5000) * 100));
  });

  it("falls back to the internal tracked count when the MailerSend API call fails", async () => {
    setupApprovedAdmin();
    tableResults["email_usage"] = { data: { sent_count: 2500 }, error: null };
    tableResults["system_config"] = { data: { value: "5000" }, error: null };
    vi.stubEnv("MAILERSEND_API_KEY", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe("internal");
    expect(json.count).toBe(2500);
    expect(json.mailersendUnavailableReason).toMatch(/401/);
  });
});
