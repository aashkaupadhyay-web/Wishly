# Status

_Last updated: 2026-11-24._

## Verified

- Lint, TypeScript, production build, and 57 automated tests pass (`npm test`):
  - engine: filtering, scoring, ranking, explanations, coverage, tie-breaks;
  - SerpAPI: normalisation, query building, quota/cache/failure handling (mocked; spends no credits), URL safety;
  - extraction rules for live search and screenshots;
  - SQL: the real migrations and seed run in PGlite with Supabase-style roles to check RLS isolation, the atomic quota function (250 cap under concurrency, UTC month reset) and the share-link access path.
- Manually confirmed on the deployed site: sign-in, discovery from the catalog, live Google Shopping results (after raising the timeout), guest mode setup, and the Discover live section.
- The real OCR engine reads the sample screenshot in a browser and pre-fills name + all eight attributes.

## Not verified / known limitations

- OCR on arbitrary user screenshots (quality varies; text only, not images; retailer is not guessed).
- Live results confirm few attributes, so similarity scores are low by design; coverage shows why.
- Google may return results that ignore soft query words (e.g. leather bags for a nylon search).
- Free tiers: Supabase pauses idle projects and rate-limits auth email; Vercel Hobby is non-commercial; SerpAPI is 250 searches/month and its reset date may not match the app's UTC calendar-month counter.
- Vercel did not auto-deploy some pushes (suspected commit-author mismatch); deploy manually from the dashboard if needed.
- Commits are authored as a placeholder identity (`Wishly <wishly@users.noreply.github.com>`).
- No CAPTCHA on guest sign-ins.
- Screenshot flow, guest upgrade and sharing have not been exercised end-to-end by automated browser tests.

## Ideas not built

- Per-key SerpAPI quotas / multiple keys.
- Product-detail enrichment for live results (costs extra credits per listing).
- CAPTCHA for anonymous sign-ins.
- Resetting the quota counter on SerpAPI's own billing date.
