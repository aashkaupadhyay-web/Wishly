import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AttrChips } from "@/components/AttrChips";
import { ProductImage } from "@/components/ProductImage";
import type { FormValues } from "@/components/ProductForm";
import { rowToProduct, type WishlistRow } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "./DeleteButton";
import { EditForm } from "./EditForm";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("wishlist_items").select("*").eq("id", id.data).maybeSingle();
  if (!data) notFound(); // RLS: other users' items are indistinguishable from missing ones
  const row = data as WishlistRow;
  const p = rowToProduct(row);

  const initial: FormValues = {
    product_name: row.product_name, retailer: row.retailer ?? "", product_url: row.product_url ?? "",
    image_url: row.image_url ?? "", category: row.category ?? "", subcategory: row.subcategory ?? "",
    color: row.color ?? "", material: row.material ?? "", style: row.style ?? "", silhouette: row.silhouette ?? "",
    hardware: row.hardware ?? "", closure: row.closure ?? "", size: row.size ?? "", shape: row.shape ?? "",
    description: row.description ?? "",
  };

  return (
    <div className="space-y-8">
      <Link href="/wishlist" className="text-sm text-ink/60 hover:underline">← My Wishlist</Link>
      <section className="card grid gap-6 overflow-hidden md:grid-cols-[320px_1fr]">
        <div className="aspect-[5/4] md:aspect-auto"><ProductImage product={p} /></div>
        <div className="space-y-4 p-6">
          <div>
            <h1 className="font-display text-3xl">{p.name}</h1>
            <p className="text-ink/60">{[p.retailer, p.category, p.subcategory].filter(Boolean).join(" · ")}</p>
          </div>
          <AttrChips product={p} max={8} />
          {p.description && <p className="text-sm text-ink/70">{p.description}</p>}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={`/discover?item=${row.id}`} className="btn-primary">Find similar</Link>
            {p.product_url && (
              <a href={p.product_url} target="_blank" rel="noopener noreferrer nofollow" className="btn-ghost">View original ↗</a>
            )}
            <DeleteButton id={row.id} name={p.name} />
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Edit details</h2>
        <div className="card p-5"><EditForm id={row.id} initial={initial} /></div>
      </section>
    </div>
  );
}
