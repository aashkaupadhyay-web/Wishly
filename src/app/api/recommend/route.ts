import { NextResponse } from "next/server";
import { jsonError, readJson, requireUser, sameOrigin } from "@/lib/api";
import { recommend } from "@/lib/engine/match";
import { loadCatalog, rowToProduct, type WishlistRow } from "@/lib/products";
import { buildQuery } from "@/lib/serpapi/query";
import { liveConfig, supabaseDeps } from "@/lib/serpapi/runtime";
import { liveSearch, type LiveResult } from "@/lib/serpapi/search";
import type { Preferences, Product } from "@/lib/types";
import { recommendRequestSchema } from "@/lib/validation";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Bad origin", 403);
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const parsed = recommendRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Invalid request", 422);
  const { wishlistItemId, includeLive } = parsed.data;
  const preferences = parsed.data.preferences as Preferences;

  const { data: row } = await auth.supabase
    .from("wishlist_items")
    .select("*")
    .eq("id", wishlistItemId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!row) return jsonError("Not found", 404);
  const original = rowToProduct(row as WishlistRow);

  // Source A: seeded catalog (always available).
  const candidates: Product[] = await loadCatalog(auth.supabase);

  // Source B: live Google Shopping, optional and quota-limited. Failure never blocks Source A.
  let live: Pick<LiveResult, "status" | "message" | "query"> & { count: number } = {
    status: "disabled",
    message: "Live search is turned off. Showing results from the built-in catalog.",
    query: "",
    count: 0,
  };
  const cfg = liveConfig();
  if (includeLive) {
    // Server-side enforcement: guests can't spend the shared SerpAPI credits, whatever the client sends.
    if (auth.user.is_anonymous) {
      live.status = "not_configured";
      live.message = "Live search is for signed-up accounts. Showing results from the built-in catalog.";
    } else if (!cfg.available) {
      live.status = cfg.reason === "disabled" ? "disabled" : "not_configured";
      live.message =
        cfg.reason === "disabled"
          ? "Live search is turned off. Showing results from the built-in catalog."
          : "Live search is not configured. Showing results from the built-in catalog.";
    } else {
      try {
        const res = await liveSearch(buildQuery(original, preferences), supabaseDeps());
        candidates.push(...res.products);
        live = { status: res.status, message: res.message, query: res.query, count: res.products.length };
      } catch {
        live = { status: "error", message: "Live search didn't respond. Showing results from the built-in catalog.", query: "", count: 0 };
      }
    }
  }

  // ONE engine for both sources.
  const full = recommend(original, candidates, preferences, Number.POSITIVE_INFINITY);
  const top = full.recommendations.slice(0, 3);
  // Same ranking, just sliced: the best live matches that didn't make the overall top 3.
  const liveTop = full.recommendations.filter((r) => r.product.source === "serpapi" && !top.includes(r)).slice(0, 3);
  const livePassed = full.recommendations.filter((r) => r.product.source === "serpapi").length;
  const result = { ...full, recommendations: [...top, ...liveTop] };

  // Persist the search + results (best effort; the user still gets results if this fails).
  let searchId: string | null = null;
  let resultIds: (string | null)[] = result.recommendations.map(() => null);
  const { data: search } = await auth.supabase
    .from("recommendation_searches")
    .insert({
      user_id: auth.user.id,
      wishlist_item_id: wishlistItemId,
      source: includeLive && live.count > 0 ? "catalog+live" : "catalog",
      preferences,
    })
    .select("id")
    .single();
  if (search && result.recommendations.length) {
    searchId = search.id;
    const { data: saved } = await auth.supabase
      .from("recommendation_results")
      .insert(
        result.recommendations.map((r) => ({
          search_id: search.id,
          product_data: r,
          similarity_score: r.score,
          explanation: r.explanation,
        })),
      )
      .select("id"); // RETURNING preserves insert order
    if (saved && saved.length === result.recommendations.length) resultIds = saved.map((s) => s.id);
  }

  return NextResponse.json({
    searchId,
    live,
    considered: result.considered,
    excluded: result.excluded,
    notice: full.recommendations.length < 3 ? full.notice : null,
    liveStats: { fetched: live.count, passed: livePassed },
    recommendations: top.map((r, i) => ({ ...r, resultId: resultIds[i] })),
    liveRecommendations: liveTop.map((r, i) => ({ ...r, resultId: resultIds[top.length + i] })),
  });
}
