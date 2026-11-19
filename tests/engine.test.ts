import { describe, expect, it } from "vitest";
import { CATALOG } from "@/data/catalog";
import { SCORE_WEIGHTS } from "@/lib/config";
import { defaultPreferences, explain, recommend, scoreCandidate, valuesMatch } from "@/lib/engine/match";
import type { Preferences, Product } from "@/lib/types";

const base: Product = {
  source: "wishlist", name: "My Bag", retailer: "Somewhere", product_url: "https://shop.example/my-bag",
  image_url: null, category: "Tote", subcategory: null, color: "Black", material: "Leather", style: "Structured",
  silhouette: null, hardware: "Gold", closure: "Zipper", size: "Medium", shape: null, description: null,
};

const mk = (over: Partial<Product>): Product => ({ ...base, source: "catalog", name: `C-${Math.random()}`, product_url: null, ...over });

/** The example from the brief. */
const prefs: Preferences = {
  category: { mode: "ignore", value: "Tote" },
  color: { mode: "prefer", value: "Black" },
  material: { mode: "must", value: "Leather" },
  style: { mode: "prefer", value: "Structured" },
  silhouette: { mode: "ignore", value: null },
  hardware: { mode: "ignore", value: "Gold" },
  closure: { mode: "must", value: "Zipper" },
  size: { mode: "prefer", value: "Medium" },
};

describe("weights", () => {
  it("the five brief attributes total 100", () => {
    const { color, material, style, silhouette, hardware, size } = SCORE_WEIGHTS;
    expect(color + material + style + silhouette + hardware + size).toBe(100);
  });
});

describe("matching rules", () => {
  it("leather and vegan leather are not equivalent", () => {
    expect(valuesMatch("material", "Leather", "Vegan Leather")).toBe(false);
  });
  it("configured equivalences work, unconfigured do not", () => {
    expect(valuesMatch("color", "Black", "Jet Black")).toBe(true);
    expect(valuesMatch("color", "Black", "Brown")).toBe(false);
    expect(valuesMatch("category", "Tote", "Structured Tote")).toBe(false);
  });
  it("unknown and Other never match, even each other", () => {
    expect(valuesMatch("color", null, null)).toBe(false);
    expect(valuesMatch("color", "Other", "Other")).toBe(false);
  });
});

describe("hard filtering", () => {
  it("enforces must-haves and excludes unknown required attributes", () => {
    const res = recommend(base, [
      mk({ name: "ok" }),
      mk({ name: "wrong material", material: "Suede" }),
      mk({ name: "vegan", material: "Vegan Leather" }),
      mk({ name: "unknown closure", closure: null }),
      mk({ name: "other closure", closure: "Other" }),
    ], prefs, 10);
    expect(res.recommendations.map((r) => r.product.name)).toEqual(["ok"]);
    expect(res.excluded.mustFail).toBe(2);
    expect(res.excluded.unknownRequired).toBe(2);
  });

  it("excludes the original product (by URL or name) and duplicates", () => {
    const res = recommend(base, [
      mk({ name: "same url", product_url: "https://www.shop.example/my-bag/#x" }),
      mk({ name: "My Bag", retailer: "Somewhere" }),
      mk({ name: "dup", product_url: "https://a.example/dup" }),
      mk({ name: "dup2", product_url: "https://a.example/dup" }),
      mk({ name: "Dup", product_url: "https://b.example/other" }),
    ], prefs, 10);
    expect(res.excluded.sameProduct).toBe(2);
    expect(res.excluded.duplicate).toBe(2);
    expect(res.recommendations).toHaveLength(1);
  });

  it("ignores a must-have that has no target value rather than matching everything", () => {
    const p: Preferences = { ...prefs, hardware: { mode: "must", value: null } };
    const res = recommend(base, [mk({ name: "a", hardware: "Silver" })], p);
    expect(res.recommendations).toHaveLength(1);
  });
});

describe("scoring and ranking", () => {
  it("scores only Prefer attributes, normalised by their weights", () => {
    // preferred: color 25 + style 15 + size 15 = 55
    expect(scoreCandidate(mk({}), prefs)).toBe(100);
    expect(scoreCandidate(mk({ style: "Classic" }), prefs)).toBe(72.7); // 40/55
    expect(scoreCandidate(mk({ color: "Brown", style: "Classic" }), prefs)).toBe(27.3); // 15/55
    // hardware is "don't care": a differing value does not change the score
    expect(scoreCandidate(mk({ hardware: "Silver" }), prefs)).toBe(100);
  });

  it("gives no points for unknown attributes", () => {
    expect(scoreCandidate(mk({ size: null }), prefs)).toBe(72.7); // 40/55
  });

  it("ranks by score and returns at most three by default", () => {
    const res = recommend(base, [
      mk({ name: "low", color: "Brown", style: "Classic", size: "Large" }),
      mk({ name: "top" }),
      mk({ name: "mid", style: "Classic" }),
      mk({ name: "mid2", size: "Small" }),
    ], prefs);
    expect(res.recommendations).toHaveLength(3);
    expect(res.recommendations[0].product.name).toBe("top");
    const scores = res.recommendations.map((r) => r.score!);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("returns null scores (not a fake 100) when nothing is preferred", () => {
    const none: Preferences = { ...prefs, color: { mode: "ignore", value: null }, style: { mode: "ignore", value: null }, size: { mode: "ignore", value: null } };
    const res = recommend(base, [mk({ name: "a" })], none);
    expect(res.recommendations[0].score).toBeNull();
    expect(res.recommendations[0].explanation).toMatch(/not scored/);
  });

  it("shows fewer than three honestly with a notice, and a notice for zero", () => {
    const one = recommend(base, [mk({ name: "a" })], prefs);
    expect(one.recommendations).toHaveLength(1);
    expect(one.notice).toMatch(/Only 1/);
    const zero = recommend(base, [mk({ material: "Suede" })], prefs);
    expect(zero.recommendations).toHaveLength(0);
    expect(zero.notice).toMatch(/must-have/);
  });
});

describe("explanations", () => {
  it("reflects the actual comparison", () => {
    const res = recommend(base, [mk({ name: "x", hardware: "Silver", size: "Small" })], {
      ...prefs, hardware: { mode: "prefer", value: "Gold" },
    });
    const r = res.recommendations[0];
    expect(r.explanation).toContain("Matches your preferred black color and structured style");
    expect(r.explanation).toContain("required leather material and zipper closure");
    expect(r.explanation).toContain("main difference is");
    expect(r.matched).toContain("color");
    expect(r.differences).toEqual(expect.arrayContaining(["hardware", "size"]));
  });

  it("flags unconfirmed preferred attributes instead of claiming them", () => {
    const res = recommend(base, [mk({ name: "x", size: null })], prefs);
    expect(res.recommendations[0].explanation).toContain("Not confirmed by the listing: size");
    expect(res.recommendations[0].unknown).toContain("size");
  });

  it("never claims a match when nothing matched", () => {
    const cell = { attribute: "color", mode: "prefer", original: "Black", candidate: null, status: "unknown", mustSatisfied: false } as const;
    expect(explain([{ ...cell, attribute: "color" }], 0)).toMatch(/Not confirmed|No attributes could be confirmed/);
    expect(explain([], null)).toMatch(/haven't chosen any preferences/);
  });
});

describe("defaults and catalog", () => {
  it("defaults to preferring known attributes of the original", () => {
    const d = defaultPreferences(base);
    expect(d.color).toEqual({ mode: "prefer", value: "Black" });
    expect(d.silhouette.mode).toBe("ignore");
  });

  it("catalog has enough variety and works end to end", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CATALOG.map((c) => c.category)).size).toBeGreaterThanOrEqual(6);
    const res = recommend(base, CATALOG, prefs);
    expect(res.recommendations.length).toBe(3);
    for (const r of res.recommendations) {
      expect(r.product.material).toBe("Leather");
      expect(r.product.closure).toBe("Zipper");
    }
  });
});
