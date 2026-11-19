import "server-only";
import { createClient } from "@supabase/supabase-js";

export const hasServiceRole = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Service-role client. SERVER ONLY. Used exclusively for: SerpAPI quota/cache and the
 * whitelisted shared-wishlist function. Never used to read a user's private data.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
