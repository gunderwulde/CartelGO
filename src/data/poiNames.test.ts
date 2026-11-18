import { describe, expect, it } from "vitest";
import { displayName, localizeName } from "./poiNames";
import { nameCode, VENUES, venueOf } from "./poiNameCode";

const KINDS = [
  "warehouse",
  "pharmacy",
  "park",
  "nightlife",
  "police",
  "cover",
] as const;

describe("nombres de lugares", () => {
  it("el código es numérico, estable y depende del tipo de local", () => {
    expect(nameCode("vt/1", "bakery")).toEqual(nameCode("vt/1", "bakery"));
    expect(nameCode("vt/1", "")[0]).toBe(0);
    expect(nameCode("vt/1", "laundry")[0]).toBe(1);
    expect(venueOf("zzz", "bakery")).toBe("bakery");
    expect(venueOf("zzz", "yyy")).toBe("");
  });
  it("hay mucha variedad en todos los tipos", () => {
    for (const kind of KINDS) {
      const nombres = new Set(
        Array.from({ length: 200 }, (_, i) =>
          displayName({ id: `vt/${i}`, kind }),
        ),
      );
      expect(nombres.size).toBeGreaterThan(50);
    }
  });
  it("el nombre depende del tipo de local", () => {
    const bakery = VENUES.indexOf("bakery") + 1;
    const names = Array.from({ length: 30 }, (_, i) =>
      localizeName(nameCode(`vt/${i}`, "bakery"), "cover"),
    );
    expect(bakery).toBeGreaterThan(0);
    expect(names.every((n) => /Panadería|Horno|Pastelería/.test(n))).toBe(true);
  });
  it("prefiere el código al texto y usa el texto antiguo si no hay código", () => {
    expect(displayName({ id: "a", kind: "park", name: "Parque Viejo" })).toBe(
      "Parque Viejo",
    );
    const code = nameCode("a", "pub");
    expect(
      displayName({ id: "a", kind: "nightlife", name: "x", nameId: code }),
    ).toBe(localizeName(code, "nightlife"));
  });
});
