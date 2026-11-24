"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Turns the current guest into a real account; the guest's wishlist is kept (same user id). */
export function UpgradeForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: pwErr } = await supabase.auth.updateUser({ password });
    if (pwErr) {
      setBusy(false);
      return setError(pwErr.message);
    }
    const { error: mailErr } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings` },
    );
    setBusy(false);
    if (mailErr) return setError(mailErr.message);
    setInfo("Almost done. If email confirmation is on, click the link we sent to finish. Otherwise your account is saved.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-ink/70">Add an email and password to keep your wishlist and sign in from anywhere.</p>
      <div>
        <label className="label" htmlFor="up-email">Email</label>
        <input id="up-email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="up-pw">Password</label>
        <input id="up-pw" type="password" required minLength={8} autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {info && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{info}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save my account"}</button>
    </form>
  );
}
