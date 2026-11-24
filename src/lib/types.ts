export const ATTRIBUTES = [
  "category",
  "color",
  "material",
  "style",
  "silhouette",
  "hardware",
  "closure",
  "size",
] as const;

export type Attribute = (typeof ATTRIBUTES)[number];

export type ProductSource = "catalog" | "serpapi" | "wishlist";

/** Common product shape used by the wishlist, the seeded catalog and live search results. */
export interface Product {
  id?: string;
  source: ProductSource;
  name: string;
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
  catalog_product_id?: string | null;
  /** Position in Google's own result order (0 = first). Used only as a late ranking tie-breaker. */
  rank?: number;
}

export type PreferenceMode = "must" | "prefer" | "ignore";

export interface AttributePreference {
  mode: PreferenceMode;
  /** The value the candidate should have. Defaults to the original product's value. */
  value: string | null;
}

export type Preferences = Record<Attribute, AttributePreference>;

export type CellStatus = "match" | "differ" | "unknown";

export interface ComparisonCell {
  attribute: Attribute;
  mode: PreferenceMode;
  original: string | null;
  candidate: string | null;
  /** Compared against the user's target value (the preference value). */
  status: CellStatus;
  /** True when this attribute is a must-have and the candidate satisfied it. */
  mustSatisfied: boolean;
}

export interface Recommendation {
  product: Product;
  /** 0-100, or null when the user selected no "Prefer" attributes. Unknown attributes earn nothing. */
  score: number | null;
  /** Of only the preferred attributes the listing actually states: the share (0-100) that match. */
  confirmedScore: number | null;
  /** How many of the preferred attributes the listing states (confirmed) and how many of those match. */
  coverage: { total: number; confirmed: number; matches: number };
  matched: Attribute[];
  differences: Attribute[];
  unknown: Attribute[];
  mustSatisfied: Attribute[];
  cells: ComparisonCell[];
  explanation: string;
}

export interface EngineResult {
  recommendations: Recommendation[];
  considered: number;
  excluded: { mustFail: number; unknownRequired: number; sameProduct: number; duplicate: number };
  notice: string | null;
}
