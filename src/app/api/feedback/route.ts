import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, requireUser, sameOrigin } from "@/lib/api";

const schema = z.object({ resultId: z.string().uuid(), type: z.enum(["helpful", "not_helpful"]) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Bad origin", 403);
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Invalid request", 422);

  // RLS verifies that the result belongs to one of this user's searches.
  const { error } = await auth.supabase.from("recommendation_feedback").upsert(
    { user_id: auth.user.id, recommendation_result_id: parsed.data.resultId, feedback_type: parsed.data.type },
    { onConflict: "user_id,recommendation_result_id" },
  );
  if (error) return jsonError("Could not save feedback", 400);
  return NextResponse.json({ ok: true });
}
