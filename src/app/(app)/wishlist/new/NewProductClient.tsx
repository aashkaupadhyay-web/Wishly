"use client";

import { useState } from "react";
import { emptyValues, ProductForm, type FormValues } from "@/components/ProductForm";
import { normalizeUrl } from "@/lib/engine/match";
import { isSafeHttpUrl } from "@/lib/validation";

interface Known {
  id: string; name: string; retailer: string | null; product_url: string | null; image_url: string | null;
  category: string | null; subcategory: string | null; color: string | null; material: string | null;
  style: string | null; silhouette: string | null; hardware: string | null; closure: string | null;
  size: string | null; shape: string | null; description: string | null;
}

const SAMPLE_VALUES: FormValues = {
  ...emptyValues, product_name: "Atlas Structured Work Tote", retailer: "Maison Larue", category: "Tote",
  color: "Black", material: "Leather", style: "Structured", hardware: "Gold", closure: "Zipper", size: "Medium",
};

async function downscale(src: string, max = 640): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
  const c = document.createElement("canvas");
  c.width = Math.round((img.width || max) * scale);
  c.height = Math.round((img.height || max) * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

export function NewProductClient({ known }: { known: Known[] }) {
  const [tab, setTab] = useState<"url" | "screenshot">("url");

  // URL flow
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlStage, setUrlStage] = useState<{ initial: FormValues; catalogId: string | null; recognised: boolean } | null>(null);

  // Screenshot flow
  const [preview, setPreview] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [retain, setRetain] = useState(false);

  function lookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!isSafeHttpUrl(trimmed)) return setUrlError("Enter a valid public http(s) link, like https://retailer.com/product");
    setUrlError(null);
    const norm = normalizeUrl(trimmed);
    const hit = known.find((k) => normalizeUrl(k.product_url) === norm);
    if (hit) {
      setUrlStage({
        recognised: true, catalogId: hit.id,
        initial: {
          ...emptyValues, product_name: hit.name, retailer: hit.retailer ?? "", product_url: hit.product_url ?? trimmed,
          image_url: hit.image_url ?? "", category: hit.category ?? "", subcategory: hit.subcategory ?? "",
          color: hit.color ?? "", material: hit.material ?? "", style: hit.style ?? "", silhouette: hit.silhouette ?? "",
          hardware: hit.hardware ?? "", closure: hit.closure ?? "", size: hit.size ?? "", shape: hit.shape ?? "",
          description: hit.description ?? "",
        },
      });
    } else {
      let host = "";
      try { host = new URL(trimmed).hostname.replace(/^www\./, ""); } catch { /* validated above */ }
      setUrlStage({ recognised: false, catalogId: null, initial: { ...emptyValues, product_url: trimmed, retailer: host } });
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8_000_000) {
      return alert("Please choose a PNG, JPEG or WebP image under 8 MB.");
    }
    setIsSample(false);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Save a product</h1>
        <p className="text-ink/60">Add it from a link or a screenshot, then confirm the details.</p>
      </div>

      <div role="tablist" className="inline-flex rounded-full bg-sand p-1">
        {(["url", "screenshot"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? "bg-white shadow-sm" : "text-ink/60"}`}>
            {t === "url" ? "Paste a link" : "Upload a screenshot"}
          </button>
        ))}
      </div>

      {tab === "url" && (
        <section className="card space-y-4 p-5">
          <form onSubmit={lookup} className="space-y-2">
            <label className="label" htmlFor="url">Product URL</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="url" className="input" placeholder="https://…" value={url} onChange={(e) => { setUrl(e.target.value); setUrlStage(null); }} />
              <button className="btn-primary shrink-0">Continue</button>
            </div>
            {urlError && <p role="alert" className="text-sm text-red-700">{urlError}</p>}
          </form>
          <p className="text-xs text-ink/60">
            We don&apos;t scrape retailer pages. Sample catalog links are recognised automatically; for any other link we keep the URL and you fill in the details.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-ink/50">Try a sample:</span>
            {known.slice(0, 3).map((k) => (
              <button key={k.id} type="button" className="chip hover:bg-clay-500/20" onClick={() => { setUrl(k.product_url ?? ""); setUrlStage(null); }}>{k.name}</button>
            ))}
          </div>
          {urlStage && (
            <div className="border-t border-ink/10 pt-5">
              <ProductForm
                key={urlStage.initial.product_url}
                initial={urlStage.initial}
                extra={urlStage.catalogId ? { catalog_product_id: urlStage.catalogId } : undefined}
                submitLabel="Save to wishlist"
                notice={
                  <p className={`rounded-lg px-3 py-2 text-sm ${urlStage.recognised ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>
                    {urlStage.recognised
                      ? "Recognised a sample product, so we filled in what we know. Please check it."
                      : "We couldn't read details from this link, and that's fine. Your URL is saved; add the name and attributes below."}
                  </p>
                }
              />
            </div>
          )}
        </section>
      )}

      {tab === "screenshot" && (
        <section className="card space-y-5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="btn-primary cursor-pointer">
              Choose screenshot
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <button type="button" className="btn-ghost" onClick={() => { setPreview("/sample-screenshot.svg"); setIsSample(true); }}>Use the sample screenshot</button>
          </div>
          <p className="text-xs text-ink/60">
            Screenshots are <strong>not uploaded or analysed</strong>: the image stays in your browser. You enter the details yourself, and you confirm them before saving.
          </p>
          {preview && (
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              <div className="space-y-3">
                <img src={preview} alt="Your screenshot" className="w-full rounded-xl border border-ink/10" />
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-clay-600" checked={retain} onChange={(e) => setRetain(e.target.checked)} />
                  <span>Keep this image with the saved product <span className="block text-xs text-ink/50">Off by default. If unchecked, the screenshot is discarded.</span></span>
                </label>
              </div>
              <ProductForm
                key={isSample ? "sample" : preview.slice(0, 40)}
                initial={isSample ? SAMPLE_VALUES : emptyValues}
                submitLabel="Confirm & save"
                onBeforeSubmit={async (v) => (retain ? { ...v, image_url: await downscale(preview) } : v)}
                notice={
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {isSample ? "These sample values are a suggestion, not read from the image. " : ""}
                    Please enter or correct the details. Nothing is saved until you confirm.
                  </p>
                }
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
