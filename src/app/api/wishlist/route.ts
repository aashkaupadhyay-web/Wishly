import { NextResponse } from "next/server";
import { jsonError, readJson, requireUser, sameOrigin } from "@/lib/api";
import { productInputSchema } from "@/lib/validation";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Bad origin", 403);
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const parsed = productInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { data, error } = await auth.supabase
    .from("wishlist_items")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("id")
    .single();
  if (error) return jsonError("Could not save product", 500);
  return NextResponse.json({ id: data.id }, { status: 201 });
}
