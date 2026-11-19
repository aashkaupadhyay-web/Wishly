import Link from "next/link";
import type { WishlistRow } from "@/lib/products";
import { rowToProduct } from "@/lib/products";
import { AttrChips } from "./AttrChips";
import { ProductImage } from "./ProductImage";

export function ProductCard({
  row, selectable, selected, onToggle,
}: {
  row: WishlistRow;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const p = rowToProduct(row);
  return (
    <article className={`card group relative flex flex-col overflow-hidden transition ${selected ? "ring-2 ring-clay-500" : ""}`}>
      {selectable && (
        <label className="absolute left-3 top-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow">
          <input type="checkbox" className="h-4 w-4 accent-clay-600" checked={selected} onChange={onToggle} aria-label={`Select ${p.name} to share`} />
        </label>
      )}
      <Link href={`/wishlist/${row.id}`} className="block aspect-[5/4] overflow-hidden bg-sand">
        <ProductImage product={p} className="transition group-hover:scale-[1.02]" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-medium leading-snug">
            <Link href={`/wishlist/${row.id}`} className="hover:underline">{p.name}</Link>
          </h3>
          <p className="text-sm text-ink/60">{[p.retailer, p.category].filter(Boolean).join(" · ") || "No retailer yet"}</p>
        </div>
        <AttrChips product={p} />
        <div className="mt-auto flex items-center justify-between pt-2 text-sm">
          <Link href={`/discover?item=${row.id}`} className="font-medium text-clay-600 hover:underline">Find similar</Link>
          {p.product_url && (
            <a href={p.product_url} target="_blank" rel="noopener noreferrer nofollow" className="text-ink/60 hover:underline">
              View original ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
