# Architecture

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v3 · Supabase (Postgres, Auth, RLS) · Vercel · SerpAPI Google Shopping (optional) · Tesseract.js (in-browser OCR) · Vitest (+ PGlite for SQL tests).

## Request flow

```
Browser ──(anon key + user session cookie)──> Supabase (RLS enforces per-user access)
Browser ──> Next.js API routes ──> Supabase as the user (RLS applies)
                              └─> Supabase as service role ONLY for: SerpAPI quota/cache, shared-link read
Next.js server ──> SerpAPI (server-side only, key never reaches the browser)
```

- `middleware.ts` refreshes the session and redirects signed-out users away from `/discover /wishlist /shared /settings`. API routes also check auth themselves.
- Guests use Supabase **anonymous sign-ins**: a real user row with `is_anonymous = true`, same `authenticated` role, so the same RLS applies. A guest can upgrade in Settings (`updateUser`) and keeps their data (same user id).

## Data model (supabase/migrations)

| Table | Purpose |
|---|---|
| `profiles` | one row per auth user (created by trigger) |
| `catalog_products` | seeded sample bags, read-only for users |
| `wishlist_items` | a user's saved products (own rows only) |
| `recommendation_searches` / `_results` / `_feedback` | history + helpful/not-helpful, owned via the search |
| `shared_wishlists` / `shared_wishlist_items` | share links; **only a SHA-256 hash of the token is stored** |
| `serpapi_usage` | per-month (UTC) counter; no client policies, service role only |
| `serpapi_cache` | normalised live results, 14-day TTL; service role only |

SQL functions (service role only): `reserve_serpapi_search(limit)` (atomic guarded UPDATE, hard cap 250) and `get_shared_wishlist(token_hash)` (returns only whitelisted columns for non-revoked links).

## Recommendation pipeline (`src/lib/engine/match.ts`)

1. Candidates = catalog (+ live results normalised to the same `Product` type).
2. `hardFilter`: drop the original, duplicates, must-have failures, and must-haves whose attribute is unknown.
3. `scoreCandidate`: earned weight on **Prefer** attributes / total weight of preferred attributes x 100. Unknown earns 0. Weights in `config.ts`.
4. `coverageOf`: transparency numbers (how many preferred details the listing confirms, and how many of those match). Its match rate breaks score ties.
5. Rank: score, matched count, confirmed rate, fewer unknowns, Google's own order (live), then name.
6. `explain`: deterministic sentence from the comparison cells.

`/api/recommend` runs the engine once over everything with no limit, then returns the **top 3 overall** plus the **top 3 live** (so live results aren't crowded out by fully-attributed catalog items).

## Live search (`src/lib/serpapi`)

`buildQuery` (short query; soft style words and prefer-only closure omitted) -> `liveSearch` (cache check -> atomic reserve -> one fetch, 20 s timeout, no retry) -> `normalizeSerpResults` (drops accessories/non-bags, discards prices, keeps Google's rank, extracts attributes via `src/lib/extract.ts`). Failures return a status plus a short non-secret `detail`.

## Screenshots

Chosen in the browser, rasterised on a canvas, OCR'd with Tesseract.js (engine downloaded from a CDN on first use), then `extractAttributes` + `guessName` pre-fill the form. The image is never uploaded; it is only kept (as a downscaled data URL in `image_url`) if the user opts in.

## Sharing

Owner selects items -> API creates a 32-byte random token, stores only its hash, and shows the link once. `/s/[token]` calls `get_shared_wishlist` via the service role and renders only whitelisted fields. Revoking sets `revoked_at`; the link then returns nothing.
