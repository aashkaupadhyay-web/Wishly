"use client";

import { useMemo, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { ATTRIBUTE_LABELS, OPTIONS } from "@/lib/config";
import { defaultPreferences, isKnown } from "@/lib/engine/match";
import { rowToProduct, type WishlistRow } from "@/lib/products";
import { ATTRIBUTES, type Attribute, type PreferenceMode, type Preferences, type Recommendation } from "@/lib/types";

type Rec = Recommendation & { resultId: string | null };
interface Response {
  searchId: string | null;
  live: { status: string; message: string | null; query: string; count: number };
  considered: number;
  excluded: { mustFail: number; unknownRequired: number; sameProduct: number; duplicate: number };
  notice: string | null;
  recommendations: Rec[];
}

const MODES: { mode: PreferenceMode; label: string }[] = [
  { mode: "must", label: "Must-have" },
  { mode: "prefer", label: "Prefer" },
  { mode: "ignore", label: "Don't care" },
];

export function DiscoverClient({ items, initialId, liveAvailable }: { items: WishlistRow[]; initialId: string; liveAvailable: boolean }) {
  const [itemId, setItemId] = useState(initialId);
  const row = items.find((i) => i.id === itemId)!;
  const original = useMemo(() => rowToProduct(row), [row]);
  const [prefs, setPrefs] = useState<Preferences>(() => defaultPreferences(rowToProduct(row)));
  const [includeLive, setIncludeLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Response | null>(null);
  const [saved, setSaved] = useState<Record<string, "saving" | "saved">>({});
  const [feedback, setFeedback] = useState<Record<string, "helpful" | "not_helpful">>({});

  function pickItem(id: string) {
    setItemId(id);
    setPrefs(defaultPreferences(rowToProduct(items.find((i) => i.id === id)!)));
    setData(null);
    setError(null);
  }

  const setPref = (a: Attribute, patch: Partial<Preferences[Attribute]>) =>
    setPrefs((p) => ({ ...p, [a]: { ...p[a], ...patch } }));

  async function search() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlistItemId: itemId, preferences: prefs, includeLive }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(rec: Rec) {
    const key = rec.product.id ?? rec.product.name;
    setSaved((s) => ({ ...s, [key]: "saving" }));
    const p = rec.product;
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: p.name, retailer: p.retailer, product_url: p.product_url, image_url: p.image_url,
        category: p.category, subcategory: p.subcategory, color: p.color, material: p.material, style: p.style,
        silhouette: p.silhouette, hardware: p.hardware, closure: p.closure, size: p.size, shape: p.shape,
        description: p.description, catalog_product_id: p.source === "catalog" ? p.id : null,
      }),
    });
    setSaved((s) => {
      const n = { ...s };
      if (res.ok) n[key] = "saved";
      else delete n[key];
      return n;
    });
    if (!res.ok) setError("Couldn't save that product. Please try again.");
  }

  async function sendFeedback(rec: Rec, type: "helpful" | "not_helpful") {
    if (!rec.resultId) return;
    const prev = feedback[rec.resultId];
    setFeedback((f) => ({ ...f, [rec.resultId!]: type }));
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId: rec.resultId, type }),
    });
    if (!res.ok)
      setFeedback((f) => {
        const n = { ...f };
        if (prev) n[rec.resultId!] = prev;
        else delete n[rec.resultId!];
        return n;
      });
  }

  const valuesFor = (a: Attribute) => {
    const base = OPTIONS[a].filter((o) => o !== "Other");
    const cur = original[a];
    return cur && isKnown(cur) && !base.includes(cur) ? [cur, ...base] : base;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Discover alternatives</h1>
        <p className="text-ink/60">Pick a saved product, tell us what matters, and we&apos;ll find the closest matches.</p>
      </div>

      {/* 1. Pick the product */}
      <section aria-label="Choose a product" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((i) => (
          <button key={i.id} onClick={() => pickItem(i.id)} aria-pressed={i.id === itemId}
            className={`card flex w-40 shrink-0 flex-col overflow-hidden text-left transition ${i.id === itemId ? "ring-2 ring-clay-500" : "opacity-80 hover:opacity-100"}`}>
            <div className="aspect-[5/4]"><ProductImage product={rowToProduct(i)} /></div>
            <span className="line-clamp-2 p-2 text-xs font-medium">{i.product_name}</span>
          </button>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* 2. Preferences */}
        <section className="card h-fit space-y-4 p-5" aria-labelledby="prefs-h">
          <div>
            <h2 id="prefs-h" className="font-display text-xl">What matters to you?</h2>
            <p className="text-xs text-ink/60">
              <strong>Must-have</strong>: confirmed matches only (unknown is excluded). <strong>Prefer</strong>: earns points. <strong>Don&apos;t care</strong>: ignored.
            </p>
          </div>
          <ul className="space-y-3">
            {ATTRIBUTES.map((a) => {
              const p = prefs[a];
              return (
                <li key={a} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{ATTRIBUTE_LABELS[a]}</span>
                    <select aria-label={`${ATTRIBUTE_LABELS[a]} value`} className="input !w-auto !py-1 text-xs" value={p.value ?? ""}
                      onChange={(e) => setPref(a, { value: e.target.value || null })}>
                      <option value="">{isKnown(original[a]) ? "—" : "Unknown on original"}</option>
                      {valuesFor(a).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div role="radiogroup" aria-label={`${ATTRIBUTE_LABELS[a]} importance`} className="grid grid-cols-3 gap-1 rounded-full bg-sand p-0.5">
                    {MODES.map((m) => (
                      <button key={m.mode} role="radio" aria-checked={p.mode === m.mode} type="button"
                        onClick={() => setPref(a, { mode: m.mode })}
                        className={`rounded-full px-2 py-1 text-xs font-medium transition ${p.mode === m.mode ? (m.mode === "must" ? "bg-clay-600 text-white" : m.mode === "prefer" ? "bg-ink text-cream" : "bg-white shadow-sm") : "text-ink/60 hover:text-ink"}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {p.mode !== "ignore" && !p.value && (
                    <p className="text-xs text-amber-700">Choose a value, or this will be ignored.</p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-2 border-t border-ink/10 pt-4">
            <label className={`flex items-start gap-2 text-sm ${liveAvailable ? "" : "opacity-60"}`}>
              <input type="checkbox" className="mt-1 accent-clay-600" disabled={!liveAvailable} checked={includeLive && liveAvailable} onChange={(e) => setIncludeLive(e.target.checked)} />
              <span>
                Also search Google Shopping (live)
                <span className="block text-xs text-ink/50">
                  {liveAvailable ? "Uses one of this app's limited monthly searches. Repeats are cached." : "Live search is off. Using the built-in catalog."}
                </span>
              </span>
            </label>
            <button className="btn-primary w-full" onClick={search} disabled={busy}>
              {busy ? "Searching…" : data ? "Update results" : "Find alternatives"}
            </button>
          </div>
        </section>

        {/* 3. Results */}
        <section aria-live="polite" className="space-y-5">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!data && !busy && (
            <div className="card flex h-full min-h-60 flex-col items-center justify-center gap-2 p-8 text-center text-ink/60">
              <p className="font-display text-xl text-ink">Ready when you are</p>
              <p className="max-w-sm text-sm">We&apos;re starting from <strong>{original.name}</strong>. Adjust the preferences, then hit &ldquo;Find alternatives&rdquo;.</p>
            </div>
          )}
          {busy && (
            <div className="grid gap-4 md:grid-cols-3" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="card h-72 animate-pulse bg-sand" />)}
            </div>
          )}
          {data && !busy && (
            <>
              {data.live.message && includeLive && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">{data.live.message}</p>
              )}
              {data.live.count > 0 && (
                <p className="text-xs text-ink/50">Included {data.live.count} live results for “{data.live.query}”{data.live.status === "cached" ? " (cached)" : ""}.</p>
              )}
              {data.notice && <p className="rounded-lg bg-sand px-3 py-2 text-sm" role="status">{data.notice}</p>}

              <div className="grid gap-4 md:grid-cols-3">
                {data.recommendations.map((rec, idx) => {
                  const key = rec.product.id ?? rec.product.name;
                  return (
                    <article key={key} className="card flex flex-col overflow-hidden">
                      <div className="relative aspect-[5/4] bg-sand">
                        <ProductImage product={rec.product} />
                        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold shadow">#{idx + 1}</span>
                        <span className="absolute right-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cream">
                          {rec.product.source === "serpapi" ? "Live" : "Catalog"}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div>
                          <h3 className="font-medium leading-snug">{rec.product.name}</h3>
                          <p className="text-sm text-ink/60">{rec.product.retailer ?? "Unknown retailer"}</p>
                        </div>
                        <div>
                          {rec.score === null ? (
                            <p className="text-sm font-semibold">Meets all your must-haves</p>
                          ) : (
                            <>
                              <p className="text-sm"><span className="text-2xl font-semibold">{Math.round(rec.score)}%</span> <span className="text-ink/60">similarity</span></p>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={Math.round(rec.score)} aria-valuemin={0} aria-valuemax={100} aria-label="Similarity score">
                                <div className="h-full rounded-full bg-clay-500" style={{ width: `${rec.score}%` }} />
                              </div>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-ink/80">{rec.explanation}</p>
                        <div className="flex flex-wrap gap-1 text-xs">
                          {rec.matched.map((a) => <span key={a} className="rounded-full bg-green-100 px-2 py-0.5 text-green-900">✓ {ATTRIBUTE_LABELS[a]}</span>)}
                          {rec.differences.map((a) => <span key={a} className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">≠ {ATTRIBUTE_LABELS[a]}</span>)}
                          {rec.unknown.map((a) => <span key={a} className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">? {ATTRIBUTE_LABELS[a]}</span>)}
                        </div>
                        <div className="mt-auto space-y-2 pt-1">
                          <div className="flex gap-2">
                            <button className="btn-primary flex-1 !py-1.5" disabled={saved[key] === "saving" || saved[key] === "saved"} onClick={() => save(rec)}>
                              {saved[key] === "saved" ? "Saved ✓" : saved[key] === "saving" ? "Saving…" : "♡ Save"}
                            </button>
                            {rec.product.product_url && (
                              <a className="btn-ghost !py-1.5" href={rec.product.product_url} target="_blank" rel="noopener noreferrer nofollow">View ↗</a>
                            )}
                          </div>
                          {rec.resultId && (
                            <div className="flex items-center gap-2 text-xs text-ink/60" role="group" aria-label="Was this helpful?">
                              <span>Helpful?</span>
                              {(["helpful", "not_helpful"] as const).map((t) => (
                                <button key={t} aria-pressed={feedback[rec.resultId!] === t} onClick={() => sendFeedback(rec, t)}
                                  className={`rounded-full border px-2 py-0.5 ${feedback[rec.resultId!] === t ? "border-ink bg-ink text-cream" : "border-ink/15 hover:border-ink/40"}`}>
                                  {t === "helpful" ? "👍 Yes" : "👎 No"}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {data.recommendations.length > 0 && <CompareTable original={original.name} recs={data.recommendations} />}

              <p className="text-xs text-ink/50">
                Considered {data.considered} products. Excluded: {data.excluded.mustFail} failed a must-have, {data.excluded.unknownRequired} couldn&apos;t confirm a must-have, {data.excluded.sameProduct + data.excluded.duplicate} same/duplicate.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function CompareTable({ original, recs }: { original: string; recs: Rec[] }) {
  return (
    <section aria-labelledby="cmp-h" className="card overflow-x-auto">
      <h2 id="cmp-h" className="px-5 pt-4 font-display text-xl">Side-by-side</h2>
      <table className="mt-2 w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink/50">
            <th className="px-5 py-2 font-semibold">Attribute</th>
            <th className="px-3 py-2 font-semibold">Original<span className="block truncate font-normal normal-case text-ink/60">{original}</span></th>
            {recs.map((r, i) => <th key={i} className="px-3 py-2 font-semibold">#{i + 1}<span className="block max-w-[10rem] truncate font-normal normal-case text-ink/60">{r.product.name}</span></th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-ink/5">
            <td className="px-5 py-2 text-ink/60">Similarity</td>
            <td className="px-3 py-2 text-ink/40">—</td>
            {recs.map((r, i) => <td key={i} className="px-3 py-2 font-semibold">{r.score === null ? "Not scored" : `${Math.round(r.score)}%`}</td>)}
          </tr>
          {ATTRIBUTES.map((a, row) => {
            const first = recs[0].cells[row];
            return (
              <tr key={a} className="border-t border-ink/5">
                <td className="px-5 py-2">
                  {ATTRIBUTE_LABELS[a]}
                  {first.mode !== "ignore" && (
                    <span className="ml-2 rounded-full bg-sand px-1.5 py-0.5 text-[10px] uppercase text-ink/60">{first.mode === "must" ? "must" : "prefer"}</span>
                  )}
                </td>
                <td className="px-3 py-2">{first.original ?? <span className="text-ink/40">Unknown</span>}</td>
                {recs.map((r, i) => {
                  const c = r.cells[row];
                  const tone = c.status === "match" ? "bg-green-50 text-green-900" : c.status === "differ" ? "bg-amber-50 text-amber-900" : "bg-gray-50 text-gray-500";
                  return (
                    <td key={i} className={`px-3 py-2 ${tone}`}>
                      {c.candidate ?? "Unknown"}
                      {c.mustSatisfied && <span className="ml-1 text-xs" title="Must-have satisfied">✓ required</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-5 py-3 text-xs text-ink/50">Green = matches your target · Amber = differs · Grey = not confirmed. Ranked by similarity score, highest first.</p>
    </section>
  );
}
