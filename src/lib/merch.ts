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

/** Strips a filename down to a safe character set and length for use in a Storage object path. */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

/** Uploads each file to Storage under a unique path and returns their public URLs, in input order. */
export async function uploadMerchImages(
  files: File[],
  uploader: MerchImageUploader
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizeFilename(file.name)}`;
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
