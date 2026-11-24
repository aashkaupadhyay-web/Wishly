# Wishly

Save handbags from any retailer, say what matters (must-have / prefer / don't care), and discover the closest alternatives, with a plain-English reason for every pick. Built to run on **free tiers only** (Supabase, Vercel, optional SerpAPI free plan). No paid AI anywhere.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + RLS) · Vercel · SerpAPI Google Shopping (optional) · a deterministic recommendation engine.

## Features

- Email/password auth, protected routes, per-user wishlists (RLS).
- Save a product by **URL** (sample catalog URLs auto-fill; others keep the URL and you fill the form) or by **screenshot**. The text in the image is read in the browser with Tesseract.js (free, no API; the image is never uploaded) and run through the same deterministic rules as live search to pre-fill the form. You review and edit everything; the image is kept only if you opt in. It reads text, not pictures, so a bare photo pre-fills little.
- 44-bag seeded catalog (totes, shoulder, crossbody, satchel, bucket, top-handle).
- Preference picker, hard filtering, weighted scoring, ranked top 3, deterministic explanations, side-by-side comparison, helpful / not-helpful feedback.
- Optional live Google Shopping results through SerpAPI, quota-limited to 250/month app-wide, cached, and feeding the **same** engine.
- Revocable read-only share links for selected wishlist items.

## Setup

### 1. Install

```powershell
npm install
```

### 2. Supabase (free)

1. Create a project at <https://supabase.com> (Free plan).
2. **Run the migrations in order**, in *SQL Editor → New query*, pasting each file:
   1. `supabase/migrations/20260101000000_schema.sql`
   2. `supabase/migrations/20260101000100_rls_and_functions.sql`

   (Or with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.)
3. **Load the sample catalog:** paste `supabase/seed.sql` into the SQL editor and run it. It's idempotent. Regenerate it from `src/data/catalog.ts` with `npm run seed:sql`.
4. **Auth → Providers → Email:** enabled by default. For a frictionless demo you may turn off *Confirm email*; otherwise new users must click the emailed link.
5. **Guest mode:** in **Auth → Sign In / Providers**, turn on **Allow anonymous sign-ins**, or the "Continue as guest" button will show an error. Guests can later add an email and password in Settings and keep their wishlist. Guests can use live search too, so they draw on the same shared 250-search monthly pool (anonymous sign-ins are easy to create, so watch usage in Settings). Clean up stale guests occasionally with `supabase/maintenance/delete_stale_guests.sql`. Supabase rate-limits anonymous sign-ins per IP.
6. **Auth → URL Configuration:**
   - *Site URL:* `http://localhost:3000` locally, your Vercel URL in production.
   - *Redirect URLs:* add `http://localhost:3000/auth/callback` and `https://<your-app>.vercel.app/auth/callback`.
6. **Project Settings → API:** copy the Project URL, `anon` key and `service_role` key.

### 3. Environment

```powershell
Copy-Item .env.example .env.local
```

| Variable | Visibility | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key (RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **private** | Server only: SerpAPI quota/cache and the shared-link read path. Never prefix with `NEXT_PUBLIC_`. |
| `SERPAPI_KEY` | **private** | Optional. Live search key |
| `ENABLE_SERPAPI` | private | `true` to enable live search; anything else disables it |
| `SERPAPI_MONTHLY_LIMIT` | private | Optional. Can only *lower* the 250 cap |

Share links need `SUPABASE_SERVICE_ROLE_KEY` (the public page reads through a whitelisted SQL function). Catalog recommendations, wishlist and auth work without it.

### 4. Run

```powershell
npm run dev      # http://localhost:3000
```

Sign up → *My Wishlist → Save a product* (try a sample URL or the sample screenshot) → *Find similar*.

## Deploy (GitHub → Vercel)

1. Push this folder to a GitHub repository (`.env*` files are git-ignored; commit only `.env.example`).
2. At <https://vercel.com> choose *Add New → Project*, import the repo (Hobby plan, framework auto-detected as Next.js).
3. Add the environment variables above (Settings → Environment Variables). Mark the private ones as server-side (they have no `NEXT_PUBLIC_` prefix, so Next.js never ships them to the browser).
4. Deploy, then add the Vercel URL to Supabase *Site URL* and *Redirect URLs* (step 2.5).

Nothing here purchases a domain or upgrades a plan.

## SerpAPI (optional)

- **Enable:** get a free key at <https://serpapi.com> (250 searches/month), set `SERPAPI_KEY=...` and `ENABLE_SERPAPI=true`. In Discover, tick *Also search Google Shopping (live)*. It is opt-in per search so credits aren't spent by accident.
- **Disable:** set `ENABLE_SERPAPI=false` (or remove the key). The app falls back to the catalog automatically and Discover says live search is off.
- **How the 250 limit is enforced:**
  - Per-month counter in `serpapi_usage`, month boundary **UTC**, shared by the whole app.
  - `reserve_serpapi_search()` is a single guarded `UPDATE ... WHERE searches_reserved < least(limit, 250)`: concurrent callers serialise on the row lock and can't overshoot. The 250 ceiling is also hard-coded in SQL.
  - A credit is reserved **before** the HTTP request; failed requests still count; there are no automatic retries; if the quota check itself errors, no request is made.
  - Results are cached 14 days by normalised query (checked *before* reserving), and identical concurrent requests share one credit.
  - At 250: friendly "temporarily unavailable" notice, catalog results continue, no upgrade prompt.
  - Remaining allowance is shown under **Settings**.
- Prices are never read, stored, or shown.

## How recommendations work

One engine (`src/lib/engine/match.ts`) serves both sources:

1. **Candidates** = catalog (+ live results, normalised to the same `Product` shape).
2. **Hard filter:** drop the original product, duplicates, any candidate failing a **Must-have**, and any candidate where a must-have attribute is **unknown** (unknown and "Other" never match).
3. **Score** over **Prefer** attributes only: `earned weight ÷ total preferred weight × 100`. Unknown earns nothing; Don't-care is excluded; must-haves aren't double-counted. Weights live in `src/lib/config.ts` (color 25, material 25, style 15 + silhouette 10, hardware 10, size 15; bag type and closure are optional extras that count only when preferred).
   Each card also shows **coverage** ("3 of 8 preferred details confirmed · 3 of 3 match") so a low score caused by missing information is visible; the confirmed match rate is used as a tie-breaker. Live results usually confirm only color, material and bag type, so Discover offers a one-click "Focus on what listings usually state" when live search is on.
4. **Equivalences** are explicit in config (e.g. black ≈ jet black); leather ≠ vegan leather.
5. **Rank** by score, then more matched attributes, fewer unknowns, then name (fully deterministic). Show up to 3; fewer if fewer qualify, with an explanation.
6. **Explanation** text is generated from the actual comparison cells. No AI.

Live listings only get attributes their title/snippet explicitly states (simple regex rules; ambiguous text such as "black and brown" stays unknown).

## Sharing

*My Wishlist → Select items to share* creates a link with a 256-bit random token. Only its SHA-256 hash is stored, so the address is shown **once**. Visitors see only name, image, retailer, attributes and original link, never ids or account data. Owners revoke under **Shared Wishlist**; revoked links stop working immediately.

## Tests

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

- `tests/engine.test.ts`: filtering, scoring, ranking, explanations.
- `tests/serpapi.test.ts`: normalisation, query building, quota/cache/failure handling (mocked, spends no credits), URL safety.
- `tests/db.test.ts`: runs the real migrations and seed in an in-process Postgres (PGlite) with Supabase-style roles to verify RLS isolation, the atomic quota function, and the shared-link path.

## Known limitations (free tiers)

- **Supabase Free:** projects pause after about a week of inactivity (resume from the dashboard); 500 MB database; limited auth emails per hour (turn off email confirmation for demos).
- **Vercel Hobby:** non-commercial use only; serverless time limits (live search has a 10 s timeout).
- **SerpAPI Free:** 250 searches/month; results are whatever Google Shopping returns, so many attributes will be unknown.
- Catalog items are **sample data** (illustrative retailers and `example.com` URLs, drawn illustrations instead of photos).
- Screenshot pre-fill is OCR only (text, not images); the first scan downloads a ~5-15 MB engine from a CDN, and results can be wrong or empty, so users confirm every field.
- Quota counting is per calendar month in UTC.
- Quota/cache/share paths require the service-role key on the server.
- The in-memory request de-duplication of identical live searches is per server instance (the quota itself is global and atomic).
