import Link from "next/link";
import type { WishlistRow } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import { WishlistClient } from "./WishlistClient";

export const metadata = { title: "My Wishlist · Wishly" };

export default async function WishlistPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("wishlist_items").select("*").order("created_at", { ascending: false });
  const rows = (data ?? []) as WishlistRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">My Wishlist</h1>
          <p className="text-ink/60">Everything you love, from every retailer, in one place.</p>
        </div>
        <Link href="/wishlist/new" className="btn-primary">+ Save a product</Link>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">We couldn&apos;t load your wishlist. Please refresh.</p>}
      {rows.length === 0 && !error ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="font-display text-2xl">Your wishlist is empty</p>
          <p className="max-w-md text-ink/60">Paste a product link or upload a screenshot of a handbag you like. Then we&apos;ll find similar ones.</p>
          <Link href="/wishlist/new" className="btn-primary">Save your first product</Link>
        </div>
      ) : (
        <WishlistClient rows={rows} />
      )}
    </div>
  );
}
