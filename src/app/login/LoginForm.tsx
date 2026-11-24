"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") ? "That confirmation link didn't work. Try signing in." : null);
  const [info, setInfo] = useState<string | null>(null);

  const next = params.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/discover";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        router.replace(dest);
        router.refresh();
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}` },
      });
      if (error) setError(error.message);
      else if (data.session) {
        router.replace(dest);
        router.refresh();
        return;
      } else setInfo("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }

  async function continueAsGuest() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInAnonymously();
    if (error) {
      setError(
        /anonymous/i.test(error.message)
          ? "Guest mode isn't enabled on this site yet. Please sign in or create an account."
          : error.message,
      );
      setBusy(false);
      return;
    }
    router.replace(dest);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6" aria-label={mode === "signin" ? "Sign in" : "Create account"}>
      <h2 className="font-display text-2xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === "signup" && <p className="mt-1 text-xs text-ink/50">At least 8 characters.</p>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {info && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{info}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
      <div className="flex items-center gap-3 text-xs text-ink/40"><span className="h-px flex-1 bg-ink/10" />or<span className="h-px flex-1 bg-ink/10" /></div>
      <button type="button" className="btn-ghost w-full" disabled={busy} onClick={continueAsGuest}>Continue as guest</button>
      <p className="text-center text-xs text-ink/50">Guests can save and discover right away. Their wishlist stays in this browser unless they create an account later.</p>
      <button type="button" className="w-full text-center text-sm text-ink/60 underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}>
        {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
