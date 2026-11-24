# Wishly: project guide for Claude Code and contributors

Wishly is a free-tier shopping assistant for **handbags**: save products from any retailer, say which attributes are must-have / prefer / don't-care, and get ranked alternatives from a built-in catalog plus optional live Google Shopping (SerpAPI). Deployed on Vercel + Supabase. Repo: https://github.com/aashkaupadhyay-web/Wishly

Read `docs/ARCHITECTURE.md` (how it fits together), `docs/DECISIONS.md` (why things are the way they are) and `docs/STATUS.md` (what's verified, known issues) before changing behaviour.

## Hard rules (from the original product brief; don't break these)

- **$0 budget.** No paid AI/APIs, no paid plans. Only free tiers (Supabase, Vercel Hobby, SerpAPI free = 250 searches/month).
- **SerpAPI is optional and capped at 250 searches/month for the whole app** (not per user). The cap is enforced atomically in SQL (`reserve_serpapi_search`) and hard-coded at 250. Reserve a credit *before* calling, count failures, never retry, check cache *before* reserving. The app must work with no key / `ENABLE_SERPAPI=false`.
- **One recommendation engine** (`src/lib/engine/match.ts`) for both catalog and live results. Never fork it.
- **Never treat unknown as a match.** Unknown / "Other" earn no points and fail must-haves. Don't infer attributes the text doesn't state.
- **No prices** anywhere (not read, stored or shown). No price tracking, alerts, checkout, purchasing, emails/SMS, or scraping retailer pages.
- **Secrets stay server-side.** `SERPAPI_KEY` and `SUPABASE_SERVICE_ROLE_KEY` never go in client code, `NEXT_PUBLIC_*`, logs, or the repo. Don't print or paste keys.
- **SSRF / URL safety:** only http(s) URLs, no server-side fetching of user URLs (`isSafeHttpUrl` in `src/lib/validation.ts`).
- RLS on every user-owned table. Every API route authenticates itself (`requireUser`).

## Commands

```powershell
npm install
npm run dev          # http://localhost:3000 (needs .env.local, see .env.example)
npm run lint
npm run typecheck
npm test             # vitest: engine, serpapi, extract, and db (real migrations in PGlite)
npm run build
npm run seed:sql     # regenerate supabase/seed.sql from src/data/catalog.ts
```

Before declaring a change done: lint, typecheck, tests and a production build should all pass. If `tsc` complains about `.next/types/...` after deleting a page, delete `.next` and rebuild.

## Layout

```
src/app/(app)/        signed-in pages: discover, wishlist (+new, [id]), shared, settings
src/app/api/          wishlist, recommend, feedback, share (+[id])
src/app/s/[token]/    public read-only share page (service-role + SQL function)
src/app/login, auth/callback, setup
src/lib/engine/match.ts    filtering, scoring, ranking, explanations, coverage
src/lib/config.ts          weights, option lists, equivalences, SerpAPI constants (tune here)
src/lib/extract.ts         deterministic text -> attributes (live search AND screenshot OCR)
src/lib/serpapi/           query builder, normalizer, quota+cache search client, Supabase runtime deps
src/lib/validation.ts      zod schemas + URL safety
src/data/catalog.ts        44 sample bags (source of supabase/seed.sql)
supabase/migrations/       schema, RLS, SQL functions (run in order)
supabase/maintenance/      optional SQL housekeeping (stale guests)
tests/                     vitest suites
```

## Gotchas learned the hard way

- **Next route files may only export HTTP handlers** (plus config like `maxDuration`). Put helpers elsewhere.
- **Client components must not import server-only code or `node:crypto`.** That's why `src/lib/share.ts` (client-safe) and `src/lib/share-server.ts` (hashing) are split.
- `NEXT_PUBLIC_*` values are baked in at **build** time: after changing them in Vercel you must redeploy. `NEXT_PUBLIC_SUPABASE_URL` must be the bare project URL (no `/rest/v1/`).
- Vercel auto-deploy from pushes has been unreliable here (suspected commit-author mismatch on Hobby). If a push doesn't deploy, use Create Deployment on `main`.
- Supabase's built-in email is heavily rate-limited; "Confirm email" is best off for demos. Guest mode needs "Allow anonymous sign-ins" enabled in Supabase.
- Cached live searches (`serpapi_cache`, 14 days) keep old normalised data; clear with `delete from serpapi_cache;` after changing extraction rules.
- Tailwind v3 and ESLint 8 are deliberate (Next 15 setup). `next lint` is deprecated but works.
- Windows dev machine: Git lives at `C:\Program Files\Git\cmd` and may not be on a session's PATH.

## Working agreements

- Keep it simple; this is an MVP. No new infrastructure or paid services without asking.
- Add or update tests with behaviour changes (`tests/`). The SQL/RLS tests run the real migrations in PGlite, so keep migrations plain Postgres.
- Don't commit or push unless asked. End commit messages with the Co-Authored-By line used in this repo's history.
- Never commit `.env*` (only `.env.example`).
