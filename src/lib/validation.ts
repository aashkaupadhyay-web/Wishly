import { z } from "zod";
import { ATTRIBUTES } from "./types";

/**
 * Only http(s) URLs are accepted, and hosts that point at local/private networks are rejected.
 * The app never fetches user-supplied URLs server-side, so this is defence in depth
 * (it also prevents javascript:/data: links from being rendered as hrefs).
 */
export function isSafeHttpUrl(value: string): boolean {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal"))
    return false;
  if (host.includes(":")) return false; // any IPv6 literal
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  } else if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) {
    return false; // decimal / hex encoded IPs
  }
  return true;
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isSafeHttpUrl(v), "Must be a valid http(s) URL");

/** Image: http(s) URL or a small retained screenshot encoded as a data URL. */
const optImage = z
  .string()
  .trim()
  .max(400_000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine(
    (v) => v === null || isSafeHttpUrl(v) || /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(v),
    "Image must be an http(s) URL or an uploaded image",
  );

export const productInputSchema = z.object({
  product_name: z.string().trim().min(1, "Product name is required").max(200),
  retailer: optText(120),
  product_url: optUrl,
  image_url: optImage,
  category: optText(60),
  subcategory: optText(60),
  color: optText(40),
  material: optText(40),
  style: optText(40),
  silhouette: optText(40),
  hardware: optText(40),
  closure: optText(40),
  size: optText(40),
  shape: optText(40),
  description: optText(1000),
  catalog_product_id: z.string().uuid().optional().nullable(),
});

export type ProductInput = z.infer<typeof productInputSchema>;

const prefSchema = z.object({
  mode: z.enum(["must", "prefer", "ignore"]),
  value: z.string().trim().max(60).nullable(),
});

export const recommendRequestSchema = z.object({
  wishlistItemId: z.string().uuid(),
  includeLive: z.boolean().default(false),
  preferences: z.object(
    Object.fromEntries(ATTRIBUTES.map((a) => [a, prefSchema])) as Record<(typeof ATTRIBUTES)[number], typeof prefSchema>,
  ),
});
