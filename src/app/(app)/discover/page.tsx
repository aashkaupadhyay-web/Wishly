import Link from "next/link";
import type { WishlistRow } from "@/lib/products";
import { liveConfig } from "@/lib/serpapi/runtime";
import { createClient } from "@/lib/supabase/server";
import { DiscoverClient } from "./DiscoverClient";

export const metadata = { title: "Discover · Wishly" };

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const { item } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("wishlist_items").select("*").order("created_at", { ascending: false });
  const rows = (data ?? []) as WishlistRow[];
  const cfg = liveConfig();

  if (rows.length === 0) {
    return (
      <div className="card mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-16 text-center">
        <h1 className="font-display text-3xl">Start with a bag you love</h1>
        <p className="text-ink/60">Save a product first. Then we&apos;ll find similar ones based on what matters to you.</p>
        <Link href="/wishlist/new" className="btn-primary">Save a product</Link>
      </div>
    );
  }

  return (
    <DiscoverClient
      items={rows}
      initialId={rows.find((r) => r.id === item)?.id ?? rows[0].id}
      liveAvailable={cfg.available}
    />
  );
}
