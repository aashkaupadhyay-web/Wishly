# Requirements (original product brief, condensed but complete)

The app is named **Wishly**. Build a complete, functional, deployable MVP shopping assistant for **handbags** with a strict **$0 budget**. Prioritise simplicity, reliability and a polished consumer UX. Choose the simplest practical implementation when something is ambiguous.

## Users can

1. Save products from different retailers via **product URL** or **screenshot**.
2. Enter/correct attributes: category, subcategory, color, material, style, silhouette, hardware color, closure, size, shape, optional description.
3. Discover similar products from a **built-in catalog** and optional **live Google Shopping via SerpAPI**.
4. Mark attributes **must-have / prefer / don't care**.
5. View and compare the best alternatives.
6. Save recommendations to a wishlist.
7. Share selected wishlist items via **revocable, read-only links**.

Suggested navigation: Discover, My Wishlist, Shared Wishlist (viewing/managing shared links), Settings. Main journey: sign in, save a product, review attributes, choose preferences, discover, compare, save favourites, optionally share. Must work on desktop, tablet and mobile.

## Out of scope (do not build)

Price tracking/history, target-price alerts, automated purchasing or purchase rules, checkout, payments, purchase simulation, email/SMS notifications, paid AI integrations, paid product-search integrations, live retailer integrations other than the optional SerpAPI one. No complex scrapers or bypassing retailer protections.

## Stack and budget

Next.js, TypeScript, Tailwind, Supabase Postgres + Auth, GitHub, Vercel, SerpAPI Google Shopping, custom deterministic recommendation engine. Free tiers only; never auto-upgrade; document free-tier limits. No OpenAI/Anthropic/other paid AI APIs. The app must run with no `SERPAPI_KEY`.

## Wishlist

- **URL save:** recognise seeded sample URLs and pre-fill; otherwise keep the URL and let the user enter name, retailer, category, attributes, optional image. No scraping; preserve the URL if info can't be retrieved.
- **Screenshot save:** no external AI. User confirms attributes before saving; include a sample screenshot; do not retain raw screenshots unless the user explicitly opts in. (Implemented later with in-browser OCR pre-fill, still user-confirmed.)
- **Attributes:** controlled values where practical (Color: Black, Brown, Tan, White, Beige, Red, Other; Material: Leather, Suede, Canvas, Nylon, Vegan Leather, Other; Closure: Zipper, Magnetic Snap, Buckle, Open Top, Drawstring, Other; Hardware: Gold, Silver, Brass, Black, Other; Size: Mini, Small, Medium, Large), allowing extra values. Missing/unverified = unknown/null; never assume.
- **Dashboard:** visual grid; each card shows image, name, retailer, category, key attributes and a link to the original; edit, delete, view details, start a similar search, save recommended alternatives.

## Discovery: two sources, one engine

- **Source A, seeded catalog:** about 30-50 realistic sample handbags (tote, shoulder, crossbody, satchel, bucket, top-handle) varying in color, material, hardware, closure, silhouette, size, style; loaded by reproducible seed files; available immediately.
- **Source B, SerpAPI:** server-side only (`SERPAPI_KEY`, never exposed). Build a short relevant query from the product and preferences, call SerpAPI, normalise results (title, retailer, image, URL, snippet, attributes) into the common product shape, run them through the **same** engine. **No prices.** Attributes come only from deterministic text rules on titles/snippets; unsupported attributes stay unknown; users can correct them.
- **Hard 250 searches/calendar month for the whole app:** track in DB; reserve a credit before the request; atomic reservation; never send after exhaustion; documented timezone (UTC); cache and reuse results; no automatic retries; show remaining allowance in a developer-facing settings area; users can't bypass it; failed-after-reserve requests count; at the limit show a friendly "temporarily unavailable" message, keep using the catalog, never prompt to upgrade. If unconfigured, use the catalog and say live search is disabled. `ENABLE_SERPAPI=false` must cleanly disable it.

## Matching algorithm

- **Preferences:** must-have (confirmed match required; exclude failures and unknowns), prefer (earns points), don't care (ignored). Sensible defaults from the original product; user can change any time.
- **Hard filtering before scoring:** exclude must-have failures, unknown required attributes, the exact original product, duplicates. Unknown is never a match. Fewer than three results: show what exists and explain.
- **Scoring weights (central config):** color 25, material 25, style/silhouette 25, hardware 10, size 15 (total 100). Score uses only "prefer" attributes: `earned weight / total preferred weight x 100`. Must-haves are handled by filtering, not rewarded twice. No points for unknown. Exact matches plus explicit equivalences only (e.g. black = jet black if configured; leather != vegan leather).
- **Ranking:** by score; up to three by default. Show image, name, retailer, link, score, matching attributes, differences, relevant unknowns. No unsupported quality/durability/authenticity claims; never "perfect match" unless supported.
- **Explanations:** deterministic, generated from the actual comparison. No AI.
- **Feedback:** helpful / not helpful stored in the DB; users can adjust preferences and re-run. No ML.

## Comparison

Side-by-side table or cards comparing the original with up to three alternatives across color, material, style/silhouette, hardware, closure, size; highlight matches, differences, unknowns, satisfied must-haves; make saving an alternative easy; make clear why one ranks above another.

## Sharing

Select specific items; unique hard-to-guess token; anyone with the link can view without signing in; revocable; owner can view/manage active links. Shared pages show only names, images, retailers, attributes, original links. Never expose account info, notes, other items or internal IDs. No editing via a link.

## Data model (Supabase Postgres, versioned migrations)

profiles, catalog_products, wishlist_items, recommendation_searches, recommendation_results, recommendation_feedback, shared_wishlists (token stored hashed, `revoked_at`), shared_wishlist_items, serpapi_usage (month, reserved count). Atomic quota-reservation function. Reproducible seed. Service-role key never exposed to the frontend.

## Auth and security

Supabase Auth: sign-up, sign-in, sign-out, protected routes, per-user wishlists. RLS on all user-owned tables; test cross-user isolation. Shared pages use a restricted server-side path. Validate inputs; protect API routes; only http/https URLs; no unrestricted URL-fetching proxy; protect against SSRF. Keep all keys server-side.

## Configuration

`.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SERPAPI_KEY`, `ENABLE_SERPAPI=false`; document public vs private; never commit real credentials.

## Deployment and docs

GitHub + Vercel + Supabase on free tiers; no domain purchases or upgrades. README covering install, Supabase setup, migrations, seeding, auth redirect URLs, local run, Vercel connection, env vars, enabling/disabling SerpAPI, the 250/month limit, and free-tier limitations.

## Required testing

Auth (sign up, in, out, protected routes); wishlist (URL save, manual attributes, sample screenshot, edit/delete, multiple retailers); catalog recommendations (preferences, must-have enforcement, unknown exclusion, score correctness, ranking, explanation accuracy, save an alternative); SerpAPI (works without key and enabled, normalisation, shared engine, usage counter, caching, concurrency safety, no request past 250, disable switch, error resilience; use mocks, not real credits); sharing (create, signed-out view, only selected items, no private data, revoke); security (RLS isolation, share restrictions, no keys in the browser, unauthorised access blocked); build (lint, typecheck, tests, production build).

## Final guiding principle

A simple, polished, free-tier MVP where users save products, describe what they like, discover relevant alternatives and build a useful wishlist. Two sources, one algorithm; SerpAPI optional, quota-limited and easy to disable; no paid AI or complex ML.
