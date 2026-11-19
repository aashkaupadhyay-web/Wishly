"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ATTRIBUTE_LABELS, OPTIONS } from "@/lib/config";

export interface FormValues {
  product_name: string;
  retailer: string;
  product_url: string;
  image_url: string;
  category: string;
  subcategory: string;
  color: string;
  material: string;
  style: string;
  silhouette: string;
  hardware: string;
  closure: string;
  size: string;
  shape: string;
  description: string;
}

export const emptyValues: FormValues = {
  product_name: "", retailer: "", product_url: "", image_url: "", category: "", subcategory: "", color: "",
  material: "", style: "", silhouette: "", hardware: "", closure: "", size: "", shape: "", description: "",
};

type SelectKey = "category" | "color" | "material" | "style" | "silhouette" | "hardware" | "closure" | "size" | "shape";
const SELECTS: SelectKey[] = ["category", "color", "material", "style", "silhouette", "hardware", "closure", "size", "shape"];
const labelFor = (k: SelectKey) => (k === "shape" ? "Shape" : ATTRIBUTE_LABELS[k]);

/** Controlled dropdown with an "Other…" escape hatch for values outside the list. */
function AttrSelect({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void; options?: string[] }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Unknown</option>
        {OPTIONS[id as SelectKey].filter((o) => o !== "Other").map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        {OPTIONS[id as SelectKey].includes("Other") && <option value="Other">Other</option>}
        {value && !OPTIONS[id as SelectKey].includes(value) && <option value={value}>{value}</option>}
      </select>
    </div>
  );
}

export function ProductForm({
  initial, itemId, submitLabel, onBeforeSubmit, notice, extra,
}: {
  initial: FormValues;
  /** Additional fields sent with the payload (e.g. catalog_product_id for recognised sample URLs). */
  extra?: Record<string, unknown>;
  itemId?: string;
  submitLabel: string;
  /** Lets the screenshot flow resolve the image just before saving. */
  onBeforeSubmit?: (v: FormValues) => Promise<FormValues>;
  notice?: React.ReactNode;
}) {
  const router = useRouter();
  const [v, setV] = useState<FormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof FormValues) => (val: string) => setV((p) => ({ ...p, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const values = onBeforeSubmit ? await onBeforeSubmit(v) : v;
      const res = await fetch(itemId ? `/api/wishlist/${itemId}` : "/api/wishlist", {
        method: itemId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      router.push("/wishlist");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {notice}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="product_name">Product name *</label>
          <input id="product_name" required maxLength={200} className="input" value={v.product_name} onChange={(e) => set("product_name")(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="retailer">Retailer</label>
          <input id="retailer" maxLength={120} className="input" value={v.retailer} onChange={(e) => set("retailer")(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="product_url">Product URL</label>
          <input id="product_url" type="url" className="input" placeholder="https://…" value={v.product_url} onChange={(e) => set("product_url")(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="image_url">Image URL (optional)</label>
          <input id="image_url" className="input" placeholder="https://… (leave blank to use an illustration)" value={v.image_url.startsWith("data:") ? "(uploaded image kept)" : v.image_url} disabled={v.image_url.startsWith("data:")} onChange={(e) => set("image_url")(e.target.value)} />
          {v.image_url.startsWith("data:") && (
            <button type="button" className="mt-1 text-xs underline" onClick={() => set("image_url")("")}>Remove uploaded image</button>
          )}
        </div>
      </div>

      <fieldset className="rounded-2xl border border-ink/10 p-4">
        <legend className="px-2 text-sm font-semibold">Attributes</legend>
        <p className="mb-3 text-xs text-ink/60">Leave anything you aren&apos;t sure about as <strong>Unknown</strong>. We never assume a value.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {SELECTS.map((k) => (
            <AttrSelect key={k} id={k} label={labelFor(k)} value={v[k]} onChange={set(k)} />
          ))}
          <div>
            <label className="label" htmlFor="subcategory">Subcategory</label>
            <input id="subcategory" maxLength={60} className="input" value={v.subcategory} onChange={(e) => set("subcategory")(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="description">Description (optional)</label>
        <textarea id="description" rows={3} maxLength={1000} className="input" value={v.description} onChange={(e) => set("description")(e.target.value)} />
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}
