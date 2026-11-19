import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";

export const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Every API route authenticates itself; the middleware is not the only gate. */
export async function requireUser() {
  if (!isSupabaseConfigured()) return { error: jsonError("Server is not configured", 503) } as const;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: jsonError("Unauthorized", 401) } as const;
  return { supabase, user } as const;
}

/** Same-origin check for state-changing requests (CSRF defence in depth on top of SameSite cookies). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients / same-origin GET-like
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(req: Request): Promise<unknown | null> {
  try {
    const text = await req.text();
    if (text.length > 600_000) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
