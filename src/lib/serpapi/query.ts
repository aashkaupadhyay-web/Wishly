import { isKnown } from "../engine/match";
import type { Attribute, Preferences, Product } from "../types";

/** Builds a short Google Shopping query from the original product and the user's preferences. */
export function buildQuery(original: Product, prefs: Preferences): string {
  const wanted = (attr: Attribute): string | null => {
    const p = prefs[attr];
    if (p.mode === "ignore") return null;
    const v = p.value ?? original[attr];
    return isKnown(v) ? (v as string).toLowerCase() : null;
  };

  // Soft style words ("minimalist", "classic", "casual") are rarely in retailer titles, so they only
  // narrow Google's results to nothing useful. Keep them only when required (or genuinely common).
  const COMMON_STYLE = new Set(["structured", "slouchy"]);
  const styleFor = (attr: "style" | "silhouette") => {
    const v = wanted(attr);
    return v && (prefs[attr].mode === "must" || COMMON_STYLE.has(v)) ? v : null;
  };
  const style = styleFor("style") ?? styleFor("silhouette");
  const parts = [
    wanted("color"),
    style,
    wanted("material"),
    wanted("category"),
    "handbag",
    // Closure is a narrow detail; only search on it when it's a must-have.
    prefs.closure.mode === "must" ? wanted("closure") : null,
    prefs.hardware.mode === "must" ? wanted("hardware") : null,
    prefs.size.mode === "must" ? wanted("size") : null,
  ];

  const words: string[] = [];
  for (const phrase of parts) {
    if (!phrase) continue;
    for (const w of phrase.split(/\s+/)) {
      if (w && !words.includes(w)) words.push(w);
    }
  }
  return words.slice(0, 9).join(" ");
}

export const cacheKeyFor = (query: string) => query.toLowerCase().replace(/\s+/g, " ").trim();
