import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, requireUser, sameOrigin } from "@/lib/api";
import { productInputSchema } from "@/lib/validation";

const idSchema = z.string().uuid();

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!sameOrigin(req)) return jsonError("Bad origin", 403);
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonError("Not found", 404);

  const parsed = productInputSchema.omit({ catalog_product_id: true }).safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  // RLS also restricts this to the caller's own rows; the explicit filter keeps intent obvious.
  const { data, error } = await auth.supabase
    .from("wishlist_items")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("user_id", auth.user.id)
    .select("id");
  if (error) return jsonError("Could not update product", 500);
  if (!data?.length) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!sameOrigin(req)) return jsonError("Bad origin", 403);
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonError("Not found", 404);

  const { data, error } = await auth.supabase
    .from("wishlist_items")
    .delete()
    .eq("id", id.data)
    .eq("user_id", auth.user.id)
    .select("id");
  if (error) return jsonError("Could not delete product", 500);
  if (!data?.length) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
}
