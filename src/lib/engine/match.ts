import {
  ATTRIBUTE_LABELS,
  DEFAULT_RESULT_LIMIT,
  EQUIVALENCES,
  SCORE_WEIGHTS,
  UNCONFIRMABLE,
} from "../config";
import {
  ATTRIBUTES,
  type Attribute,
  type CellStatus,
  type ComparisonCell,
  type EngineResult,
  type Preferences,
  type Product,
  type Recommendation,
} from "../types";

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** True when the value can confirm or deny a match. Unknown / "Other" cannot. */
export function isKnown(v: string | null | undefined): boolean {
  return !UNCONFIRMABLE.has(norm(v));
}

export function valuesMatch(attr: Attribute, a: string | null, b: string | null): boolean {
  if (!isKnown(a) || !isKnown(b)) return false;
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  return (EQUIVALENCES[attr] ?? []).some((group) => group.includes(x) && group.includes(y));
}

function cellStatus(attr: Attribute, target: string | null, candidate: string | null): CellStatus {
  if (!isKnown(candidate) || !isKnown(target)) return "unknown";
  return valuesMatch(attr, target, candidate) ? "match" : "differ";
}

export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = "";
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return `${host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return null;
  }
}

const nameKey = (p: Product) => `${norm(p.name)}|${norm(p.retailer)}`;

export function isSameProduct(original: Product, candidate: Product): boolean {
  if (original.catalog_product_id && candidate.id && original.catalog_product_id === candidate.id) return true;
  const a = normalizeUrl(original.product_url);
  const b = normalizeUrl(candidate.product_url);
  if (a && b && a === b) return true;
  return nameKey(original) === nameKey(candidate);
}

/** Default preferences: prefer every attribute the original product is known to have. */
export function defaultPreferences(original: Product): Preferences {
  const prefs = {} as Preferences;
  for (const attr of ATTRIBUTES) {
    const value = isKnown(original[attr]) ? original[attr] : null;
    prefs[attr] = { mode: value ? "prefer" : "ignore", value };
  }
  return prefs;
}

/** Drops constraints that have no target value, so they can't silently match everything. */
function effectivePreferences(prefs: Preferences): Preferences {
  const out = { ...prefs };
  for (const attr of ATTRIBUTES) {
    if (out[attr].mode !== "ignore" && !isKnown(out[attr].value)) {
      out[attr] = { mode: "ignore", value: null };
    }
  }
  return out;
}

export interface FilterOutcome {
  passed: Product[];
  excluded: EngineResult["excluded"];
}

/** Step 1: hard filtering. Must-haves are strict and unknown never counts as a match. */
export function hardFilter(original: Product, candidates: Product[], rawPrefs: Preferences): FilterOutcome {
  const prefs = effectivePreferences(rawPrefs);
  const excluded = { mustFail: 0, unknownRequired: 0, sameProduct: 0, duplicate: 0 };
  const passed: Product[] = [];
  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();

  for (const c of candidates) {
    if (isSameProduct(original, c)) {
      excluded.sameProduct++;
      continue;
    }
    const url = normalizeUrl(c.product_url);
    const key = nameKey(c);
    if ((url && seenUrls.has(url)) || seenNames.has(key)) {
      excluded.duplicate++;
      continue;
    }

    let rejected: "unknownRequired" | "mustFail" | null = null;
    for (const attr of ATTRIBUTES) {
      const p = prefs[attr];
      if (p.mode !== "must") continue;
      if (!isKnown(c[attr])) {
        rejected = "unknownRequired";
        break;
      }
      if (!valuesMatch(attr, p.value, c[attr])) rejected = "mustFail";
    }
    if (rejected) {
      excluded[rejected]++;
      continue;
    }

    if (url) seenUrls.add(url);
    seenNames.add(key);
    passed.push(c);
  }
  return { passed, excluded };
}

/**
 * Step 2: similarity score over "Prefer" attributes only.
 * score = earned weight / total preferred weight * 100. Unknown earns nothing.
 * Returns null when the user prefers nothing (nothing to score).
 */
export function scoreCandidate(candidate: Product, rawPrefs: Preferences): number | null {
  const prefs = effectivePreferences(rawPrefs);
  let total = 0;
  let earned = 0;
  for (const attr of ATTRIBUTES) {
    if (prefs[attr].mode !== "prefer") continue;
    const w = SCORE_WEIGHTS[attr];
    total += w;
    if (valuesMatch(attr, prefs[attr].value, candidate[attr])) earned += w;
  }
  if (total === 0) return null;
  return Math.round((earned / total) * 1000) / 10;
}

export function compare(original: Product, candidate: Product, rawPrefs: Preferences): ComparisonCell[] {
  const prefs = effectivePreferences(rawPrefs);
  return ATTRIBUTES.map((attr) => {
    // Compare against the original unless the user chose a different target value.
    const target = prefs[attr].mode !== "ignore" ? prefs[attr].value : original[attr];
    const status = cellStatus(attr, target, candidate[attr]);
    return {
      attribute: attr,
      mode: prefs[attr].mode,
      original: isKnown(original[attr]) ? original[attr] : null,
      candidate: isKnown(candidate[attr]) ? candidate[attr] : null,
      status,
      mustSatisfied: prefs[attr].mode === "must" && status === "match",
    };
  });
}

const phrase = (attr: Attribute, value: string) => {
  const v = value.toLowerCase();
  switch (attr) {
    case "color":
      return `${v} color`;
    case "material":
      return `${v} material`;
    case "style":
      return `${v} style`;
    case "silhouette":
      return `${v} silhouette`;
    case "hardware":
      return `${v} hardware`;
    case "closure":
      return `${v} closure`;
    case "size":
      return `${v} size`;
    case "category":
      return `${v} bag type`;
  }
};

const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")}${items.length > 2 ? "," : ""} and ${items[items.length - 1]}`;

/** Deterministic explanation built only from the actual comparison cells. */
export function explain(cells: ComparisonCell[], score: number | null): string {
  const byWeight = (a: ComparisonCell, b: ComparisonCell) =>
    SCORE_WEIGHTS[b.attribute] - SCORE_WEIGHTS[a.attribute];
  const active = cells.filter((c) => c.mode !== "ignore");
  const preferredMatches = active.filter((c) => c.mode === "prefer" && c.status === "match").sort(byWeight);
  const musts = active.filter((c) => c.mustSatisfied).sort(byWeight);
  const diffs = active.filter((c) => c.mode !== "must" && c.status === "differ").sort(byWeight);
  const unknowns = active.filter((c) => c.mode === "prefer" && c.status === "unknown").sort(byWeight);

  const parts: string[] = [];
  if (preferredMatches.length)
    parts.push(
      `Matches your preferred ${list(preferredMatches.map((c) => phrase(c.attribute, c.candidate ?? "")))}.`,
    );
  if (musts.length)
    parts.push(`It meets your required ${list(musts.map((c) => phrase(c.attribute, c.candidate ?? "")))}.`);
  if (diffs.length) {
    const d = diffs[0];
    const more = diffs.length > 1 ? ` (${diffs.length - 1} other preferred ${diffs.length === 2 ? "attribute differs" : "attributes differ"})` : "";
    parts.push(
      `The main difference is ${phrase(d.attribute, d.candidate ?? "")} instead of ${(d.original ?? d.candidate ?? "").toLowerCase()}${more}.`,
    );
  }
  if (unknowns.length)
    parts.push(
      `Not confirmed by the listing: ${list(unknowns.map((c) => ATTRIBUTE_LABELS[c.attribute].toLowerCase()))}.`,
    );
  if (!parts.length)
    parts.push(
      active.length === 0
        ? "You haven't chosen any preferences yet, so this is just a similar-looking bag."
        : "No attributes could be confirmed against your preferences.",
    );
  if (score === null) parts.push("You chose no preferred attributes, so results are not scored.");
  return parts.join(" ");
}

/** The single recommendation entry point used for BOTH catalog and live candidates. */
export function recommend(
  original: Product,
  candidates: Product[],
  prefs: Preferences,
  limit = DEFAULT_RESULT_LIMIT,
): EngineResult {
  const { passed, excluded } = hardFilter(original, candidates, prefs);

  const scored: Recommendation[] = passed.map((product) => {
    const score = scoreCandidate(product, prefs);
    const cells = compare(original, product, prefs);
    return {
      product,
      score,
      cells,
      matched: cells.filter((c) => c.status === "match").map((c) => c.attribute),
      differences: cells.filter((c) => c.status === "differ").map((c) => c.attribute),
      unknown: cells.filter((c) => c.status === "unknown" && c.mode !== "ignore").map((c) => c.attribute),
      mustSatisfied: cells.filter((c) => c.mustSatisfied).map((c) => c.attribute),
      explanation: explain(cells, score),
    };
  });

  scored.sort(
    (a, b) =>
      (b.score ?? -1) - (a.score ?? -1) ||
      b.matched.length - a.matched.length ||
      a.unknown.length - b.unknown.length ||
      a.product.name.localeCompare(b.product.name) ||
      (a.product.product_url ?? "").localeCompare(b.product.product_url ?? ""),
  );

  const recommendations = scored.slice(0, limit);
  let notice: string | null = null;
  if (recommendations.length === 0) {
    notice =
      "No candidates met all of your must-have requirements. Try relaxing a must-have to Prefer, or switch an attribute to Don't care.";
  } else if (recommendations.length < 3) {
    notice = `Only ${recommendations.length} confirmed ${recommendations.length === 1 ? "match was" : "matches were"} found. We show what is available rather than guessing.`;
  }
  return { recommendations, considered: candidates.length, excluded, notice };
}
