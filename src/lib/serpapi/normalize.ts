import { extractAttributes } from "../extract";
import type { Product } from "../types";
import { isSafeHttpUrl } from "../validation";

// Re-exported so existing imports keep working; the rules live in ../extract.
export { extractAttributes };

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface SerpShoppingResult {
  title?: unknown;
  link?: unknown;
  product_link?: unknown;
  source?: unknown;
  thumbnail?: unknown;
  snippet?: unknown;
  extensions?: unknown;
  // `price`, `extracted_price`, etc. are intentionally never read.
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Normalise SerpAPI `shopping_results` into the shared Product shape. Prices are discarded. */
export function normalizeSerpResults(json: unknown): Product[] {
  const results = (json as { shopping_results?: unknown })?.shopping_results;
  if (!Array.isArray(results)) return [];
  const out: Product[] = [];
  for (const raw of results as SerpShoppingResult[]) {
    const name = str(raw?.title);
    const link = str(raw?.link) ?? str(raw?.product_link);
    if (!name || !link || !isSafeHttpUrl(link)) continue;
    const thumb = str(raw.thumbnail);
    const ext = Array.isArray(raw.extensions)
      ? raw.extensions.filter((e): e is string => typeof e === "string").join(" ")
      : "";
    const snippet = str(raw.snippet);
    const attrs = extractAttributes([name, snippet ?? "", ext].join(" . "));
    out.push({
      id: `serp-${hash(link + name)}`,
      source: "serpapi",
      name,
      retailer: str(raw.source),
      product_url: link,
      image_url: thumb && isSafeHttpUrl(thumb) ? thumb : null,
      subcategory: null,
      shape: null,
      description: [snippet, ext.trim() || null].filter(Boolean).join(" · ") || null,
      ...attrs,
    });
  }
  return out;
}
