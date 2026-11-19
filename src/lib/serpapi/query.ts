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

  const style = wanted("style") ?? wanted("silhouette");
  const parts = [
    wanted("color"),
    style,
    wanted("material"),
    wanted("category"),
    "handbag",
    wanted("closure"),
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
