# Decisions and why

- **Deterministic engine, no AI.** Product brief: $0 budget and transparent explanations. Scores and explanations come from attribute comparisons only.
- **Unknown never matches, and unknown earns no points.** The brief forbids guessing. Consequence: live listings (titles rarely state hardware/closure/size) score low. We added a *coverage* line instead of changing the score, so the cause is visible.
- **Weights:** color 25, material 25, style 15 + silhouette 10 (the brief's "style/silhouette 25"), hardware 10, size 15; bag type 20 and closure 10 are extras that only count when preferred. Score is normalised by the preferred attributes' weights.
- **Catalog is sample data** (fictional retailers, `example.com` URLs, drawn SVG illustrations instead of photos) to avoid hotlinking or licensing issues.
- **SerpAPI quota in Postgres, not memory.** Serverless instances don't share memory; a guarded `UPDATE` is atomic across concurrent requests. Failed requests still count (conservative), no retries, cache is checked before reserving, identical concurrent requests share a credit per instance.
- **Live search is opt-in per search** (checkbox) so credits aren't spent accidentally. Guests may use it too (explicit choice); this means anyone can draw on the shared 250 pool.
- **Separate "From Google Shopping" section.** Catalog items always outranked live ones, so live results never reached the top 3. One ranking, two slices.
- **Share links store only a token hash;** the URL is shown once. Public page reads through a service-role-only SQL function that returns whitelisted columns.
- **Screenshots: OCR in the browser (Tesseract.js)** because every good vision model is a paid API. It reads text only; unknown stays unknown; the user confirms every field.
- **Guest mode via Supabase anonymous sign-ins,** with an upgrade path in Settings. Stale guests can be purged with `supabase/maintenance/delete_stale_guests.sql`.
- **Passwords stay** alongside guest mode (explicit user choice).
- **No retailer scraping.** Unknown URLs are saved as-is and the user fills in details; known sample URLs auto-fill.
- **No CAPTCHA yet.** Anonymous sign-ins are easy to script; revisit if the SerpAPI pool drains.
