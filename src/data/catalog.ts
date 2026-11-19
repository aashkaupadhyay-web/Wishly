import type { Product } from "@/lib/types";

/**
 * Seeded sample catalog (sample data: retailers and URLs are illustrative).
 * `null` means "not confirmed", which the engine treats as unknown (never as a match).
 * supabase/seed.sql is generated from this file: `npm run seed:sql`.
 */
type Row = [
  name: string,
  retailer: string,
  category: string,
  subcategory: string | null,
  color: string | null,
  material: string | null,
  style: string | null,
  silhouette: string | null,
  hardware: string | null,
  closure: string | null,
  size: string | null,
  shape: string | null,
  description: string,
];

const ROWS: Row[] = [
  // ---- Totes ----
  ["Atlas Structured Work Tote", "Maison Larue", "Tote", "Work tote", "Black", "Leather", "Structured", "Structured", "Gold", "Zipper", "Medium", "Rectangular", "Smooth full-grain leather with a rigid base and laptop sleeve."],
  ["Harbor Everyday Tote", "Harbor Goods", "Tote", "Everyday tote", "Tan", "Canvas", "Casual", "Slouchy", "Brass", "Open Top", "Large", "Rectangular", "Heavy cotton canvas with leather handles."],
  ["Alder Boxy Tote", "Alder Row", "Tote", null, "Black", "Vegan Leather", "Structured", "Boxy", "Silver", "Zipper", "Medium", "Square", "Vegan leather tote with a boxy frame."],
  ["Northfield Slouch Tote", "Northfield & Co", "Tote", "Slouchy tote", "Brown", "Leather", "Slouchy", "Slouchy", "Gold", "Magnetic Snap", "Large", "Trapezoid", "Soft pebbled leather that holds its drape."],
  ["Juniper Minimal Tote", "Juniper Lane", "Tote", "Minimalist tote", "Beige", "Leather", "Minimalist", "Structured", "Silver", "Magnetic Snap", "Medium", "Rectangular", "Clean-lined tote in vegetable-tanned leather."],
  ["Pine Nylon Shopper", "Pine & Pearl", "Tote", "Shopper", "Black", "Nylon", "Casual", "Slouchy", "Black", "Zipper", "Large", "Rectangular", "Lightweight water-resistant nylon shopper."],
  ["Verona Structured Tote", "Casa Verona", "Tote", "Work tote", "Black", "Leather", "Structured", "Structured", "Silver", "Zipper", "Medium", "Rectangular", "Saffiano-textured leather with silver-tone hardware."],
  ["Mori Square Tote", "Atelier Mori", "Tote", null, "Red", "Leather", "Classic", "Boxy", "Gold", "Zipper", "Small", "Square", "Compact square tote in a bold red."],
  ["Larue Carryall Tote", "Maison Larue", "Tote", "Carryall", "Brown", "Suede", "Slouchy", "Slouchy", "Brass", "Open Top", "Large", "Trapezoid", "Suede carryall with an interior pocket."],
  ["Alder Mini Tote", "Alder Row", "Tote", "Mini tote", "White", "Vegan Leather", "Minimalist", "Structured", "Gold", "Magnetic Snap", "Mini", "Rectangular", "Mini tote with a detachable strap."],

  // ---- Shoulder bags ----
  ["Northfield Classic Shoulder Bag", "Northfield & Co", "Shoulder Bag", null, "Black", "Leather", "Classic", "Structured", "Gold", "Zipper", "Medium", "Rectangular", "Timeless shoulder bag with a zip-top closure."],
  ["Pine Baguette Shoulder", "Pine & Pearl", "Shoulder Bag", "Baguette", "Brown", "Leather", "Minimalist", "Rounded", "Gold", "Magnetic Snap", "Small", "Crescent", "Slim baguette that sits under the arm."],
  ["Verona Slouchy Hobo", "Casa Verona", "Shoulder Bag", "Hobo", "Tan", "Leather", "Slouchy", "Slouchy", "Brass", "Zipper", "Medium", "Crescent", "Butter-soft hobo with a zip top."],
  ["Juniper Canvas Shoulder", "Juniper Lane", "Shoulder Bag", null, "Beige", "Canvas", "Casual", "Slouchy", "Silver", "Zipper", "Medium", "Rectangular", "Washed canvas shoulder bag."],
  ["Mori Structured Shoulder", "Atelier Mori", "Shoulder Bag", null, "Black", "Leather", "Structured", "Structured", "Silver", "Zipper", "Medium", "Trapezoid", "Architectural shoulder bag with silver-tone hardware."],
  ["Harbor Nylon Shoulder", "Harbor Goods", "Shoulder Bag", null, "Black", "Nylon", "Casual", "Rounded", "Black", "Zipper", "Small", "Rounded" , "Padded nylon shoulder bag."],
  ["Larue Buckle Shoulder", "Maison Larue", "Shoulder Bag", null, "Brown", "Leather", "Classic", "Structured", "Brass", "Buckle", "Medium", "Rectangular", "Flap shoulder bag with a belt-style buckle."],
  ["Alder Vegan Shoulder", "Alder Row", "Shoulder Bag", null, "Red", "Vegan Leather", "Classic", "Structured", "Gold", "Magnetic Snap", "Small", "Rectangular", "Vegan leather shoulder bag in cherry red."],
  ["Northfield Suede Shoulder", "Northfield & Co", "Shoulder Bag", null, "Tan", "Suede", "Slouchy", "Slouchy", "Gold", "Magnetic Snap", "Medium", "Crescent", "Suede shoulder bag with a gold-tone clasp."],
  ["Pine Mini Shoulder", "Pine & Pearl", "Shoulder Bag", null, "White", "Leather", "Minimalist", "Rounded", "Silver", "Zipper", "Mini", "Rounded", "Mini shoulder bag in smooth white leather."],

  // ---- Crossbody ----
  ["Verona Camera Crossbody", "Casa Verona", "Crossbody", "Camera bag", "Black", "Leather", "Structured", "Boxy", "Gold", "Zipper", "Small", "Rectangular", "Compact camera-style crossbody."],
  ["Juniper Saddle Crossbody", "Juniper Lane", "Crossbody", "Saddle bag", "Tan", "Leather", "Classic", "Rounded", "Brass", "Magnetic Snap", "Small", "Crescent", "Curved flap saddle crossbody."],
  ["Mori Nylon Crossbody", "Atelier Mori", "Crossbody", null, "Black", "Nylon", "Casual", "Slouchy", "Silver", "Zipper", "Mini", "Rectangular", "Travel-friendly nylon crossbody."],
  ["Harbor Canvas Crossbody", "Harbor Goods", "Crossbody", null, "Beige", "Canvas", "Casual", "Slouchy", "Brass", "Buckle", "Small", "Square", "Canvas messenger-style crossbody."],
  ["Larue Envelope Crossbody", "Maison Larue", "Crossbody", "Envelope", "Brown", "Leather", "Minimalist", "Boxy", "Gold", "Magnetic Snap", "Small", "Rectangular", "Slim envelope crossbody."],
  ["Alder Chain Crossbody", "Alder Row", "Crossbody", null, "Red", "Vegan Leather", "Classic", "Structured", "Gold", "Magnetic Snap", "Mini", "Rectangular", "Mini crossbody with a chain strap."],
  ["Northfield Zip Crossbody", "Northfield & Co", "Crossbody", null, "Black", "Leather", "Minimalist", "Rounded", "Silver", "Zipper", "Small", "Rounded", "Round zip-around crossbody."],
  ["Pine Suede Crossbody", "Pine & Pearl", "Crossbody", null, "Brown", "Suede", "Casual", "Slouchy", "Brass", "Drawstring", "Small", null, "Suede pouch crossbody."],

  // ---- Satchels ----
  ["Northfield Doctor Satchel", "Northfield & Co", "Satchel", "Doctor bag", "Brown", "Leather", "Classic", "Structured", "Brass", "Buckle", "Large", "Trapezoid", "Heritage doctor-style satchel."],
  ["Verona Top-Zip Satchel", "Casa Verona", "Satchel", null, "Black", "Leather", "Structured", "Structured", "Gold", "Zipper", "Medium", "Trapezoid", "Structured satchel with a zip-top and gold-tone feet."],
  ["Mori Mini Satchel", "Atelier Mori", "Satchel", "Mini satchel", "Red", "Leather", "Classic", "Structured", "Gold", "Magnetic Snap", "Mini", "Trapezoid", "Mini satchel with a removable strap."],
  ["Juniper Everyday Satchel", "Juniper Lane", "Satchel", null, "Tan", "Leather", "Classic", "Structured", "Brass", "Zipper", "Medium", "Trapezoid", "Everyday satchel in tan leather."],
  ["Larue Vegan Satchel", "Maison Larue", "Satchel", null, "Black", "Vegan Leather", "Structured", "Structured", "Gold", "Zipper", "Medium", "Trapezoid", "Satchel in vegan leather."],
  ["Harbor Canvas Satchel", "Harbor Goods", "Satchel", null, "Beige", "Canvas", "Casual", "Structured", "Brass", "Buckle", "Medium", "Square", "Canvas satchel with leather trim."],

  // ---- Bucket bags ----
  ["Alder Drawstring Bucket", "Alder Row", "Bucket Bag", null, "Brown", "Leather", "Slouchy", "Rounded", "Gold", "Drawstring", "Medium", "Round", "Leather bucket with drawstring top."],
  ["Pine Suede Bucket", "Pine & Pearl", "Bucket Bag", null, "Tan", "Suede", "Slouchy", "Rounded", "Brass", "Drawstring", "Small", "Round", "Soft suede bucket."],
  ["Northfield Mini Bucket", "Northfield & Co", "Bucket Bag", "Mini bucket", "Black", "Leather", "Minimalist", "Rounded", "Silver", "Drawstring", "Mini", "Round", "Mini bucket in black leather."],
  ["Verona Structured Bucket", "Casa Verona", "Bucket Bag", null, "Black", "Leather", "Structured", "Structured", "Gold", "Zipper", "Medium", "Round", "Structured bucket with a zip top."],

  // ---- Top-handle ----
  ["Mori Top-Handle Bag", "Atelier Mori", "Top-Handle", null, "Black", "Leather", "Structured", "Structured", "Gold", "Zipper", "Medium", "Trapezoid", "Top-handle bag with detachable shoulder strap."],
  ["Larue Kelly-Style Top Handle", "Maison Larue", "Top-Handle", null, "Brown", "Leather", "Classic", "Structured", "Gold", "Buckle", "Small", "Trapezoid", "Top-handle flap bag with a turn-lock buckle."],
  ["Juniper Mini Top Handle", "Juniper Lane", "Top-Handle", "Mini", "White", "Leather", "Minimalist", "Boxy", "Silver", "Magnetic Snap", "Mini", "Rectangular", "Mini top-handle."],
  ["Alder Vegan Top Handle", "Alder Row", "Top-Handle", null, "Beige", "Vegan Leather", "Classic", "Structured", "Gold", "Magnetic Snap", "Small", "Trapezoid", "Vegan leather top-handle."],
  ["Harbor Unlabeled Leather Bag", "Harbor Goods", "Tote", null, null, "Leather", null, null, null, "Zipper", null, null, "Listing with limited details (several attributes unconfirmed)."],
  ["Pine Unlabeled Black Bag", "Pine & Pearl", "Shoulder Bag", null, "Black", null, null, "Structured", null, null, "Medium", null, "Listing with limited details (material and closure unconfirmed)."],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;

export const CATALOG: Product[] = ROWS.map((r, i) => ({
  id: uuid(i),
  source: "catalog" as const,
  name: r[0],
  retailer: r[1],
  product_url: `https://example.com/${slug(r[1])}/${slug(r[0])}`,
  image_url: null, // rendered as an illustration by <ProductImage />
  category: r[2],
  subcategory: r[3],
  color: r[4],
  material: r[5],
  style: r[6],
  silhouette: r[7],
  hardware: r[8],
  closure: r[9],
  size: r[10],
  shape: r[11],
  description: r[12],
}));
