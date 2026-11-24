/**
 * Deterministic text → attribute rules. Shared by live-search normalisation and the
 * screenshot reader (OCR). An attribute is only returned when exactly one distinct value
 * is explicitly stated; ambiguous or missing text stays null (unknown). Client-safe.
 */
type Rule = [RegExp, string];

const CATEGORY: Rule[] = [
  [/\btotes?\b/i, "Tote"],
  [/\bshoulder\s+bags?\b/i, "Shoulder Bag"],
  [/\bcross[\s-]?body\b/i, "Crossbody"],
  [/\bsatchels?\b/i, "Satchel"],
  [/\bbucket\s+bags?\b/i, "Bucket Bag"],
  [/\btop[\s-]?handle\b/i, "Top-Handle"],
];
const COLOR: Rule[] = [
  [/\b(black|jet black|onyx)\b/i, "Black"],
  [/\bbrown\b/i, "Brown"],
  [/\btan\b/i, "Tan"],
  [/\bwhite\b/i, "White"],
  [/\bbeige\b/i, "Beige"],
  [/\bred\b/i, "Red"],
];
const MATERIAL: Rule[] = [
  [/\b(vegan|faux|pu)[\s-]leather\b/i, "Vegan Leather"],
  // Plain "leather" must not fire on "vegan/faux/PU leather".
  [/(?<!\b(?:vegan|faux|pu)[\s-])\bleather\b/i, "Leather"],
  [/\bsuede\b/i, "Suede"],
  [/\bcanvas\b/i, "Canvas"],
  [/\bnylon\b/i, "Nylon"],
];
const STYLE: Rule[] = [
  [/\bstructured\b/i, "Structured"],
  [/\bslouch(y)?\b/i, "Slouchy"],
  [/\bminimal(ist)?\b/i, "Minimalist"],
  [/\bclassic\b/i, "Classic"],
  [/\bcasual\b/i, "Casual"],
];
const SILHOUETTE: Rule[] = [
  [/\bstructured\b/i, "Structured"],
  [/\bslouch(y)?\b/i, "Slouchy"],
  [/\bboxy\b/i, "Boxy"],
  [/\brounded\b/i, "Rounded"],
  [/\btrapezoid\b/i, "Trapezoid"],
];
const HARDWARE: Rule[] = [
  [/\bgold[\s-]?(tone\b|hardware\b)/i, "Gold"],
  [/\bsilver[\s-]?(tone\b|hardware\b)/i, "Silver"],
  [/\bbrass\s+hardware\b/i, "Brass"],
  [/\bblack\s+hardware\b/i, "Black"],
];
const CLOSURE: Rule[] = [
  [/\bzip(per|-top|\s+top|\s+closure)?\b/i, "Zipper"],
  [/\bmagnetic\b/i, "Magnetic Snap"],
  [/\bbuckle\b/i, "Buckle"],
  [/\bopen[\s-]top\b/i, "Open Top"],
  [/\bdrawstring\b/i, "Drawstring"],
];

/** Returns a value only when exactly one distinct value is explicitly supported by the text. */
function detect(text: string, rules: Rule[]): string | null {
  const found = new Set<string>();
  for (const [re, value] of rules) if (re.test(text)) found.add(value);
  return found.size === 1 ? [...found][0] : null;
}

/** Size words only count when they plainly describe the bag ("medium leather tote", "size: large"). */
function detectSize(text: string): string | null {
  const found = new Set<string>();
  const re =
    /\b(mini|small|medium|large)\b(?:\W+\w+){0,2}?\W+(?:bag|tote|handbag|satchel|crossbody|purse)\b|\b(mini|small|medium|large)\s+size\b|\bsize\W{0,3}(mini|small|medium|large)\b/gi;
  for (const m of text.matchAll(re)) {
    const word = (m[1] ?? m[2] ?? m[3]).toLowerCase();
    found.add(word[0].toUpperCase() + word.slice(1));
  }
  return found.size === 1 ? [...found][0] : null;
}

export function extractAttributes(text: string) {
  return {
    category: detect(text, CATEGORY),
    color: detect(text, COLOR),
    material: detect(text, MATERIAL),
    style: detect(text, STYLE),
    silhouette: detect(text, SILHOUETTE),
    hardware: detect(text, HARDWARE),
    closure: detect(text, CLOSURE),
    size: detectSize(text),
  };
}

const BAG_WORD = /\b(bag|tote|satchel|crossbody|hobo|bucket|shoulder|handbag|purse|clutch|backpack)\b/i;

/**
 * Best-effort product name from OCR lines: a short, mostly-alphabetic line that mentions a bag word,
 * otherwise the first plausible title-like line. Returns "" when nothing looks like a title.
 */
export function guessName(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[|_~=]+/g, " ").replace(/\s+/g, " ").trim())
    .filter((l) => {
      if (l.length < 6 || l.length > 80) return false;
      if (l.split(" ").length < 2) return false;
      if (/[$€£]|\d{2,}|https?:|www\.|add to|cart|checkout|sign in|menu/i.test(l)) return false;
      const letters = (l.match(/[a-z]/gi) ?? []).length;
      return letters / l.length > 0.7;
    });
  return lines.find((l) => BAG_WORD.test(l)) ?? lines[0] ?? "";
}
