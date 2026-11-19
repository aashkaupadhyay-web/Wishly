"use client";

import { useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { WishlistRow } from "@/lib/products";

export function WishlistClient({ rows }: { rows: WishlistRow[] }) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function createLink() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: [...selected] }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Could not create the link");
    setLink(`${window.location.origin}/s/${json.token}`);
    setSelected(new Set());
    setSelecting(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {!selecting ? (
          <button className="btn-ghost" onClick={() => { setSelecting(true); setLink(null); }}>Select items to share</button>
        ) : (
          <>
            <button className="btn-primary" disabled={selected.size === 0 || busy} onClick={createLink}>
              {busy ? "Creating…" : `Create read-only link (${selected.size})`}
            </button>
            <button className="btn-ghost" onClick={() => { setSelecting(false); setSelected(new Set()); }}>Cancel</button>
            <span className="text-sm text-ink/60">Only the items you tick will be visible.</span>
          </>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {link && (
        <div role="status" className="card space-y-2 border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">Share link created. Copy it now: for your security it won&apos;t be shown again.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly className="input font-mono text-xs" value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
            <button className="btn-primary shrink-0" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-green-900/70">Anyone with this link can view the selected items, read-only. Revoke it any time under Shared Wishlist.</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <ProductCard key={r.id} row={r} selectable={selecting} selected={selected.has(r.id)} onToggle={() => toggle(r.id)} />
        ))}
      </div>
    </div>
  );
}
