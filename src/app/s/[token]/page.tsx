import type { Metadata } from "next";
import { AttrChips } from "@/components/AttrChips";
import { ProductImage } from "@/components/ProductImage";
import { TOKEN_RE } from "@/lib/share";
import { hashToken } from "@/lib/share-server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared wishlist · Wishly",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface SharedItem {
  product_name: string; retailer: string | null; product_url: string | null; image_url: string | null;
  category: string | null; subcategory: string | null; color: string | null; material: string | null;
  style: string | null; silhouette: string | null; hardware: string | null; closure: string | null;
  size: string | null; shape: string | null; description: string | null;
}

async function load(token: string): Promise<SharedItem[] | null> {
  if (!TOKEN_RE.test(token) || !hasServiceRole()) return null;
  // The only data path: a SQL function that returns whitelisted columns for a non-revoked link.
  const { data, error } = await createAdminClient().rpc("get_shared_wishlist", { p_token_hash: hashToken(token) });
  if (error || !data || data.length === 0) return null;
  return data as SharedItem[];
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const items = await load((await params).token);

  if (!items) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="font-display text-3xl">This link isn&apos;t available</p>
        <p className="mt-3 text-ink/60">It may have been revoked by its owner, or the address is incorrect.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="font-display text-2xl">Wishly</p>
        <h1 className="mt-4 font-display text-3xl">A shared wishlist</h1>
        <p className="text-ink/60">{items.length} item{items.length === 1 ? "" : "s"}, view only.</p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i, idx) => (
          <article key={idx} className="card flex flex-col overflow-hidden">
            <div className="aspect-[5/4] bg-sand">
              <ProductImage product={{ name: i.product_name, image_url: i.image_url, category: i.category, color: i.color, hardware: i.hardware }} />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h2 className="font-medium leading-snug">{i.product_name}</h2>
              <p className="text-sm text-ink/60">{[i.retailer, i.category].filter(Boolean).join(" · ")}</p>
              <AttrChips product={{ color: i.color, material: i.material, style: i.style, hardware: i.hardware, closure: i.closure, size: i.size }} max={6} />
              {i.product_url && (
                <a href={i.product_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-auto pt-2 text-sm font-medium text-clay-600 hover:underline">View original ↗</a>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
