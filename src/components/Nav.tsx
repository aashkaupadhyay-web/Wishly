"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/wishlist", label: "My Wishlist" },
  { href: "/shared", label: "Shared Wishlist" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ isGuest = false }: { isGuest?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    if (isGuest && !confirm("Guest wishlists can't be recovered after signing out. Sign out anyway? (You can save your account in Settings first.)")) return;
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/discover" className="font-display text-2xl tracking-tight">Wishly</Link>
        <nav aria-label="Main" className="-mx-1 flex flex-1 items-center justify-end gap-1 overflow-x-auto sm:justify-center">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${active ? "bg-ink text-cream" : "text-ink/70 hover:bg-sand"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={signOut} className="btn-ghost hidden sm:inline-flex">Sign out</button>
      </div>
    </header>
  );
}
