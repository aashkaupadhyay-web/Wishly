import { SERPAPI } from "../config";
import type { Product } from "../types";
import { cacheKeyFor } from "./query";
import { normalizeSerpResults } from "./normalize";

export type LiveStatus = "ok" | "cached" | "disabled" | "not_configured" | "quota_exhausted" | "error";

export interface LiveResult {
  status: LiveStatus;
  products: Product[];
  message: string | null;
  query: string;
  /** Short, non-secret reason for a failure (shown to help debugging). Never contains the API key. */
  detail?: string;
}

export interface LiveSearchDeps {
  apiKey: string | undefined;
  enabled: string | undefined;
  limit: number;
  /** Cache lookups happen BEFORE a credit is reserved. */
  cacheGet(key: string): Promise<Product[] | null>;
  cacheSet(key: string, products: Product[]): Promise<void>;
  /** Must be atomic (see reserve_serpapi_search in the SQL migration). */
  reserve(limit: number): Promise<{ allowed: boolean; used: number }>;
  fetchImpl?: typeof fetch;
}

const MESSAGES: Record<Exclude<LiveStatus, "ok" | "cached">, string> = {
  disabled: "Live search is turned off. Showing results from the built-in catalog.",
  not_configured: "Live search is not configured. Showing results from the built-in catalog.",
  quota_exhausted:
    "Live product discovery is temporarily unavailable for this month. Showing results from the built-in catalog.",
  error: "Live search didn't respond. Showing results from the built-in catalog.",
};

const inflight = new Map<string, Promise<LiveResult>>();

/**
 * Live Google Shopping search with quota + cache. Never throws and never retries
 * (a retry would spend another credit).
 */
export function liveSearch(query: string, deps: LiveSearchDeps): Promise<LiveResult> {
  const key = cacheKeyFor(query);
  // Identical concurrent requests in one instance share a single credit.
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = run(query, key, deps).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function run(query: string, key: string, deps: LiveSearchDeps): Promise<LiveResult> {
  const fail = (status: Exclude<LiveStatus, "ok" | "cached">, detail?: string): LiveResult => ({
    status,
    products: [],
    message: MESSAGES[status],
    query,
    detail,
  });

  if (deps.enabled !== "true") return fail("disabled");
  if (!deps.apiKey) return fail("not_configured");

  try {
    const cached = await deps.cacheGet(key);
    if (cached) return { status: "cached", products: cached, message: null, query };
  } catch {
    // A cache failure must not trigger spending credits blindly; fall through to the quota check.
  }

  let reservation: { allowed: boolean; used: number };
  try {
    reservation = await deps.reserve(deps.limit);
  } catch (e) {
    // If we can't prove we're under quota, we don't call the API.
    return fail("error", `quota check failed: ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`);
  }
  if (!reservation.allowed) return fail("quota_exhausted");

  // From here on the credit is spent, whether or not the request succeeds.
  try {
    const url = new URL(SERPAPI.endpoint);
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("hl", "en");
    url.searchParams.set("gl", "us");
    url.searchParams.set("num", "20");
    url.searchParams.set("api_key", deps.apiKey);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SERPAPI.timeoutMs);
    let res: Response;
    try {
      res = await (deps.fetchImpl ?? fetch)(url, { signal: ctrl.signal, cache: "no-store" });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      let msg = "";
      try {
        msg = String((await res.json())?.error ?? "").slice(0, 120);
      } catch {
        /* body wasn't JSON */
      }
      return fail("error", `SerpAPI HTTP ${res.status}${msg ? `: ${msg}` : ""}`);
    }
    const json = await res.json();
    if (json?.error && !json?.shopping_results) {
      // SerpAPI returns an error string for "no results" too; treat as empty, not as a crash.
      const empty = /hasn't returned any results/i.test(String(json.error));
      if (!empty) return fail("error", `SerpAPI: ${String(json.error).slice(0, 120)}`);
    }
    const products = normalizeSerpResults(json);
    try {
      await deps.cacheSet(key, products);
    } catch {
      /* caching is best-effort */
    }
    return { status: "ok", products, message: null, query };
  } catch (e) {
    // Only the error name is reported: fetch error messages can echo the request URL (which holds the key).
    return fail("error", e instanceof Error && e.name === "AbortError" ? "request timed out" : `request failed (${e instanceof Error ? e.name : "unknown"})`);
  }
}
