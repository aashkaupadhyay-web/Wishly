import "server-only";
import { SERPAPI } from "../config";
import { createAdminClient, hasServiceRole } from "../supabase/admin";
import type { Product } from "../types";
import type { LiveSearchDeps } from "./search";

export function liveConfig() {
  const enabledFlag = process.env.ENABLE_SERPAPI === "true";
  const hasKey = Boolean(process.env.SERPAPI_KEY);
  const available = enabledFlag && hasKey && hasServiceRole();
  return {
    enabledFlag,
    hasKey,
    available,
    reason: !enabledFlag
      ? "disabled"
      : !hasKey
        ? "no_key"
        : !hasServiceRole()
          ? "no_service_role"
          : null,
  } as const;
}

/** Supabase-backed quota + cache. The quota is enforced by the atomic SQL function. */
export function supabaseDeps(): LiveSearchDeps {
  const db = createAdminClient();
  return {
    apiKey: process.env.SERPAPI_KEY,
    enabled: process.env.ENABLE_SERPAPI,
    limit: SERPAPI.monthlyLimit,
    async reserve(limit) {
      const { data, error } = await db.rpc("reserve_serpapi_search", { p_limit: limit });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return { allowed: Boolean(row?.allowed), used: Number(row?.used ?? 0) };
    },
    async cacheGet(key) {
      const since = new Date(Date.now() - SERPAPI.cacheTtlDays * 86_400_000).toISOString();
      const { data } = await db
        .from("serpapi_cache")
        .select("results")
        .eq("query_key", key)
        .gte("created_at", since)
        .maybeSingle();
      return (data?.results as Product[] | undefined) ?? null;
    },
    async cacheSet(key, products) {
      await db
        .from("serpapi_cache")
        .upsert({ query_key: key, results: products, created_at: new Date().toISOString() });
    },
  };
}

export async function getUsage() {
  const limit = SERPAPI.monthlyLimit;
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  if (!hasServiceRole()) return { limit, used: null, remaining: null, monthStart };
  const { data } = await createAdminClient()
    .from("serpapi_usage")
    .select("searches_reserved")
    .eq("month_start", monthStart)
    .maybeSingle();
  const used = data?.searches_reserved ?? 0;
  return { limit, used, remaining: Math.max(0, limit - used), monthStart };
}
