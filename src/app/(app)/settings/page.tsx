import { liveConfig, getUsage } from "@/lib/serpapi/runtime";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";
import { UpgradeForm } from "./UpgradeForm";

export const metadata = { title: "Settings · Wishly" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGuest = Boolean(user?.is_anonymous);
  const cfg = liveConfig();
  const usage = await getUsage().catch(() => null);

  const status = cfg.available
    ? "On"
    : cfg.reason === "disabled"
      ? "Off (ENABLE_SERPAPI is not \"true\")"
      : cfg.reason === "no_key"
        ? "Off (no SERPAPI_KEY configured)"
        : "Off (SUPABASE_SERVICE_ROLE_KEY missing: needed for the quota counter)";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-display text-3xl">Settings</h1>

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-xl">Account</h2>
        {isGuest ? (
          <>
            <p className="text-sm text-ink/70">You&apos;re using Wishly as a <strong>guest</strong>. Signing out or clearing this browser&apos;s data loses your wishlist.</p>
            <UpgradeForm />
          </>
        ) : (
          <p className="text-sm text-ink/70">Signed in as <strong>{user?.email}</strong></p>
        )}
        <div className="pt-1"><SignOutButton isGuest={isGuest} /></div>
      </section>

      <section className="card space-y-3 p-5" aria-labelledby="live-h">
        <h2 id="live-h" className="font-display text-xl">Live product search (developer info)</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink/60">Status</dt><dd>{status}</dd>
          <dt className="text-ink/60">Monthly limit</dt><dd>{usage?.limit ?? 250} searches (whole app, not per user)</dd>
          <dt className="text-ink/60">Used this month</dt><dd>{usage?.used ?? "n/a"}</dd>
          <dt className="text-ink/60">Remaining</dt><dd className="font-semibold">{usage?.remaining ?? "n/a"}</dd>
          <dt className="text-ink/60">Resets</dt><dd>1st of each month, 00:00 UTC</dd>
        </dl>
        {usage?.remaining === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">The monthly allowance is used up. Recommendations continue from the built-in catalog.</p>
        )}
        <p className="text-xs text-ink/50">The catalog always works. Set ENABLE_SERPAPI=false to turn live search off.</p>
      </section>
    </div>
  );
}
