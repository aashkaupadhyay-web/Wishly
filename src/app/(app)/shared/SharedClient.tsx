"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TOKEN_RE } from "@/lib/share";

export interface ShareRow {
  id: string;
  created_at: string;
  revoked_at: string | null;
  names: string[];
}

export function SharedClient({ shares }: { shares: ShareRow[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function open(e: React.FormEvent) {
    e.preventDefault();
    const token = input.trim().split("/").filter(Boolean).pop() ?? "";
    if (!TOKEN_RE.test(token)) return setError("That doesn't look like a Wishly share link.");
    router.push(`/s/${token}`);
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this link? Anyone using it will immediately lose access.")) return;
    setBusyId(id);
    const res = await fetch(`/api/share/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) return setError("Couldn't revoke the link. Try again.");
    router.refresh();
  }

  const active = shares.filter((s) => !s.revoked_at);
  const revoked = shares.filter((s) => s.revoked_at);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Shared Wishlist</h1>
        <p className="text-ink/60">View a link someone shared with you, or manage the links you&apos;ve created.</p>
      </div>

      <section className="card space-y-2 p-5">
        <h2 className="font-display text-xl">Open a shared link</h2>
        <form onSubmit={open} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="share-input" className="sr-only">Share link</label>
          <input id="share-input" className="input" placeholder="Paste a share link…" value={input} onChange={(e) => { setInput(e.target.value); setError(null); }} />
          <button className="btn-primary shrink-0">Open</button>
        </form>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Your active links</h2>
        {active.length === 0 ? (
          <div className="card p-6 text-sm text-ink/60">
            No active links. Create one from <Link href="/wishlist" className="underline">My Wishlist</Link> by choosing &ldquo;Select items to share&rdquo;.
          </div>
        ) : (
          <ul className="space-y-3">
            {active.map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{s.names.length} item{s.names.length === 1 ? "" : "s"} shared</p>
                  <p className="truncate text-sm text-ink/60">{s.names.join(", ") || "Items were removed"}</p>
                  <p className="text-xs text-ink/40">Created {new Date(s.created_at).toLocaleDateString()}</p>
                </div>
                <button className="btn-danger" disabled={busyId === s.id} onClick={() => revoke(s.id)}>{busyId === s.id ? "Revoking…" : "Revoke"}</button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink/50">For security, link addresses are shown only once at creation (we store just a hash). To share again, create a new link.</p>
      </section>

      {revoked.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink/60">Revoked</h2>
          <ul className="space-y-1 text-sm text-ink/50">
            {revoked.map((s) => <li key={s.id}>{s.names.length} item(s), created {new Date(s.created_at).toLocaleDateString()}, revoked {new Date(s.revoked_at!).toLocaleDateString()}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
