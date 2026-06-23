# Merch Catalogue Backend — Design

## Problem

`src/app/dashboard/merch/page.tsx` renders a fully-built admin UI for managing
merchandise (add/edit/delete products, image upload) but none of it persists.
Products come from a hardcoded `MERCH_ITEMS` array, and the add/edit/delete
handlers only call `setMerchItems(...)` on local React state. "Uploaded"
images are `URL.createObjectURL()` blob URLs that vanish on refresh. No
Supabase table, API route, or Storage bucket exists for this feature.

## Scope boundary

This stays a **showcase catalogue** — no cart, no checkout, no inventory/stock
counts. The goal is to make the existing add/edit/delete/display UI actually
persist to Supabase. Pricing remains a display string (e.g. `"PHP 1,299.00"`),
not a real numeric price tied to a payment flow.

## Data model

New table, modeled on the existing `events` table:

```sql
CREATE TABLE public.products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('apparel', 'accessories')),
  price_label  TEXT NOT NULL DEFAULT 'PHP 0.00',
  description  TEXT,
  status       TEXT NOT NULL CHECK (status IN ('Showcase Only', 'Coming Soon')) DEFAULT 'Showcase Only',
  material     TEXT,
  sizes        TEXT[],
  colors       TEXT[],
  features     TEXT[],
  images       TEXT[] NOT NULL,
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

`images[0]` is the primary/cover image, mirroring the current
`MerchItem.image` (primary) + `MerchItem.images` (gallery) split.

The 4 existing curated products (hoodie, shirt, tote, lanyard — with their
real marketing copy and `/merch/*.png` preset image paths) are seeded via
`INSERT` statements in the same migration, so they aren't lost when the
hardcoded array is removed from the frontend.

## Permissions (RLS)

Reuse the existing `public.is_council()` helper (already defined in
`schema.sql`; checks `account_type IN ('facilitator','admin') AND status =
'approved'`):

```sql
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone views products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Council manages products" ON public.products FOR ALL USING (public.is_council());
```

This matches the existing `events` table's policy shape exactly.

## Image storage

New public Supabase Storage bucket: `merch-images`.

- Public read (anyone can view images via public URL).
- Insert/update/delete restricted to `is_council()` (facilitators/admins).

Frontend uploads files directly via
`supabase.storage.from("merch-images").upload(...)`, then stores the
returned public URL string in the `images` array. This replaces the current
`URL.createObjectURL()` blob-URL fake.

## Frontend wiring — no new API routes

Existing convention in this codebase (`src/app/dashboard/facilitator/events/page.tsx`):
event *creation* goes through an API route only because it triggers an email
broadcast side-effect; event *updates* go straight through
`supabase.from("events").update()` on the client, relying on RLS for
authorization. Products have no side-effects like that, so all four
operations use direct Supabase client calls:

- **Read** (on mount): `supabase.from("products").select("*")` replaces the
  hardcoded `MERCH_ITEMS` array as the initial state source.
- **Create**: upload any new images to `merch-images`, then
  `supabase.from("products").insert(...)`.
- **Update**: same upload step for any new images, then
  `.update(...).eq("id", ...)`.
- **Delete**: `.delete().eq("id", ...)`. Also delete the row's images from
  the Storage bucket so they don't leak as orphaned files.

## Other fixes bundled in

- `page.tsx:185` (`isFacilitator = user?.account_type === "facilitator"`)
  currently hides admin controls from `account_type === "admin"` accounts,
  contradicting the rest of the codebase's `IN ('facilitator', 'admin')`
  permission pattern. Fix the check to include `"admin"`.
- Add loading and error states around the new async read/write calls
  (currently nothing in this component awaits anything besides
  `getCurrentUser()`).

## Out of scope

- Cart, checkout, payments, or stock/inventory tracking.
- Real-time updates across multiple admin sessions (a manual refetch after
  mutation is sufficient).
- Migrating other unrelated hardcoded data on this page.
