import type { Product } from "@/lib/types";

const COLORS: Record<string, string> = {
  black: "#2a2623", brown: "#6b4226", tan: "#c49a6c", white: "#f6f3ec", beige: "#d9c7a7", red: "#a8231f",
};
const HARDWARE: Record<string, string> = { gold: "#c9a227", silver: "#b8bcc2", brass: "#b5893a", black: "#111" };

type Img = Pick<Product, "image_url" | "category" | "color" | "hardware" | "name">;

/** Real image when we have one; otherwise a small illustration drawn from the product's own attributes. */
export function ProductImage({ product, className = "" }: { product: Img; className?: string }) {
  if (product.image_url) {
    return (
      <img
        src={product.image_url}
        alt={product.name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  const fill = COLORS[(product.color ?? "").toLowerCase()] ?? "#b9b2a6";
  const metal = HARDWARE[(product.hardware ?? "").toLowerCase()] ?? "#9d968a";
  const cat = (product.category ?? "").toLowerCase();
  const stroke = "rgba(0,0,0,.18)";

  let body: React.ReactNode;
  let handle: React.ReactNode;
  switch (cat) {
    case "crossbody":
      body = <rect x="62" y="84" width="76" height="56" rx="10" fill={fill} stroke={stroke} />;
      handle = <path d="M70 84 C 50 20, 150 20, 130 84" fill="none" stroke={fill} strokeWidth="5" strokeLinecap="round" />;
      break;
    case "bucket bag":
      body = <path d="M52 82 H148 L138 150 Q100 162 62 150 Z" fill={fill} stroke={stroke} />;
      handle = <path d="M72 82 C 72 40, 128 40, 128 82" fill="none" stroke={fill} strokeWidth="6" strokeLinecap="round" />;
      break;
    case "satchel":
      body = (
        <g>
          <rect x="44" y="76" width="112" height="72" rx="8" fill={fill} stroke={stroke} />
          <path d="M44 84 H156 L146 112 H54 Z" fill="rgba(0,0,0,.12)" />
        </g>
      );
      handle = <path d="M74 76 C 74 44, 126 44, 126 76" fill="none" stroke={fill} strokeWidth="6" strokeLinecap="round" />;
      break;
    case "shoulder bag":
      body = <path d="M46 92 Q100 70 154 92 L148 146 Q100 158 52 146 Z" fill={fill} stroke={stroke} />;
      handle = <path d="M60 90 C 40 30, 70 24, 74 44 M140 90 C 160 30, 130 24, 126 44" fill="none" stroke={fill} strokeWidth="5" strokeLinecap="round" />;
      break;
    case "top-handle":
      body = <rect x="52" y="86" width="96" height="60" rx="9" fill={fill} stroke={stroke} />;
      handle = <path d="M78 86 V66 Q100 46 122 66 V86" fill="none" stroke={fill} strokeWidth="6" strokeLinecap="round" />;
      break;
    default: // tote
      body = <path d="M44 84 H156 L146 150 H54 Z" fill={fill} stroke={stroke} />;
      handle = <path d="M70 84 C 70 36, 130 36, 130 84" fill="none" stroke={fill} strokeWidth="6" strokeLinecap="round" />;
  }

  return (
    <svg viewBox="0 0 200 180" role="img" aria-label={`${product.name} (illustration)`} className={`h-full w-full bg-sand ${className}`}>
      <ellipse cx="100" cy="160" rx="62" ry="6" fill="rgba(0,0,0,.08)" />
      {handle}
      {body}
      <circle cx="100" cy="96" r="4" fill={metal} />
    </svg>
  );
}
