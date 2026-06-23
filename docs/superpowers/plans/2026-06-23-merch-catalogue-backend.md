# Merch Catalogue Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the merch catalogue's add/edit/delete product flows actually persist to Supabase instead of mutating local React state, and replace fake blob-URL image "uploads" with real Supabase Storage uploads.

**Architecture:** A new `products` table (RLS-protected, mirroring the existing `events` table's permission shape) plus a public `merch-images` Storage bucket. No new API routes — all reads/writes go through the Supabase client directly from `src/app/dashboard/merch/page.tsx`, following the same direct-client pattern already used for event updates in `src/app/dashboard/facilitator/events/page.tsx`. Pure data-shaping and upload logic is extracted into a new `src/lib/merch.ts` so it's unit-testable; the existing 1900-line page component keeps its JSX/render code untouched except for the four CRUD handlers and the initial data load.

**Tech Stack:** Next.js 14 (App Router), Supabase (Postgres + Storage + RLS), Vitest (Node environment, no jsdom/RTL in this repo).

## Global Constraints

- This is a **showcase catalogue only** — no cart, checkout, or stock/inventory tracking. `price_label` stays a free-text display string (e.g. `"PHP 1,299.00"`), not a real numeric price.
- Permission model: only `account_type IN ('facilitator', 'admin')` AND `status = 'approved'` may create/edit/delete products — reuse the existing `public.is_council()` Postgres function, do not write a new permission function.
- No new API routes. All four operations (create/read/update/delete) go through the Supabase client directly, relying on RLS for authorization, matching this codebase's existing convention for non-side-effecting CRUD.
- This repo has no component-testing setup (`vitest.config.ts` uses `environment: 'node'`, no `@testing-library/react`/jsdom installed). Pure logic gets Vitest unit tests; the page-component wiring task is verified via `npm run type-check`, `npm run lint`, and manual browser testing — there is no automated path for it.
- Database changes are applied manually via the Supabase SQL Editor (this repo has no `supabase/migrations` directory or CLI-based migration flow — `schema.sql` is the single canonical file, run by hand, and is written to be idempotent/safely re-runnable).

---

### Task 1: Database schema — `products` table, RLS, Storage bucket, seed data

**Files:**
- Modify: `schema.sql` (append new section at end of file, after the existing `SYSTEM CONFIGURATION` section which ends at line 419)

**Interfaces:**
- Produces: Postgres table `public.products` with columns `id, name, category, price_label, description, status, material, sizes, colors, features, images, created_by, created_at, updated_at`. Produces Storage bucket `merch-images` (public read, council-only write). Later tasks' `ProductRow` TypeScript type (Task 2) must match these columns exactly.

- [ ] **Step 1: Append the products table, RLS policies, and updated_at trigger to `schema.sql`**

Add this immediately after line 419 (the seed `INSERT INTO public.system_config` statement's closing `ON CONFLICT (key) DO NOTHING;`), keeping the file's existing blank-line-then-section-header style:

```sql

-- ============================================================
-- PRODUCTS (Merch Catalogue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
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

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views products" ON public.products;
DROP POLICY IF EXISTS "Council manages products" ON public.products;
CREATE POLICY "Everyone views products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Council manages products" ON public.products FOR ALL USING (public.is_council());

-- Keep updated_at current on every UPDATE
CREATE OR REPLACE FUNCTION public.set_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_products_updated_at ON public.products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_products_updated_at();

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('merch-images', 'merch-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read merch images" ON storage.objects;
DROP POLICY IF EXISTS "Council manages merch images" ON storage.objects;
CREATE POLICY "Public read merch images" ON storage.objects FOR SELECT
  USING (bucket_id = 'merch-images');
CREATE POLICY "Council manages merch images" ON storage.objects FOR ALL
  USING (bucket_id = 'merch-images' AND public.is_council());

-- Seed: existing curated products (safe to re-run — skips rows whose name
-- already exists)
INSERT INTO public.products (name, category, price_label, description, status, material, sizes, colors, features, images)
SELECT * FROM (VALUES
  ('Pharmacy Premium Hoodie', 'apparel', 'PHP 1,299.00',
   'Premium heavyweight cotton hoodie featuring forest green coloring with signature gold embroidered ''Pharmacy'' lettering across the chest.',
   'Coming Soon', '80% Organic Cotton / 20% Polyester Blend (380 GSM)',
   ARRAY['S','M','L','XL','XXL'], ARRAY['Forest Green with Gold Embroidery'],
   ARRAY['Double-lined hood with adjustable drawstrings','Ribbed cuffs and waistband','Front kangaroo pocket','Embroidered premium detailing'],
   ARRAY['/merch/hoodie.png']),
  ('Pharmacy Signature Shirt', 'apparel', 'PHP 599.00',
   'Minimalist off-white signature tee designed for everyday comfort, featuring a clean green ''Pharmacy'' chest print.',
   'Showcase Only', '100% Ring-Spun Combed Cotton (200 GSM)',
   ARRAY['XS','S','M','L','XL','XXL'], ARRAY['Off-White / Cream with Green Printing'],
   ARRAY['Pre-shrunk fabric','Side-seamed construction','Double-needle topstitched collar','Soft and breathable wear'],
   ARRAY['/merch/shirt.png']),
  ('Pharmacy Official Tote Bag', 'accessories', 'PHP 350.00',
   'Durable white canvas tote bag with a stylish green leather-styled handle, featuring the centered ''Pharmacy'' branding.',
   'Coming Soon', 'Heavy-Duty 12oz Cotton Canvas / Vegan Leather Straps',
   NULL::TEXT[], ARRAY['Natural White Canvas with Forest Green Straps'],
   ARRAY['Spacious main compartment','Zippered top closure for security','Reinforced base and stitching','Inner pocket for smartphones or keys'],
   ARRAY['/merch/tote.png']),
  ('Pharmacy Event Lanyard', 'accessories', 'PHP 120.00',
   'Official event lanyard with forest green strap and premium gold text printing, complete with a secure silver clasp.',
   'Showcase Only', 'High-Density Smooth Satin Polyester',
   NULL::TEXT[], ARRAY['Forest Green with Gold Print'],
   ARRAY['Heavy-duty metal trigger hook','Safety breakaway clasp at the neck','Optimal 20mm width for comfort','Dual-sided logo printing'],
   ARRAY['/merch/lanyard.png'])
) AS seed(name, category, price_label, description, status, material, sizes, colors, features, images)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p WHERE p.name = seed.name
);
```

- [ ] **Step 2: Apply and verify in Supabase**

This cannot be run from this repo (no CLI migration flow, no reachable Supabase project from this environment) — the user must run it manually:

1. Open the Supabase Dashboard → SQL Editor for the project.
2. Paste and run the entire updated `schema.sql` (or just the new section if the rest is already applied).
3. Verify: `SELECT id, name, category, price_label, images FROM public.products ORDER BY created_at;` returns the 4 seeded rows.
4. Verify the bucket exists: Dashboard → Storage → confirm `merch-images` is listed and marked Public.

Expected: no SQL errors; 4 rows returned; bucket visible.

- [ ] **Step 3: Commit**

```bash
git add schema.sql
git commit -m "feat: add products table, RLS, and merch-images storage bucket"
```

---

### Task 2: Pure data-shaping helpers — `src/lib/merch.ts`

**Files:**
- Create: `src/lib/merch.ts`
- Test: `src/lib/__tests__/merch.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no dependencies on Task 1 besides matching column names by convention).
- Produces: `MerchItem` (moved here from `src/app/dashboard/merch/page.tsx`), `ProductRow`, `ProductDraft` types; `parseCommaList(input: string): string[]`, `parseLineList(input: string): string[]`, `formatPriceLabel(input: string): string`, `mapRowToMerchItem(row: ProductRow): MerchItem`, `toProductRecord(draft: ProductDraft): Omit<ProductRow, "id">`. Task 4/5 import all of these from `@/lib/merch`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/merch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  parseCommaList,
  parseLineList,
  formatPriceLabel,
  mapRowToMerchItem,
  toProductRecord,
  type ProductRow,
} from '../merch'

describe('parseCommaList', () => {
  it('splits, trims, and drops empty entries', () => {
    expect(parseCommaList('S, M,  L,')).toEqual(['S', 'M', 'L'])
  })

  it('returns an empty array for blank input', () => {
    expect(parseCommaList('   ')).toEqual([])
  })
})

describe('parseLineList', () => {
  it('splits on newlines, trims, and drops empty lines', () => {
    expect(parseLineList('Feature one\n  Feature two  \n\nFeature three')).toEqual([
      'Feature one',
      'Feature two',
      'Feature three',
    ])
  })
})

describe('formatPriceLabel', () => {
  it('prefixes a bare number with PHP', () => {
    expect(formatPriceLabel('599.00')).toBe('PHP 599.00')
  })

  it('leaves an already-prefixed value alone', () => {
    expect(formatPriceLabel('PHP 1,299.00')).toBe('PHP 1,299.00')
  })

  it('is case-insensitive when checking for an existing prefix', () => {
    expect(formatPriceLabel('php 120.00')).toBe('php 120.00')
  })

  it('defaults blank input to PHP 0.00', () => {
    expect(formatPriceLabel('   ')).toBe('PHP 0.00')
  })
})

describe('mapRowToMerchItem', () => {
  const baseRow: ProductRow = {
    id: 'abc-123',
    name: 'Pharmacy Tote',
    category: 'accessories',
    price_label: 'PHP 350.00',
    description: 'A tote.',
    status: 'Showcase Only',
    material: 'Canvas',
    sizes: null,
    colors: ['White'],
    features: ['Zippered top'],
    images: ['https://example.com/tote.png'],
  }

  it('maps a fully-populated row to a MerchItem', () => {
    const item = mapRowToMerchItem(baseRow)
    expect(item).toEqual({
      id: 'abc-123',
      name: 'Pharmacy Tote',
      category: 'accessories',
      pricePlaceholder: 'PHP 350.00',
      image: 'https://example.com/tote.png',
      images: ['https://example.com/tote.png'],
      description: 'A tote.',
      status: 'Showcase Only',
      details: {
        material: 'Canvas',
        sizes: undefined,
        colors: ['White'],
        features: ['Zippered top'],
      },
    })
  })

  it('falls back to placeholder text/colors/features when null', () => {
    const item = mapRowToMerchItem({
      ...baseRow,
      description: null,
      material: null,
      colors: null,
      features: null,
    })
    expect(item.description).toBe('No description provided.')
    expect(item.details.material).toBe('N/A')
    expect(item.details.colors).toEqual(['N/A'])
    expect(item.details.features).toEqual(['N/A'])
  })

  it('falls back to a default image when images is empty', () => {
    const item = mapRowToMerchItem({ ...baseRow, images: [] })
    expect(item.image).toBe('/merch/shirt.png')
  })
})

describe('toProductRecord', () => {
  it('builds a DB-shaped record from a form draft', () => {
    const record = toProductRecord({
      name: 'Pharmacy Cap',
      category: 'apparel',
      pricePlaceholder: '250',
      description: '',
      status: 'Coming Soon',
      material: '',
      sizes: [],
      colors: [],
      features: [],
      images: [],
    })
    expect(record).toEqual({
      name: 'Pharmacy Cap',
      category: 'apparel',
      price_label: 'PHP 250',
      description: 'No description provided.',
      status: 'Coming Soon',
      material: 'N/A',
      sizes: null,
      colors: ['N/A'],
      features: ['N/A'],
      images: ['/merch/shirt.png'],
    })
  })

  it('preserves provided sizes, colors, features, and images', () => {
    const record = toProductRecord({
      name: 'Pharmacy Cap',
      category: 'apparel',
      pricePlaceholder: 'PHP 250.00',
      description: 'A cap.',
      status: 'Showcase Only',
      material: 'Cotton',
      sizes: ['S', 'M'],
      colors: ['Green'],
      features: ['Adjustable strap'],
      images: ['https://example.com/cap.png'],
    })
    expect(record.sizes).toEqual(['S', 'M'])
    expect(record.colors).toEqual(['Green'])
    expect(record.features).toEqual(['Adjustable strap'])
    expect(record.images).toEqual(['https://example.com/cap.png'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/merch.test.ts`
Expected: FAIL — `Cannot find module '../merch'` (the file doesn't exist yet).

- [ ] **Step 3: Create `src/lib/merch.ts` with the implementation**

```ts
export interface MerchItem {
  id: string;
  name: string;
  category: "apparel" | "accessories";
  pricePlaceholder: string;
  image: string;
  images?: string[];
  description: string;
  status: "Showcase Only" | "Coming Soon";
  details: {
    material: string;
    sizes?: string[];
    colors: string[];
    features: string[];
  };
}

export interface ProductRow {
  id: string;
  name: string;
  category: "apparel" | "accessories";
  price_label: string;
  description: string | null;
  status: "Showcase Only" | "Coming Soon";
  material: string | null;
  sizes: string[] | null;
  colors: string[] | null;
  features: string[] | null;
  images: string[];
}

export interface ProductDraft {
  name: string;
  category: "apparel" | "accessories";
  pricePlaceholder: string;
  description: string;
  status: "Showcase Only" | "Coming Soon";
  material: string;
  sizes: string[];
  colors: string[];
  features: string[];
  images: string[];
}

/** Splits a comma-separated form field (e.g. "S, M, L") into trimmed, non-empty entries. */
export function parseCommaList(input: string): string[] {
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Splits a newline-separated form field (e.g. a features textarea) into trimmed, non-empty lines. */
export function parseLineList(input: string): string[] {
  return input.split("\n").map((s) => s.trim()).filter(Boolean);
}

/** Normalizes a price form field to always carry a "PHP" prefix, defaulting blank input to PHP 0.00. */
export function formatPriceLabel(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "PHP 0.00";
  return trimmed.toUpperCase().startsWith("PHP") ? trimmed : `PHP ${trimmed}`;
}

/** Maps a `products` table row to the UI-facing MerchItem shape the page component renders. */
export function mapRowToMerchItem(row: ProductRow): MerchItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    pricePlaceholder: row.price_label,
    image: row.images[0] ?? "/merch/shirt.png",
    images: row.images,
    description: row.description ?? "No description provided.",
    status: row.status,
    details: {
      material: row.material ?? "N/A",
      sizes: row.sizes ?? undefined,
      colors: row.colors && row.colors.length > 0 ? row.colors : ["N/A"],
      features: row.features && row.features.length > 0 ? row.features : ["N/A"],
    },
  };
}

/** Builds a `products` table insert/update payload from add/edit form state. */
export function toProductRecord(draft: ProductDraft): Omit<ProductRow, "id"> {
  return {
    name: draft.name,
    category: draft.category,
    price_label: formatPriceLabel(draft.pricePlaceholder),
    description: draft.description || "No description provided.",
    status: draft.status,
    material: draft.material || "N/A",
    sizes: draft.sizes.length > 0 ? draft.sizes : null,
    colors: draft.colors.length > 0 ? draft.colors : ["N/A"],
    features: draft.features.length > 0 ? draft.features : ["N/A"],
    images: draft.images.length > 0 ? draft.images : ["/merch/shirt.png"],
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/merch.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/merch.ts src/lib/__tests__/merch.test.ts
git commit -m "feat: add pure data-shaping helpers for merch products"
```

---

### Task 3: Image upload/delete helpers — extend `src/lib/merch.ts`

**Files:**
- Modify: `src/lib/merch.ts`
- Test: `src/lib/__tests__/merch.test.ts`

**Interfaces:**
- Consumes: nothing new from earlier tasks.
- Produces: `MerchImageUploader`, `MerchImageRemover` interfaces; `uploadMerchImages(files: File[], uploader: MerchImageUploader): Promise<string[]>`; `deleteMerchImages(urls: string[], remover: MerchImageRemover): Promise<void>`; `extractStoragePath(publicUrl: string, bucket: string): string | null`. Task 4/5 pass `supabase.storage.from("merch-images")` as the `uploader`/`remover` argument — that object already implements both interfaces' method shapes, so no adapter code is needed.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/merch.test.ts` (add this import alongside the existing ones at the top, and these `describe` blocks at the end of the file):

```ts
// add to the existing top-of-file import from '../merch':
//   uploadMerchImages,
//   deleteMerchImages,
//   extractStoragePath,
//   type MerchImageUploader,
//   type MerchImageRemover,

describe('extractStoragePath', () => {
  it('extracts the object path from a Supabase public URL', () => {
    const url = 'https://xyz.supabase.co/storage/v1/object/public/merch-images/123-cap.png'
    expect(extractStoragePath(url, 'merch-images')).toBe('123-cap.png')
  })

  it('returns null for a URL that does not contain the bucket segment', () => {
    expect(extractStoragePath('/merch/hoodie.png', 'merch-images')).toBeNull()
  })
})

describe('uploadMerchImages', () => {
  it('uploads each file and returns their public URLs in order', async () => {
    const uploadCalls: string[] = []
    const fakeUploader: MerchImageUploader = {
      upload: async (path) => {
        uploadCalls.push(path)
        return { data: { path }, error: null }
      },
      getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.example.com/${path}` } }),
    }
    const fileA = new File(['a'], 'a.png', { type: 'image/png' })
    const fileB = new File(['b'], 'b.png', { type: 'image/png' })

    const urls = await uploadMerchImages([fileA, fileB], fakeUploader)

    expect(urls).toEqual([
      `https://cdn.example.com/${uploadCalls[0]}`,
      `https://cdn.example.com/${uploadCalls[1]}`,
    ])
    expect(uploadCalls).toHaveLength(2)
  })

  it('throws if a file upload fails', async () => {
    const fakeUploader: MerchImageUploader = {
      upload: async () => ({ data: null, error: { message: 'storage quota exceeded' } }),
      getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.example.com/${path}` } }),
    }
    const file = new File(['a'], 'a.png', { type: 'image/png' })

    await expect(uploadMerchImages([file], fakeUploader)).rejects.toThrow('storage quota exceeded')
  })
})

describe('deleteMerchImages', () => {
  it('removes only the URLs that belong to the given bucket', async () => {
    const removedPaths: string[][] = []
    const fakeRemover: MerchImageRemover = {
      remove: async (paths) => {
        removedPaths.push(paths)
        return { error: null }
      },
    }

    await deleteMerchImages(
      ['https://xyz.supabase.co/storage/v1/object/public/merch-images/a.png', '/merch/hoodie.png'],
      fakeRemover
    )

    expect(removedPaths).toEqual([['a.png']])
  })

  it('does nothing if no URLs belong to the bucket', async () => {
    let called = false
    const fakeRemover: MerchImageRemover = {
      remove: async (paths) => {
        called = true
        return { error: null }
      },
    }

    await deleteMerchImages(['/merch/hoodie.png'], fakeRemover)

    expect(called).toBe(false)
  })

  it('throws if removal fails', async () => {
    const fakeRemover: MerchImageRemover = {
      remove: async () => ({ error: { message: 'permission denied' } }),
    }

    await expect(
      deleteMerchImages(
        ['https://xyz.supabase.co/storage/v1/object/public/merch-images/a.png'],
        fakeRemover
      )
    ).rejects.toThrow('permission denied')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/merch.test.ts`
Expected: FAIL — `extractStoragePath`/`uploadMerchImages`/`deleteMerchImages` are not exported from `'../merch'`.

- [ ] **Step 3: Append the implementation to `src/lib/merch.ts`**

```ts
export interface MerchImageUploader {
  upload(
    path: string,
    file: File
  ): Promise<{ data: { path: string } | null; error: { message: string } | null }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}

export interface MerchImageRemover {
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
}

/** Extracts the object path from a Supabase Storage public URL, or null if the URL isn't from this bucket. */
export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

/** Uploads each file to Storage under a unique path and returns their public URLs, in input order. */
export async function uploadMerchImages(
  files: File[],
  uploader: MerchImageUploader
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
    const { error } = await uploader.upload(path, file);
    if (error) throw new Error(error.message);
    const { data } = uploader.getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

/** Deletes any of the given URLs that belong to the bucket; preset (non-Storage) URLs are ignored. */
export async function deleteMerchImages(
  urls: string[],
  remover: MerchImageRemover,
  bucket = "merch-images"
): Promise<void> {
  const paths = urls
    .map((url) => extractStoragePath(url, bucket))
    .filter((p): p is string => p !== null);
  if (paths.length === 0) return;
  const { error } = await remover.remove(paths);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/merch.test.ts`
Expected: PASS — all tests green, including Task 2's.

- [ ] **Step 5: Commit**

```bash
git add src/lib/merch.ts src/lib/__tests__/merch.test.ts
git commit -m "feat: add Storage upload/delete helpers for merch product images"
```

---

### Task 4: Wire up real product loading and creation in `page.tsx`

**Files:**
- Modify: `src/app/dashboard/merch/page.tsx`

**Interfaces:**
- Consumes: from `@/lib/merch`: `MerchItem`, `ProductRow`, `ProductDraft`, `parseCommaList`, `parseLineList`, `mapRowToMerchItem`, `toProductRecord`, `uploadMerchImages`. From `@/lib/supabase`: `supabase`.
- Produces: working "Add new product" flow that persists to `public.products` and uploads real files to the `merch-images` bucket; the page now loads its initial list from Supabase instead of a hardcoded array.

- [ ] **Step 1: Replace the hardcoded data/type imports at the top of the file**

In `src/app/dashboard/merch/page.tsx`, replace lines 1–116 (everything from the top of the file through the closing `];` of `MERCH_ITEMS`) with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  Shirt, 
  Tag, 
  Sparkles, 
  X, 
  Search, 
  Layers, 
  Grid,
  Info,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import {
  type MerchItem,
  type ProductRow,
  type ProductDraft,
  parseCommaList,
  parseLineList,
  mapRowToMerchItem,
  toProductRecord,
  uploadMerchImages,
} from "@/lib/merch";
```

This drops the local `interface MerchItem` and the hardcoded `MERCH_ITEMS` constant entirely — both now live in `src/lib/merch.ts` (types) or Supabase (data).

- [ ] **Step 2: Replace initial state, add loading/error state, and load products from Supabase**

Find this line (originally line 119, now shifted up by the import change):

```tsx
  const [merchItems, setMerchItems] = useState<MerchItem[]>(MERCH_ITEMS);
```

Replace it with:

```tsx
  const [merchItems, setMerchItems] = useState<MerchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
```

Find the existing `loadUser` effect:

```tsx
  useEffect(() => {
    async function loadUser() {
      try {
        const u = await getCurrentUser();
        setUser(u);
      } catch (err) {
        console.error("Failed to load user in merch catalogue", err);
      }
    }
    loadUser();
  }, []);
```

Add a second effect immediately after it that loads products from Supabase:

```tsx
  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        setActionError("Failed to load merchandise. Please refresh the page.");
      } else {
        setMerchItems((data as ProductRow[]).map(mapRowToMerchItem));
      }
      setLoading(false);
    }
    loadProducts();
  }, []);
```

- [ ] **Step 3: Fix the facilitator-only permission check to include admins**

Find:

```tsx
  const isFacilitator = user?.account_type === "facilitator";
```

Replace with:

```tsx
  const canManage = user?.account_type === "facilitator" || user?.account_type === "admin";
```

Then replace all three remaining usages of `isFacilitator` (the `{isFacilitator && (` blocks) with `{canManage && (` — these are the "Add new product" button, the per-card edit/delete action buttons, and one more block further down the file. Use a project-wide find/replace of `isFacilitator` → `canManage` within this file to catch all four occurrences (the declaration plus three usages).

- [ ] **Step 4: Rewrite `handleAddImageFile` to also track the raw File objects**

Find the `newImagesList` state declaration:

```tsx
  const [newImagesList, setNewImagesList] = useState<string[]>([]);
```

Add immediately after it:

```tsx
  const [newImageFiles, setNewImageFiles] = useState<Map<string, File>>(new Map());
```

Find `handleAddImageFile`:

```tsx
  const handleAddImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        urls.push(URL.createObjectURL(files[i]));
      }
      setNewImagesList([...newImagesList, ...urls]);
    }
  };
```

Replace with:

```tsx
  const handleAddImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const urls: string[] = [];
      const fileMap = new Map(newImageFiles);
      for (let i = 0; i < files.length; i++) {
        const url = URL.createObjectURL(files[i]);
        urls.push(url);
        fileMap.set(url, files[i]);
      }
      setNewImagesList([...newImagesList, ...urls]);
      setNewImageFiles(fileMap);
    }
  };
```

The existing thumbnail-rendering JSX (which maps over `newImagesList` to show previews and lets the user remove an entry by index) needs no changes — it still displays these same blob-URL strings.

- [ ] **Step 5: Rewrite `handleAddProductSubmit` to upload images and insert into Supabase**

Find the full `handleAddProductSubmit` function (originally lines 221–264):

```tsx
  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) return;

    const details = {
      material: newMaterial || "N/A",
      sizes: newSizes ? newSizes.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      colors: newColors ? newColors.split(",").map(c => c.trim()).filter(Boolean) : ["N/A"],
      features: newFeatures ? newFeatures.split("\n").map(f => f.trim()).filter(Boolean) : ["N/A"]
    };

    let finalImages = newImagesList.length > 0 ? newImagesList : ["/merch/shirt.png"];
    let primaryImage = finalImages[0];

    const newItem: MerchItem = {
      id: `custom-${Date.now()}`,
      name: newName,
      category: newCategory,
      pricePlaceholder: newPrice ? (newPrice.toUpperCase().startsWith("PHP") ? newPrice : `PHP ${newPrice}`) : "PHP 0.00",
      image: primaryImage,
      images: finalImages,
      description: newDescription || "No description provided.",
      status: newStatus,
      details
    };

    setMerchItems([newItem, ...merchItems]);

    // Reset Form
    setNewName("");
    setNewCategory("apparel");
    setNewPrice("");
    setNewDescription("");
    setNewStatus("Showcase Only");
    setNewMaterial("");
    setNewSizes("");
    setNewColors("");
    setNewFeatures("");
    setNewImagesList([]);

    // Close Modal
    setShowAddModal(false);
  };
```

Replace with:

```tsx
  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;

    setSubmitting(true);
    setActionError(null);
    try {
      const pendingFiles = newImagesList
        .map((url) => newImageFiles.get(url))
        .filter((f): f is File => f !== undefined);
      const uploadedUrls = pendingFiles.length > 0
        ? await uploadMerchImages(pendingFiles, supabase.storage.from("merch-images"))
        : [];
      let uploadIdx = 0;
      const finalImages = newImagesList.map((url) =>
        newImageFiles.has(url) ? uploadedUrls[uploadIdx++] : url
      );

      const draft: ProductDraft = {
        name: newName,
        category: newCategory,
        pricePlaceholder: newPrice,
        description: newDescription,
        status: newStatus,
        material: newMaterial,
        sizes: parseCommaList(newSizes),
        colors: parseCommaList(newColors),
        features: parseLineList(newFeatures),
        images: finalImages,
      };

      const { data, error } = await supabase
        .from("products")
        .insert({ ...toProductRecord(draft), created_by: user.id })
        .select()
        .single();
      if (error) throw error;

      setMerchItems([mapRowToMerchItem(data as ProductRow), ...merchItems]);

      // Reset Form
      setNewName("");
      setNewCategory("apparel");
      setNewPrice("");
      setNewDescription("");
      setNewStatus("Showcase Only");
      setNewMaterial("");
      setNewSizes("");
      setNewColors("");
      setNewFeatures("");
      setNewImagesList([]);
      setNewImageFiles(new Map());

      // Close Modal
      setShowAddModal(false);
    } catch (err: any) {
      setActionError(err.message || "Failed to add product. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
```

- [ ] **Step 6: Add loading and error rendering to the page's JSX**

Find the start of the component's `return`:

```tsx
  return (
    <div className="fade-in sd-root" style={{ paddingBottom: "60px" }}>
      {/* Header */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Official Showcase</p>
          <h1 className="sd-header-title">Merch Catalogue</h1>
        </div>
      </header>
```

Replace with:

```tsx
  if (loading) return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;

  return (
    <div className="fade-in sd-root" style={{ paddingBottom: "60px" }}>
      {/* Header */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Official Showcase</p>
          <h1 className="sd-header-title">Merch Catalogue</h1>
        </div>
      </header>

      {actionError && (
        <div className="sp-error-banner">
          <AlertTriangle size={16} /> {actionError}
        </div>
      )}
```

`sp-center-screen`, `sp-spinner`, and `sp-error-banner` are existing CSS classes already used the same way in `src/app/dashboard/schedule/page.tsx`.

- [ ] **Step 7: Type-check and lint**

Run: `npm run type-check`
Expected: no errors related to `src/app/dashboard/merch/page.tsx` or `src/lib/merch.ts`.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 8: Manual verification (no automated test exists for this component)**

Start the dev server (`npm run dev`) and, logged in as a facilitator or admin account:
1. Load `/dashboard/merch` — confirm the 4 seeded products appear (sourced from Supabase, not the old hardcoded array).
2. Click "Add new product", fill the form, upload a real image file, submit.
3. Confirm the new product appears in the grid immediately, and its image is a Supabase Storage URL (inspect the `<img src>` — should start with `https://<project>.supabase.co/storage/v1/object/public/merch-images/`).
4. Refresh the page — confirm the new product is still there (proves persistence).

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/merch/page.tsx
git commit -m "feat: load products from Supabase and persist new products with real image uploads"
```

---

### Task 5: Wire up real product editing and deletion in `page.tsx`

**Files:**
- Modify: `src/app/dashboard/merch/page.tsx`

**Interfaces:**
- Consumes: from `@/lib/merch`: `deleteMerchImages` (new import needed), plus everything already imported in Task 4.
- Produces: working "Edit" and "Delete" flows that persist to `public.products` and clean up Storage files on delete.

- [ ] **Step 1: Add `deleteMerchImages` to the `@/lib/merch` import**

Find the import block added in Task 4:

```tsx
import {
  type MerchItem,
  type ProductRow,
  type ProductDraft,
  parseCommaList,
  parseLineList,
  mapRowToMerchItem,
  toProductRecord,
  uploadMerchImages,
} from "@/lib/merch";
```

Replace with:

```tsx
import {
  type MerchItem,
  type ProductRow,
  type ProductDraft,
  parseCommaList,
  parseLineList,
  mapRowToMerchItem,
  toProductRecord,
  uploadMerchImages,
  deleteMerchImages,
} from "@/lib/merch";
```

- [ ] **Step 2: Track raw File objects for the edit form, mirroring the add form**

Find the `editImagesList` state declaration:

```tsx
  const [editImagesList, setEditImagesList] = useState<string[]>([]);
```

Add immediately after it:

```tsx
  const [editImageFiles, setEditImageFiles] = useState<Map<string, File>>(new Map());
```

Find `handleEditImageFile`:

```tsx
  const handleEditImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        urls.push(URL.createObjectURL(files[i]));
      }
      setEditImagesList([...editImagesList, ...urls]);
    }
  };
```

Replace with:

```tsx
  const handleEditImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const urls: string[] = [];
      const fileMap = new Map(editImageFiles);
      for (let i = 0; i < files.length; i++) {
        const url = URL.createObjectURL(files[i]);
        urls.push(url);
        fileMap.set(url, files[i]);
      }
      setEditImagesList([...editImagesList, ...urls]);
      setEditImageFiles(fileMap);
    }
  };
```

Find `handleEditProductClick` and add a reset of the new file map so a previous edit session's pending files don't leak into the next one:

```tsx
  const handleEditProductClick = (item: MerchItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditPrice(item.pricePlaceholder);
    setEditDescription(item.description);
    setEditStatus(item.status);
    setEditMaterial(item.details.material);
    setEditSizes(item.details.sizes ? item.details.sizes.join(", ") : "");
    setEditColors(item.details.colors.join(", "));
    setEditFeatures(item.details.features.join("\n"));
    setEditImagesList(item.images && item.images.length > 0 ? item.images : [item.image]);
  };
```

Replace the last line with two lines:

```tsx
    setEditImagesList(item.images && item.images.length > 0 ? item.images : [item.image]);
    setEditImageFiles(new Map());
  };
```

- [ ] **Step 3: Rewrite `handleEditProductSubmit` to upload images and update Supabase**

Find the full function (originally lines 280–313):

```tsx
  const handleEditProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const details = {
      material: editMaterial || "N/A",
      sizes: editSizes ? editSizes.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      colors: editColors ? editColors.split(",").map(c => c.trim()).filter(Boolean) : ["N/A"],
      features: editFeatures ? editFeatures.split("\n").map(f => f.trim()).filter(Boolean) : ["N/A"]
    };

    let finalImages = editImagesList.length > 0 ? editImagesList : ["/merch/shirt.png"];
    let primaryImage = finalImages[0];

    const updatedItem: MerchItem = {
      ...editingItem,
      name: editName,
      category: editCategory,
      pricePlaceholder: editPrice ? (editPrice.toUpperCase().startsWith("PHP") ? editPrice : `PHP ${editPrice}`) : "PHP 0.00",
      image: primaryImage,
      images: finalImages,
      description: editDescription || "No description provided.",
      status: editStatus,
      details
    };

    setMerchItems(merchItems.map(item => item.id === editingItem.id ? updatedItem : item));
    
    if (selectedItem?.id === editingItem.id) {
      setSelectedItem(updatedItem);
    }

    setEditingItem(null);
  };
```

Replace with:

```tsx
  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSubmitting(true);
    setActionError(null);
    try {
      const pendingFiles = editImagesList
        .map((url) => editImageFiles.get(url))
        .filter((f): f is File => f !== undefined);
      const uploadedUrls = pendingFiles.length > 0
        ? await uploadMerchImages(pendingFiles, supabase.storage.from("merch-images"))
        : [];
      let uploadIdx = 0;
      const finalImages = editImagesList.map((url) =>
        editImageFiles.has(url) ? uploadedUrls[uploadIdx++] : url
      );

      const draft: ProductDraft = {
        name: editName,
        category: editCategory,
        pricePlaceholder: editPrice,
        description: editDescription,
        status: editStatus,
        material: editMaterial,
        sizes: parseCommaList(editSizes),
        colors: parseCommaList(editColors),
        features: parseLineList(editFeatures),
        images: finalImages,
      };

      const { data, error } = await supabase
        .from("products")
        .update(toProductRecord(draft))
        .eq("id", editingItem.id)
        .select()
        .single();
      if (error) throw error;

      const updatedItem = mapRowToMerchItem(data as ProductRow);
      setMerchItems(merchItems.map((item) => (item.id === editingItem.id ? updatedItem : item)));

      if (selectedItem?.id === editingItem.id) {
        setSelectedItem(updatedItem);
      }

      setEditingItem(null);
      setEditImageFiles(new Map());
    } catch (err: any) {
      setActionError(err.message || "Failed to update product. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
```

- [ ] **Step 4: Rewrite `confirmDeleteProduct` to delete from Supabase and clean up Storage**

Find:

```tsx
  const confirmDeleteProduct = () => {
    if (!deletingItem) return;
    setMerchItems(merchItems.filter(item => item.id !== deletingItem.id));
    if (selectedItem?.id === deletingItem.id) {
      setSelectedItem(null);
    }
    setDeletingItem(null);
  };
```

Replace with:

```tsx
  const confirmDeleteProduct = async () => {
    if (!deletingItem) return;

    setActionError(null);
    try {
      const { error } = await supabase.from("products").delete().eq("id", deletingItem.id);
      if (error) throw error;

      // Best-effort cleanup — the row is already gone either way, so a
      // Storage failure here shouldn't block the delete from completing.
      await deleteMerchImages(
        deletingItem.images && deletingItem.images.length > 0 ? deletingItem.images : [deletingItem.image],
        supabase.storage.from("merch-images")
      ).catch((err) => console.error("Failed to clean up product images:", err));

      setMerchItems(merchItems.filter((item) => item.id !== deletingItem.id));
      if (selectedItem?.id === deletingItem.id) {
        setSelectedItem(null);
      }
      setDeletingItem(null);
    } catch (err: any) {
      setActionError(err.message || "Failed to delete product. Please try again.");
      setDeletingItem(null);
    }
  };
```

- [ ] **Step 5: Type-check and lint**

Run: `npm run type-check`
Expected: no errors related to `src/app/dashboard/merch/page.tsx`.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Manual verification (no automated test exists for this component)**

With the dev server running, logged in as a facilitator or admin:
1. Edit an existing product (e.g. change its name and add a new uploaded image) — confirm the change appears immediately and survives a page refresh.
2. Delete a product you created in Task 4's manual test — confirm it disappears from the grid and, after refresh, stays gone.
3. In the Supabase Dashboard → Storage → `merch-images`, confirm the deleted product's uploaded file is also gone.
4. Log in as a student account — confirm the "Add new product" button and the per-card edit/delete buttons are not visible (read-only view).

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/merch/page.tsx
git commit -m "feat: persist product edits and deletes, with Storage image cleanup"
```
