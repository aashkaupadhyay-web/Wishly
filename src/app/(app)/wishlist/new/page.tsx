import { loadCatalog } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import { NewProductClient } from "./NewProductClient";

export const metadata = { title: "Save a product · Wishly" };

export default async function NewProductPage() {
  const supabase = await createClient();
  const catalog = await loadCatalog(supabase);
  const known = catalog.map((p) => ({
    id: p.id!, name: p.name, retailer: p.retailer, product_url: p.product_url, image_url: p.image_url,
    category: p.category, subcategory: p.subcategory, color: p.color, material: p.material, style: p.style,
    silhouette: p.silhouette, hardware: p.hardware, closure: p.closure, size: p.size, shape: p.shape,
    description: p.description,
  }));
  return <NewProductClient known={known} />;
}
