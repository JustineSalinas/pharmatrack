# Pharmatrack Backend Audit & Improvements Report

This report documents the security vulnerabilities, database performance bottlenecks, architectural improvements, and logging enhancements identified and implemented in the Pharmatrack backend.

---

## 1. Executive Summary

A comprehensive audit was performed on the Pharmatrack backend, specifically reviewing Next.js API routes (`src/app/api/`), server-side authentication utilities (`src/lib/auth.ts`), and attendance logic helpers (`src/lib/attendance.ts`).

### Key Findings & Actions Taken:
1. **Critical Security Vulnerability Secured**: The password recovery endpoint (`/api/admin/reset-password`) was publicly accessible. It was secured to require token verification and approved administrator privileges before generating links.
2. **Database Performance Optimization**: The opportunistic attendance backfill helper (`backfillEventStatuses` in `src/lib/attendance.ts`) suffered from an **N+1 query bottleneck** (executing separate DB SELECTs for each event). This was refactored into bulk operations, reducing database round-trips from $O(N)$ to $O(1)$.
3. **Flexible Authentication Layer**: Server-side authentication was enhanced to retrieve the Supabase token via the standard HTTP `Authorization` header (`Bearer <token>`) in addition to browser cookies.
4. **Structured Backend Logging**: Detailed console logs (`info`, `warn`, `error`) were introduced across all API endpoints to enable traceability, auditing, and easier troubleshooting.

---

## 2. Deep Dive: Security Assessment

### Public Password Reset Link Generation (Critical)
*   **Vulnerability**: The endpoint `/api/admin/reset-password` was completely open. An anonymous user could POST any email to this route, causing the backend (using a Service Role client) to generate a valid password reset/recovery link and return it in the JSON response, enabling full account takeover.
*   **Remediation**:
    *   Updated the API route to use the new `getBackendUser(req)` helper to extract and verify the caller's identity via the HTTP `Authorization` header or session cookies.
    *   Added a database check ensuring the caller is not only authenticated but is an **approved administrator** (`account_type = 'admin'` and `status = 'approved'`).
    *   Updated the administrator user-management page (`src/app/dashboard/admin/users/page.tsx`) to retrieve the current session token client-side and forward it securely in the `Authorization` header.

### Authentication Bypasses & Data Discrepancies
*   **Finding**: The frontend components bypassed API routes like `/api/scan` and directly queried/inserted data using the client-side Supabase SDK. While RLS rules prevented non-approved users from writing, this bypassed business logic checks, such as enforcing check-out windows and checking if a check-out was completed more than 4 hours after check-in.
*   **Recommendation**: Migrating client-side database updates to secure server-side API routes is highly recommended to enforce unified business rules.

---

## 3. Deep Dive: Database Performance

### N+1 Query Loop in Attendance Backfilling (High Impact)
*   **Problem**: In `src/lib/attendance.ts`, the opportunistic backfill mechanism retrieved all events in the 60-day lookback window, and then ran a separate database query **for every single event** to fetch its attendance records:
    ```typescript
    for (const ev of events) {
      const { data } = await supabase.from("attendance_records").select(...).eq("event_id", ev.id);
      // Processing...
      await supabase.from("attendance_records").insert(...);
      await supabase.from("attendance_records").update(...).in("id", ...);
    }
    ```
    If there were 30 events in the lookback window, the client browser would fire **over 60 database requests** sequentially.
*   **Remediation**:
    *   Refactored the function to perform a **bulk query** retrieving all attendance records for all lookback events in a single `.in("event_id", eventIds)` select statement.
    *   Grouped the records in memory using a JavaScript `Map` for $O(1)$ lookup.
    *   Batched all required `absent` insertions and `incomplete` updates into single, bulk insert/update requests (in groups of 500 records) outside the loop.
    *   This reduced database round-trips from $2N + 2$ to a constant $5$ queries regardless of the number of events.

---

## 4. Implementation Details & Diffs

### A. Server Auth Helper (`src/lib/auth.ts`)
Added `getBackendUser` to extract and verify JWT tokens from either the standard `Authorization` header or cookies, making API routes fully compatible with server-side and client-side fetches.

```diff
+export async function getBackendUser(req?: NextRequest) {
+  let token: string | undefined;
+
+  // 1. Try Authorization header
+  if (req) {
+    const authHeader = req.headers.get("Authorization");
+    if (authHeader && authHeader.startsWith("Bearer ")) {
+      token = authHeader.substring(7);
+    }
+  }
+
+  // 2. Try cookie
+  if (!token) {
+    try {
+      const cookieStore = cookies();
+      token = cookieStore.get("pharmatrack_token")?.value;
+    } catch {
+      // cookies() throws when called outside dynamic server request contexts
+    }
+  }
+
+  if (!token) return null;
+
+  const { data: { user }, error } = await supabase.auth.getUser(token);
+  if (error || !user) return null;
+  return user;
+}
```

### B. Admin Reset Password Endpoint (`src/app/api/admin/reset-password/route.ts`)
Integrated caller identity verification and permission validation using `getBackendUser` and the service-role client.

```diff
+  try {
+    // ── Auth Check ──
+    const caller = await getBackendUser(req);
+    if (!caller) {
+      console.warn("[ResetPassword API] Unauthorized request attempt - no valid session");
+      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
+    }
+
+    // Verify caller is an approved admin in users table
+    const { data: callerProfile, error: profileErr } = await adminClient
+      .from("users")
+      .select("account_type, status")
+      .eq("id", caller.id)
+      .single();
+
+    if (profileErr || !callerProfile) {
+      console.error(`[ResetPassword API] Failed to fetch profile for user ${caller.id}:`, profileErr);
+      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
+    }
+
+    if (callerProfile.account_type !== "admin" || callerProfile.status !== "approved") {
+      console.warn(`[ResetPassword API] Forbidden access attempt by ${caller.email} (Role: ${callerProfile.account_type}, Status: ${callerProfile.status})`);
+      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
+    }
```

### C. Attendance Backfill (`src/lib/attendance.ts`)
Refactored loops to execute query operations in bulk.

```diff
+  // 3. Fetch ALL existing attendance records for these events in a SINGLE query!
+  const eventIds = events.map((ev: any) => ev.id);
+  const { data: allRecords, error: arErr } = await supabase
+    .from("attendance_records")
+    .select("id, student_id, event_id, time_in, time_out, status")
+    .in("event_id", eventIds);
+
+  // 4. Group existing records by event_id for fast O(1) in-memory lookup
+  const recordsByEvent = new Map<string, any[]>();
+  for (const r of allRecords ?? []) {
+    if (!r.event_id) continue;
+    if (!recordsByEvent.has(r.event_id)) {
+      recordsByEvent.set(r.event_id, []);
+    }
+    recordsByEvent.get(r.event_id)!.push(r);
+  }
```

### D. Unified Authentication Client Fallback (`src/lib/auth.ts`)
Updated the server-side authentication checker to fall back to the standard Supabase SSR cookies client if custom headers or `pharmatrack_token` cookies are absent. This allows standard Supabase auth flows (like OAuth, PKCE, and server-side verification) to authenticate users natively.

```diff
+  if (token) {
+    const { data: { user }, error } = await supabase.auth.getUser(token);
+    if (!error && user) return user;
+  }
+
+  // 3. Fallback: Try standard Supabase SSR cookies client
+  try {
+    const { createClient } = await import("./server");
+    const serverClient = await createClient();
+    const { data: { user }, error } = await serverClient.auth.getUser();
+    if (!error && user) return user;
+  } catch {
+    // Ignore errors if context is not server-request-compatible
+  }
```

### E. Auth Callback & Verification Session Fixing (`src/app/auth/callback/route.ts`)
Previously, standard email OTP verification (including password recovery) used a stateless `createClient` that failed to persist session cookies to the user's browser, leading to `/reset-password` displaying "link invalid/expired" due to a lack of active session.
Refactored this to use `createServerClient` from `@supabase/ssr` to ensure browser session cookies are set correctly, and added support to synchronize standard Supabase auth state with the custom legacy `pharmatrack_token` cookie.

```diff
-  if (token_hash && type) {
-    const supabase = createClient(
-      process.env.NEXT_PUBLIC_SUPABASE_URL!,
-      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
-    );
-
-    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any });
+  if (token_hash && type) {
+    const cookieStore = cookies();
+    const supabase = createServerClient(
+      process.env.NEXT_PUBLIC_SUPABASE_URL!,
+      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
+      {
+        cookies: {
+          getAll() { return cookieStore.getAll(); },
+          setAll(cookiesToSet) {
+            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
+          },
+        },
+      }
+    );
+
+    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: type as any });
```

---

## 5. Architectural Recommendations

1. **Unify Business Logic**: Relocate client-side checks and DB mutations in `ScannerPage` to `/api/scan`. This ensures database actions strictly follow business validation rules, which cannot be bypassed or modified by client-side inspection.
2. **Setup Supabase SSR Middleware**: Setup standard Next.js middleware using `@supabase/ssr` to automatically refresh access tokens on every request. This will remove the need for legacy/custom cookies and HTTP header token forwarding.
3. **Database Indexing**: Add foreign key and composite indexes to speed up lookups as the attendance table grows:
   - Composite Index: `attendance_records(event_id, student_id)` to optimize scan lookups and backfill checks.
   - Foreign Key Index: `attendance_records(student_id)` to speed up individual student attendance summaries.
   - Foreign Key Index: `attendance_records(session_id)` to speed up classroom attendance checks.
   - Date Index: `events(check_in_end)` to optimize backfill queries selecting events within the lookback window.
