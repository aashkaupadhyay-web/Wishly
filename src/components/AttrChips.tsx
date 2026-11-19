import { isKnown } from "@/lib/engine/match";
import type { Product } from "@/lib/types";

/** Compact key-attribute chips. Unknown values are omitted rather than guessed. */
export function AttrChips({ product, max = 5 }: { product: Partial<Product>; max?: number }) {
  const items = [product.color, product.material, product.style, product.hardware && `${product.hardware} hardware`, product.closure, product.size]
    .filter((v): v is string => typeof v === "string" && isKnown(v.replace(/ hardware$/, "")))
    .slice(0, max);
  if (!items.length) return <p className="text-xs text-ink/40">No attributes confirmed yet</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className="chip">{i}</span>
      ))}
    </div>
  );
}
