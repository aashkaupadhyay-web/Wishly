import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, requireUser, sameOrigin } from "@/lib/api";
import { hashToken } from "@/lib/share-server";

const schema = z.object({ itemIds: z.array(z.string().uuid()).min(1).max(100) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Bad origin", 403);
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Select at least one item to share", 422);
  const itemIds = [...new Set(parsed.data.itemIds)];

  // Only the caller's own items may be shared (RLS + explicit filter).
  const { data: owned } = await auth.supabase
    .from("wishlist_items")
    .select("id")
    .in("id", itemIds)
    .eq("user_id", auth.user.id);
  if (!owned || owned.length !== itemIds.length) return jsonError("Some items were not found", 404);

  const token = randomBytes(32).toString("base64url"); // 256 bits; shown once, only its hash is stored
  const { data: share, error } = await auth.supabase
    .from("shared_wishlists")
    .insert({ owner_user_id: auth.user.id, token_hash: hashToken(token) })
    .select("id")
    .single();
  if (error || !share) return jsonError("Could not create link", 500);

  const { error: itemsError } = await auth.supabase
    .from("shared_wishlist_items")
    .insert(itemIds.map((wishlist_item_id) => ({ shared_wishlist_id: share.id, wishlist_item_id })));
  if (itemsError) {
    await auth.supabase.from("shared_wishlists").delete().eq("id", share.id);
    return jsonError("Could not create link", 500);
  }
  return NextResponse.json({ id: share.id, token }, { status: 201 });
}
