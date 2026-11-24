# Change log

Newest last. Commit hashes are on `main`.

## 2026-11-18: initial build (`7049ab8`, merged with the GitHub-created LICENSE in `a204a00`)

Full MVP: Next.js 15 + Supabase auth and RLS; 44-bag seeded catalog; wishlist (URL and screenshot flows, edit/delete); deterministic engine (hard filters, weighted scoring, ranking, explanations); comparison table; helpful/not-helpful feedback; SerpAPI integration with atomic 250/month quota in SQL, caching, normalisation, kill switch; revocable hashed share links; Settings with quota display; README and tests (engine, SerpAPI mocks, and real-migration RLS/quota/share tests in PGlite).

First deployment issues fixed along the way: `node:crypto` imported into a client component (split `share.ts` / `share-server.ts`); "invalid path" on sign-up caused by `/rest/v1/` on the Supabase URL env var; email rate limit (turn off Confirm email).

## `9d13bfd`: live results get their own section

Catalog bags (fully attributed) always outranked live listings, so live results never reached the top 3. One ranking, two slices: "Top matches overall" and "From Google Shopping", each with a comparison table, plus a note on how many live results passed the must-haves.

## 2026-11-24

- `635b60f` **Guest mode:** "Continue as guest" via Supabase anonymous sign-ins, guest banner, sign-out warning, "Save my account" upgrade form in Settings, stale-guest cleanup SQL. (Initially blocked guests from live search.)
- `48c3e48` **Guests can use live search** (user's decision; they draw on the shared 250 pool).
- `4c01a08` **Live-search diagnostics:** failures show a short non-secret `Details:` reason; request timeout raised to 20 s and route `maxDuration` to 30 s. This fixed "Live search didn't respond" (most likely a timeout; the real error was never captured).
- `2d6992d` **Screenshot auto-fill:** in-browser OCR (Tesseract.js) reads the screenshot, shared text rules (`src/lib/extract.ts`) pre-fill name and attributes, user confirms. Verified on the sample screenshot in a browser.
- `ad2d785` **Live relevance (no extra credits):** ties follow Google's order, accessories/non-bags dropped, broader color/bag-type/closure vocabulary (adds Blue/Green/Gray/Pink), shorter queries (soft style words and prefer-only closure omitted), must-have pass count hidden when no must-haves.
- `7a01202` **Coverage + live shortcut:** each card shows "N of M preferred details confirmed · K of N match" (explains low live scores); the confirmed match rate breaks score ties; one-click "Focus on what listings usually state" sets silhouette/hardware/closure/size to Don't care when live search is on.
- `89008ae` and this commit: `CLAUDE.md` and `docs/`.

## Decisions made with the user along the way

- Live search checkbox is opt-in per search.
- Keep passwords and add guest mode (not guest-only).
- Guests may use live search.
- Build the coverage line and live shortcut (options 1 and 3); skip per-listing detail enrichment (costs extra credits).
- Publish the repo as public under `aashkaupadhyay-web/Wishly`.
