import { createClient } from "@/lib/supabase/server";
import { SharedClient, type ShareRow } from "./SharedClient";

export const metadata = { title: "Shared Wishlist · Wishly" };

export default async function SharedPage() {
  const supabase = await createClient();
  // RLS limits this to the signed-in owner's links.
  const { data } = await supabase
    .from("shared_wishlists")
    .select("id, created_at, revoked_at, shared_wishlist_items(wishlist_items(product_name))")
    .order("created_at", { ascending: false });

  const shares: ShareRow[] = (data ?? []).map((s) => {
    const items = (s.shared_wishlist_items as unknown as { wishlist_items: { product_name: string } | null }[]) ?? [];
    return {
      id: s.id,
      created_at: s.created_at,
      revoked_at: s.revoked_at,
      names: items.map((i) => i.wishlist_items?.product_name).filter((n): n is string => Boolean(n)),
    };
  });
  return <SharedClient shares={shares} />;
}
