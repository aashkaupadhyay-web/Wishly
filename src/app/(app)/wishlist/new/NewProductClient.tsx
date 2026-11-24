"use client";

import { useRef, useState } from "react";
import { emptyValues, ProductForm, type FormValues } from "@/components/ProductForm";
import { ATTRIBUTE_LABELS } from "@/lib/config";
import { normalizeUrl } from "@/lib/engine/match";
import { extractAttributes, guessName } from "@/lib/extract";
import { isSafeHttpUrl } from "@/lib/validation";

interface Known {
  id: string; name: string; retailer: string | null; product_url: string | null; image_url: string | null;
  category: string | null; subcategory: string | null; color: string | null; material: string | null;
  style: string | null; silhouette: string | null; hardware: string | null; closure: string | null;
  size: string | null; shape: string | null; description: string | null;
}

/** Draws the image to a canvas. `longSide` is the target size of the longer edge (small images are upscaled). */
async function rasterize(src: string, longSide: number, mime: "image/png" | "image/jpeg", maxScale = 1): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const w = img.naturalWidth || img.width || longSide;
  const h = img.naturalHeight || img.height || longSide;
  const scale = Math.min(maxScale, longSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return mime === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.8);
}

/** Reads text from the image entirely in the browser (Tesseract.js). Nothing is uploaded. */
async function readText(src: string, onProgress: (pct: number) => void): Promise<string> {
  const png = await rasterize(src, 1400, "image/png", 3);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(png);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

interface Shot {
  src: string;
  phase: "reading" | "ready";
  progress: number;
  initial: FormValues;
  found: string[];
  failed: boolean;
}

export function NewProductClient({ known }: { known: Known[] }) {
  const [tab, setTab] = useState<"url" | "screenshot">("url");

  // URL flow
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlStage, setUrlStage] = useState<{ initial: FormValues; catalogId: string | null; recognised: boolean } | null>(null);

  // Screenshot flow
  const [shot, setShot] = useState<Shot | null>(null);
  const [retain, setRetain] = useState(false);
  const runId = useRef(0);

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

  async function analyse(src: string) {
    const id = ++runId.current;
    setShot({ src, phase: "reading", progress: 0, initial: emptyValues, found: [], failed: false });
    try {
      const text = await readText(src, (pct) => {
        if (runId.current === id) setShot((s) => (s && s.phase === "reading" ? { ...s, progress: pct } : s));
      });
      if (runId.current !== id) return; // superseded or skipped
      const a = extractAttributes(text);
      const name = guessName(text);
      const initial: FormValues = {
        ...emptyValues, product_name: name,
        category: a.category ?? "", color: a.color ?? "", material: a.material ?? "", style: a.style ?? "",
        silhouette: a.silhouette ?? "", hardware: a.hardware ?? "", closure: a.closure ?? "", size: a.size ?? "",
      };
      const found = [
        ...(name ? ["Name"] : []),
        ...(Object.entries(a) as [keyof typeof a, string | null][]).filter(([, v]) => v).map(([k]) => ATTRIBUTE_LABELS[k]),
      ];
      setShot({ src, phase: "ready", progress: 100, initial, found, failed: false });
    } catch {
      if (runId.current === id) setShot({ src, phase: "ready", progress: 0, initial: emptyValues, found: [], failed: true });
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8_000_000) {
      return alert("Please choose a PNG, JPEG or WebP image under 8 MB.");
    }
    const reader = new FileReader();
    reader.onload = () => analyse(String(reader.result));
    reader.readAsDataURL(file);
  }

  function skip() {
    runId.current++; // ignore the in-flight result
    setShot((s) => (s ? { ...s, phase: "ready", initial: emptyValues, found: [], failed: false } : s));
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
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button type="button" className="btn-ghost" onClick={() => analyse("/sample-screenshot.svg")}>Use the sample screenshot</button>
          </div>
          <p className="text-xs text-ink/60">
            We read the text in your screenshot <strong>in your browser</strong> to pre-fill the form. The image is never uploaded. You review and edit everything before saving.
          </p>
          {shot && (
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              <div className="space-y-3">
                <img src={shot.src} alt="Your screenshot" className="w-full rounded-xl border border-ink/10" />
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-clay-600" checked={retain} onChange={(e) => setRetain(e.target.checked)} />
                  <span>Keep this image with the saved product <span className="block text-xs text-ink/50">Off by default. If unchecked, the screenshot is discarded.</span></span>
                </label>
              </div>
              {shot.phase === "reading" ? (
                <div className="space-y-3 rounded-2xl border border-ink/10 p-5" role="status" aria-live="polite">
                  <p className="font-medium">Reading your screenshot…</p>
                  <div className="h-2 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full bg-clay-500 transition-all" style={{ width: `${Math.max(5, shot.progress)}%` }} />
                  </div>
                  <p className="text-xs text-ink/60">The first scan downloads a small text-reading engine, so it can take a little longer.</p>
                  <button type="button" className="btn-ghost" onClick={skip}>Skip and fill in manually</button>
                </div>
              ) : (
                <ProductForm
                  key={`${shot.src.slice(-40)}-${shot.found.join()}-${shot.failed}`}
                  initial={shot.initial}
                  submitLabel="Confirm & save"
                  onBeforeSubmit={async (v) => (retain ? { ...v, image_url: await rasterize(shot.src, 640, "image/jpeg") } : v)}
                  notice={
                    <p className={`rounded-lg px-3 py-2 text-sm ${shot.found.length ? "bg-amber-50 text-amber-900" : "bg-sand text-ink/80"}`}>
                      {shot.failed
                        ? "We couldn't read this screenshot, so please fill in the details yourself."
                        : shot.found.length
                          ? `Pre-filled from the text we could read: ${shot.found.join(", ")}. This can be wrong. Please check every field. Anything we couldn't confirm is left as Unknown.`
                          : "We couldn't find readable product details in this image. Please enter them yourself."}{" "}
                      Nothing is saved until you confirm.
                    </p>
                  }
                />
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
