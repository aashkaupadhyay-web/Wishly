import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser, sameOrigin } from "@/lib/api";

/** Revoke a share link (soft revoke: the row stays for the owner's history). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return jsonError("Bad origin", 403);
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success) return jsonError("Not found", 404);

  const { data, error } = await auth.supabase
    .from("shared_wishlists")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("owner_user_id", auth.user.id)
    .is("revoked_at", null)
    .select("id");
  if (error) return jsonError("Could not revoke link", 500);
  if (!data?.length) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
}
