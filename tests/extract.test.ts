import { describe, expect, it } from "vitest";
import { extractAttributes, guessName } from "@/lib/extract";

const OCR_SAMPLE = `Maison Larue
Atlas Structured Work Tote
Black leather with gold-tone hardware
Zip-top closure. Size: medium
Sample screenshot`;

describe("screenshot text extraction", () => {
  it("fills only what the text states", () => {
    expect(extractAttributes(OCR_SAMPLE)).toMatchObject({
      category: "Tote", color: "Black", material: "Leather", style: "Structured",
      hardware: "Gold", closure: "Zipper", size: "Medium",
    });
  });
  it("leaves unstated or ambiguous attributes unknown", () => {
    const a = extractAttributes("Lovely bag in black and brown, great for everyday");
    expect(a.color).toBeNull();
    expect(a.material).toBeNull();
    expect(a.closure).toBeNull();
    expect(a.size).toBeNull();
  });
  it("reads an explicit size line", () => {
    expect(extractAttributes("Size: Large").size).toBe("Large");
    expect(extractAttributes("Large capacity organizer").size).toBeNull();
  });
});

describe("guessName", () => {
  it("prefers a title-like line that mentions a bag", () => {
    expect(guessName(OCR_SAMPLE)).toBe("Atlas Structured Work Tote");
  });
  it("skips prices, urls and UI text", () => {
    expect(guessName("$129.00\nAdd to cart\nhttps://x.com/y\nwww.shop.com")).toBe("");
  });
  it("returns empty for noise", () => {
    expect(guessName("||\n~~\nab")).toBe("");
  });
});
