# Setup, configuration and deployment (full walkthrough)

Never paste real keys into chat, issues, commits or screenshots. `.env.local` is git-ignored.

## 1. Supabase (free plan)

1. Create a project. When asked about **Data access**: keep **Enable Data API** on; keep **Enable RLS on new tables automatically** on; also tick **Grant API access to new tables automatically** (the migrations and tests assume Supabase's default grants to `anon`/`authenticated`/`service_role`; without them the app fails with "permission denied").
2. **SQL Editor**, run in order, waiting for "Success" each time:
   1. `supabase/migrations/20260101000000_schema.sql`
   2. `supabase/migrations/20260101000100_rls_and_functions.sql`
   3. `supabase/seed.sql` (44 catalog rows; idempotent; regenerate with `npm run seed:sql`).
3. **Authentication, Sign In / Providers, User Signups:**
   - Email provider on.
   - **Confirm email: off** for demos (Supabase's built-in email sender is limited to a handful of emails/hour on the free plan; "email rate limit exceeded" means you hit it). If on, add custom SMTP (Resend/Brevo free tiers) for real users.
   - **Allow anonymous sign-ins: on** (guest mode). Leave "Allow manual linking" off.
   - Captcha is recommended by Supabase for anonymous sign-ins but not implemented.
4. **Authentication, URL Configuration:** Site URL = your Vercel URL (or `http://localhost:3000` locally). Redirect URLs: `<site>/auth/callback` for each site you use.
5. **Project Settings, API Keys:** copy the **Project URL**, the **publishable/anon** key and the **secret/service_role** key. The Project URL must be the bare `https://<ref>.supabase.co` (no `/rest/v1/`, no trailing slash, no quotes).

## 2. Environment variables

| Variable | Visibility | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | bare project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | publishable/anon key (safe with RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **private** | server only; needed for live-search quota/cache and share links. Mark Sensitive in Vercel |
| `SERPAPI_KEY` | **private** | optional; mark Sensitive |
| `ENABLE_SERPAPI` | private | exactly `true` to enable live search; anything else disables it |
| `SERPAPI_MONTHLY_LIMIT` | private | optional; can only lower the 250 ceiling |

`NEXT_PUBLIC_*` values are baked into the build: **redeploy after changing them.** Locally: `Copy-Item .env.example .env.local`, fill it in, `npm run dev`.

## 3. Vercel (Hobby)

1. Import `aashkaupadhyay-web/Wishly` as a Next.js project.
2. Add the environment variables above (Production, and Preview if you use previews).
3. Deploy. Afterwards put the Vercel URL into Supabase Site URL and Redirect URLs.
4. Pushes to `main` normally redeploy. If one doesn't, Deployments, **Create Deployment**, branch `main` (we saw auto-deploy not firing; suspected commit-author mismatch on Hobby).
5. Function limits: `/api/recommend` sets `maxDuration = 30`; the SerpAPI request has a 20 s timeout.

## 4. SerpAPI (optional)

1. Free account (250 searches/month); copy the API key.
2. Set `SERPAPI_KEY` and `ENABLE_SERPAPI=true` in Vercel, redeploy. Settings then shows status, used and remaining.
3. The app's counter resets on the 1st of each month 00:00 UTC; SerpAPI's own allowance may follow your billing date, so the SerpAPI dashboard is the source of truth.
4. Turn live search off for everyone with `ENABLE_SERPAPI=false` and a redeploy.
5. The 250 pool is shared by all users including guests. Each *new* query costs 1 credit; repeats are cached 14 days. Clear the cache with `delete from serpapi_cache;`.

## 5. GitHub

Repo: https://github.com/aashkaupadhyay-web/Wishly (public, MIT). Add contributors under the **repository's** Settings, Collaborators, Add people (not account settings). Commit identity is a placeholder noreply address; set your own with `git config user.name/email` (a GitHub no-reply address keeps your real email private).

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Invalid path specified in request URL" on sign-up | `NEXT_PUBLIC_SUPABASE_URL` has a path; use the bare URL, redeploy |
| "email rate limit exceeded" | Supabase built-in email limit; turn Confirm email off or add SMTP |
| "Guest mode isn't enabled" | turn on Allow anonymous sign-ins |
| Live checkbox greyed out | read Settings status: `ENABLE_SERPAPI` not `true`, missing `SERPAPI_KEY`, or missing service-role key; redeploy after changes |
| "Live search didn't respond" | the notice now includes `Details:` (HTTP status, timeout, quota-check error); also see Vercel runtime logs |
| "temporarily unavailable" | the monthly 250 is used up; catalog still works |
| Live results never appear in the top 3 | by design they appear in their own "From Google Shopping" section |
| Low live similarity (30-40%) | listings rarely state hardware/closure/size; see the coverage line; use "Focus on what listings usually state" |
| Permission denied errors | "Grant API access to new tables" was off at project creation, or migrations weren't run in order |
| `tsc` errors from `.next/types` | delete `.next` and rebuild |
