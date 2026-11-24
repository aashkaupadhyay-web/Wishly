import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const isGuest = Boolean(user.is_anonymous);
  return (
    <>
      <Nav isGuest={isGuest} />
      {isGuest && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900" role="note">
          You&apos;re browsing as a guest. Your wishlist is tied to this browser.{" "}
          <Link href="/settings" className="font-medium underline">Save your account</Link> to keep it.
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
