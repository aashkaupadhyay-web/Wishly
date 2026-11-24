import { describe, expect, it, vi } from "vitest";
import { recommend } from "@/lib/engine/match";
import { extractAttributes, normalizeSerpResults } from "@/lib/serpapi/normalize";
import { buildQuery } from "@/lib/serpapi/query";
import { liveSearch, type LiveSearchDeps } from "@/lib/serpapi/search";
import type { Preferences, Product } from "@/lib/types";
import { isSafeHttpUrl } from "@/lib/validation";

const FIXTURE = {
  shopping_results: [
    { title: "Black Structured Leather Tote Bag with Zip Closure", link: "https://shop.example/a", source: "ExampleShop", thumbnail: "https://img.example/a.jpg", price: "$120.00", extracted_price: 120, snippet: "Gold-tone hardware" },
    { title: "Canvas bag", link: "https://shop.example/b", source: "Other", price: "$20" },
    { title: "Black and brown leather tote", link: "https://shop.example/c", source: "Amb" },
    { title: "Vegan leather tote", link: "javascript:alert(1)", source: "Evil" },
    { title: "Medium suede crossbody bag", product_link: "https://shop.example/d", source: "Fallback" },
  ],
};

describe("normalization", () => {
  const out = normalizeSerpResults(FIXTURE);
  it("maps results to the shared product shape and drops prices and unsafe links", () => {
    expect(out).toHaveLength(4);
    expect(JSON.stringify(out)).not.toMatch(/120|price/i);
    expect(out[0]).toMatchObject({ source: "serpapi", retailer: "ExampleShop", product_url: "https://shop.example/a", image_url: "https://img.example/a.jpg" });
  });
  it("extracts only explicitly supported attributes", () => {
    expect(out[0]).toMatchObject({ category: "Tote", color: "Black", material: "Leather", style: "Structured", closure: "Zipper", hardware: "Gold" });
    expect(out[0].size).toBeNull();
    expect(out[1]).toMatchObject({ material: "Canvas", color: null, category: null, closure: null });
  });
  it("marks ambiguous attributes unknown", () => {
    expect(out[2].color).toBeNull();
    expect(out[2].material).toBe("Leather");
  });
  it("distinguishes vegan leather from leather and detects size only when it describes the bag", () => {
    expect(extractAttributes("Vegan leather tote").material).toBe("Vegan Leather");
    expect(extractAttributes("Faux leather and leather trim").material).toBeNull();
    expect(out[3]).toMatchObject({ size: "Medium", material: "Suede", category: "Crossbody" });
    expect(extractAttributes("Large capacity organizer").size).toBeNull();
  });
  it("tolerates garbage", () => {
    expect(normalizeSerpResults(null)).toEqual([]);
    expect(normalizeSerpResults({ shopping_results: "x" })).toEqual([]);
  });
});

describe("query builder", () => {
  const original: Product = { source: "wishlist", name: "o", retailer: null, product_url: null, image_url: null, category: "Tote", subcategory: null, color: "Black", material: "Leather", style: "Structured", silhouette: "Structured", hardware: "Gold", closure: "Zipper", size: "Medium", shape: null, description: null };
  const prefs: Preferences = {
    category: { mode: "prefer", value: "Tote" }, color: { mode: "prefer", value: "Black" }, material: { mode: "must", value: "Leather" },
    style: { mode: "prefer", value: "Structured" }, silhouette: { mode: "prefer", value: "Structured" }, hardware: { mode: "ignore", value: null },
    closure: { mode: "must", value: "Zipper" }, size: { mode: "prefer", value: "Medium" },
  };
  it("builds the brief's example query without repeats", () => {
    expect(buildQuery(original, prefs)).toBe("black structured leather tote handbag zipper");
  });
  it("leaves out ignored attributes", () => {
    expect(buildQuery(original, { ...prefs, color: { mode: "ignore", value: null } })).not.toContain("black");
  });
});

/** In-memory stand-in for the SQL function: one atomic increment-if-below-limit. */
function fakeDeps(over: Partial<LiveSearchDeps> = {}) {
  let used = 0;
  const cache = new Map<string, Product[]>();
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 }));
  const deps: LiveSearchDeps = {
    apiKey: "k", enabled: "true", limit: 250,
    cacheGet: async (k) => cache.get(k) ?? null,
    cacheSet: async (k, p) => void cache.set(k, p),
    reserve: async (limit) => {
      await Promise.resolve();
      if (used < Math.min(limit, 250)) { used++; return { allowed: true, used }; }
      return { allowed: false, used };
    },
    fetchImpl: fetchImpl as unknown as typeof fetch,
    ...over,
  };
  return { deps, fetchImpl, used: () => used };
}

describe("live search quota, cache, and failure handling", () => {
  it("does nothing when disabled or without a key", async () => {
    for (const over of [{ enabled: "false" }, { enabled: undefined }, { apiKey: undefined }]) {
      const { deps, fetchImpl, used } = fakeDeps(over);
      const r = await liveSearch("q", deps);
      expect(["disabled", "not_configured"]).toContain(r.status);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(used()).toBe(0);
    }
  });

  it("reserves a credit, normalizes results, and serves repeats from cache without a new credit", async () => {
    const { deps, fetchImpl, used } = fakeDeps();
    const a = await liveSearch("Black  Tote", deps);
    const b = await liveSearch("black tote", deps);
    expect(a.status).toBe("ok");
    expect(a.products[0].source).toBe("serpapi");
    expect(b.status).toBe("cached");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(used()).toBe(1);
  });

  it("shares one credit between identical concurrent requests", async () => {
    const { deps, fetchImpl, used } = fakeDeps();
    await Promise.all([liveSearch("same", deps), liveSearch("same", deps), liveSearch("same", deps)]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(used()).toBe(1);
  });

  it("never exceeds 250 under concurrency and sends no request after exhaustion", async () => {
    const { deps, fetchImpl, used } = fakeDeps({ limit: 9999 }); // caller can't raise the ceiling
    const results = await Promise.all(Array.from({ length: 400 }, (_, i) => liveSearch(`query ${i}`, deps)));
    expect(used()).toBe(250);
    expect(fetchImpl).toHaveBeenCalledTimes(250);
    expect(results.filter((r) => r.status === "quota_exhausted")).toHaveLength(150);
    const after = await liveSearch("brand new query", deps);
    expect(after.status).toBe("quota_exhausted");
    expect(after.message).toMatch(/temporarily unavailable/);
    expect(fetchImpl).toHaveBeenCalledTimes(250);
  });

  it("counts failed requests against the quota and never retries", async () => {
    const bad = vi.fn(async () => new Response("boom", { status: 500 }));
    const { deps, used } = fakeDeps({ fetchImpl: bad as unknown as typeof fetch });
    const r = await liveSearch("fail", deps);
    expect(r.status).toBe("error");
    expect(r.detail).toContain("HTTP 500");
    expect(r.products).toEqual([]);
    expect(bad).toHaveBeenCalledTimes(1);
    expect(used()).toBe(1);

    const throwing = vi.fn(async () => { throw new Error("network"); });
    const t = fakeDeps({ fetchImpl: throwing as unknown as typeof fetch });
    expect((await liveSearch("throw", t.deps)).status).toBe("error");
    expect(throwing).toHaveBeenCalledTimes(1);
    expect(t.used()).toBe(1);
  });

  it("does not call the API if the quota check itself fails", async () => {
    const { deps, fetchImpl } = fakeDeps({ reserve: async () => { throw new Error("db down"); } });
    expect((await liveSearch("x", deps)).status).toBe("error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("live results go through the same engine as catalog products", async () => {
    const { deps } = fakeDeps();
    const live = await liveSearch("black tote", deps);
    const original: Product = { source: "wishlist", name: "o", retailer: null, product_url: null, image_url: null, category: "Tote", subcategory: null, color: "Black", material: "Leather", style: "Structured", silhouette: null, hardware: null, closure: "Zipper", size: null, shape: null, description: null };
    const prefs = { category: { mode: "ignore", value: null }, color: { mode: "prefer", value: "Black" }, material: { mode: "must", value: "Leather" }, style: { mode: "prefer", value: "Structured" }, silhouette: { mode: "ignore", value: null }, hardware: { mode: "ignore", value: null }, closure: { mode: "must", value: "Zipper" }, size: { mode: "ignore", value: null } } as Preferences;
    const res = recommend(original, live.products, prefs);
    // Only the first fixture result confirms leather AND zipper; unknown closure is excluded.
    expect(res.recommendations.map((r) => r.product.name)).toEqual(["Black Structured Leather Tote Bag with Zip Closure"]);
    expect(res.recommendations[0].score).toBe(100);
  });
});

describe("url safety", () => {
  it("accepts public http(s) and rejects everything else", () => {
    expect(isSafeHttpUrl("https://www.example.com/p?id=1")).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.com", "file:///etc/passwd", "http://localhost:3000", "http://127.0.0.1", "http://10.0.0.5", "http://192.168.1.1", "http://169.254.169.254/latest", "http://172.20.0.1", "http://[::1]/", "http://2130706433/", "https://user:pw@example.com", "not a url"])
      expect(isSafeHttpUrl(bad), bad).toBe(false);
  });
});
