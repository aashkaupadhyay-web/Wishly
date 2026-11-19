import type { SupabaseClient } from "@supabase/supabase-js";
import { CATALOG } from "@/data/catalog";
import type { Product } from "./types";
import type { ProductInput } from "./validation";

export interface WishlistRow {
  id: string;
  catalog_product_id: string | null;
  product_name: string;
  retailer: string | null;
  product_url: string | null;
  image_url: string | null;
  category: string | null;
  subcategory: string | null;
  color: string | null;
  material: string | null;
  style: string | null;
  silhouette: string | null;
  hardware: string | null;
  closure: string | null;
  size: string | null;
  shape: string | null;
  description: string | null;
  created_at: string;
}

export const rowToProduct = (r: WishlistRow): Product => ({
  id: r.id,
  source: "wishlist",
  name: r.product_name,
  retailer: r.retailer,
  product_url: r.product_url,
  image_url: r.image_url,
  category: r.category,
  subcategory: r.subcategory,
  color: r.color,
  material: r.material,
  style: r.style,
  silhouette: r.silhouette,
  hardware: r.hardware,
  closure: r.closure,
  size: r.size,
  shape: r.shape,
  description: r.description,
  catalog_product_id: r.catalog_product_id,
});

export const productToInput = (p: Product): ProductInput => ({
  product_name: p.name,
  retailer: p.retailer,
  product_url: p.product_url,
  image_url: p.image_url,
  category: p.category,
  subcategory: p.subcategory,
  color: p.color,
  material: p.material,
  style: p.style,
  silhouette: p.silhouette,
  hardware: p.hardware,
  closure: p.closure,
  size: p.size,
  shape: p.shape,
  description: p.description,
  catalog_product_id: p.source === "catalog" ? (p.id ?? null) : null,
});

/** Catalog from the database; falls back to the bundled copy so discovery always works. */
export async function loadCatalog(supabase: SupabaseClient): Promise<Product[]> {
  const { data, error } = await supabase.from("catalog_products").select("*");
  if (error || !data || data.length === 0) return CATALOG;
  return (data as Record<string, string | null>[]).map((r) => ({
    id: r.id as string,
    source: "catalog" as const,
    name: r.name as string,
    retailer: r.retailer,
    product_url: r.product_url,
    image_url: r.image_url,
    category: r.category,
    subcategory: r.subcategory,
    color: r.color,
    material: r.material,
    style: r.style,
    silhouette: r.silhouette,
    hardware: r.hardware,
    closure: r.closure,
    size: r.size,
    shape: r.shape,
    description: r.description,
  }));
}
