"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ isGuest = false }: { isGuest?: boolean }) {
  const router = useRouter();
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        if (isGuest && !confirm("Guest wishlists can't be recovered after signing out. Sign out anyway?")) return;
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
