import { isSafeHttpUrl } from "../validation";
import type { Product } from "../types";

type Rule = [RegExp, string];

const CATEGORY: Rule[] = [
  [/\btotes?\b/i, "Tote"],
  [/\bshoulder\s+bags?\b/i, "Shoulder Bag"],
  [/\bcross[\s-]?body\b/i, "Crossbody"],
  [/\bsatchels?\b/i, "Satchel"],
  [/\bbucket\s+bags?\b/i, "Bucket Bag"],
  [/\btop[\s-]?handle\b/i, "Top-Handle"],
];
const COLOR: Rule[] = [
  [/\b(black|jet black|onyx)\b/i, "Black"],
  [/\bbrown\b/i, "Brown"],
  [/\btan\b/i, "Tan"],
  [/\bwhite\b/i, "White"],
  [/\bbeige\b/i, "Beige"],
  [/\bred\b/i, "Red"],
];
const MATERIAL: Rule[] = [
  [/\b(vegan|faux|pu)[\s-]leather\b/i, "Vegan Leather"],
  // Plain "leather" must not fire on "vegan/faux/PU leather".
  [/(?<!\b(?:vegan|faux|pu)[\s-])\bleather\b/i, "Leather"],
  [/\bsuede\b/i, "Suede"],
  [/\bcanvas\b/i, "Canvas"],
  [/\bnylon\b/i, "Nylon"],
];
const STYLE: Rule[] = [
  [/\bstructured\b/i, "Structured"],
  [/\bslouch(y)?\b/i, "Slouchy"],
  [/\bminimal(ist)?\b/i, "Minimalist"],
  [/\bclassic\b/i, "Classic"],
  [/\bcasual\b/i, "Casual"],
];
const SILHOUETTE: Rule[] = [
  [/\bstructured\b/i, "Structured"],
  [/\bslouch(y)?\b/i, "Slouchy"],
  [/\bboxy\b/i, "Boxy"],
  [/\brounded\b/i, "Rounded"],
  [/\btrapezoid\b/i, "Trapezoid"],
];
const HARDWARE: Rule[] = [
  [/\bgold[\s-]?(tone\b|hardware\b)/i, "Gold"],
  [/\bsilver[\s-]?(tone\b|hardware\b)/i, "Silver"],
  [/\bbrass\s+hardware\b/i, "Brass"],
  [/\bblack\s+hardware\b/i, "Black"],
];
const CLOSURE: Rule[] = [
  [/\bzip(per|-top|\s+top|\s+closure)?\b/i, "Zipper"],
  [/\bmagnetic\b/i, "Magnetic Snap"],
  [/\bbuckle\b/i, "Buckle"],
  [/\bopen[\s-]top\b/i, "Open Top"],
  [/\bdrawstring\b/i, "Drawstring"],
];
/** Returns a value only when exactly one distinct value is explicitly supported by the text. */
function detect(text: string, rules: Rule[]): string | null {
  const found = new Set<string>();
  for (const [re, value] of rules) if (re.test(text)) found.add(value);
  return found.size === 1 ? [...found][0] : null;
}

/** Size words only count when they plainly describe the bag ("medium leather tote", "large size"). */
function detectSize(text: string): string | null {
  const found = new Set<string>();
  const re = /\b(mini|small|medium|large)\b(?:\W+\w+){0,2}?\W+(?:bag|tote|handbag|satchel|crossbody|purse)\b|\b(mini|small|medium|large)\s+size\b/gi;
  for (const m of text.matchAll(re)) {
    const word = (m[1] ?? m[2]).toLowerCase();
    found.add(word[0].toUpperCase() + word.slice(1));
  }
  return found.size === 1 ? [...found][0] : null;
}

/** Deterministic text rules. Anything not explicitly stated stays null (unknown). */
export function extractAttributes(text: string) {
  const category = detect(text, CATEGORY);
  const material = detect(text, MATERIAL);
  return {
    category,
    color: detect(text, COLOR),
    material,
    style: detect(text, STYLE),
    silhouette: detect(text, SILHOUETTE),
    hardware: detect(text, HARDWARE),
    closure: detect(text, CLOSURE),
    size: detectSize(text),
  };
}

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
