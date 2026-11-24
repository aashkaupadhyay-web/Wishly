import type { Attribute } from "./types";

/**
 * ---- Recommendation scoring weights (single place to tune) ----
 * The five attributes from the product brief total 100:
 *   color 25 + material 25 + style/silhouette 25 (style 15 + silhouette 10) + hardware 10 + size 15
 * Category and closure are extra attributes. They only count when the user marks
 * them "Prefer"; the score is normalised by the weights of the preferred attributes,
 * so adding them never makes scores unfair.
 */
export const SCORE_WEIGHTS: Record<Attribute, number> = {
  color: 25,
  material: 25,
  style: 15,
  silhouette: 10,
  hardware: 10,
  size: 15,
  category: 20,
  closure: 10,
};

export const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  category: "Bag type",
  color: "Color",
  material: "Material",
  style: "Style",
  silhouette: "Silhouette",
  hardware: "Hardware",
  closure: "Closure",
  size: "Size",
};

/** Controlled vocabularies used by forms. Free-text values are still accepted. */
export const OPTIONS: Record<Attribute | "shape", string[]> = {
  category: ["Tote", "Shoulder Bag", "Crossbody", "Satchel", "Bucket Bag", "Top-Handle", "Other"],
  color: ["Black", "Brown", "Tan", "White", "Beige", "Red", "Blue", "Green", "Gray", "Pink", "Other"],
  material: ["Leather", "Suede", "Canvas", "Nylon", "Vegan Leather", "Other"],
  style: ["Structured", "Slouchy", "Minimalist", "Classic", "Casual", "Other"],
  silhouette: ["Structured", "Slouchy", "Boxy", "Rounded", "Trapezoid", "Other"],
  hardware: ["Gold", "Silver", "Brass", "Black", "Other"],
  closure: ["Zipper", "Magnetic Snap", "Buckle", "Open Top", "Drawstring", "Other"],
  size: ["Mini", "Small", "Medium", "Large"],
  shape: ["Rectangular", "Square", "Round", "Trapezoid", "Crescent", "Other"],
};

/**
 * Explicit equivalences. Anything not listed here is NOT considered equal.
 * (e.g. leather and vegan leather are deliberately not linked.)
 * Keys and values are compared lower-cased.
 */
export const EQUIVALENCES: Partial<Record<Attribute, string[][]>> = {
  color: [
    ["black", "jet black", "onyx"],
    ["brown", "chocolate", "espresso"],
    ["tan", "camel"],
    ["beige", "cream"],
  ],
  style: [["structured", "rigid"]],
  hardware: [["gold", "gold-tone"], ["silver", "silver-tone"]],
};

/** Values that never confirm a match (we cannot verify "Other"). */
export const UNCONFIRMABLE = new Set(["", "unknown", "other", "n/a", "none"]);

export const DEFAULT_RESULT_LIMIT = 3;

export const SERPAPI = {
  /** Hard ceiling is 250 (free tier). The env var can only lower it, never raise it. */
  monthlyLimit: Math.min(250, Math.max(0, Number(process.env.SERPAPI_MONTHLY_LIMIT ?? 250) || 0)),
  cacheTtlDays: 14,
  endpoint: "https://serpapi.com/search.json",
  timeoutMs: 20_000,
};
