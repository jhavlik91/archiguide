import { describe, expect, it } from "vitest";
import { detectPrivacyWarnings } from "./privacy";

/**
 * Detekce osobních údajů před sdílením (T022, zadani/12 §8). Heuristika smí
 * falešně varovat (jen upozorňuje, neblokuje), ale nesmí propásnout typický
 * případ vepsané adresy / telefonu / e-mailu.
 */

describe("detectPrivacyWarnings", () => {
  it("nic necitlivého → žádné varování", () => {
    expect(
      detectPrivacyWarnings([
        "Rekonstrukce bytu v Praze, rozpočet do 2 000 000 Kč.",
        "Rozsah 120 m2, termín do jara.",
      ]),
    ).toEqual([]);
  });

  it("zachytí e-mail", () => {
    expect(
      detectPrivacyWarnings(["Ozvěte se na jan.novak@example.com"]),
    ).toContain("email");
  });

  it("zachytí telefonní číslo (i s předvolbou a mezerami)", () => {
    expect(detectPrivacyWarnings(["Tel: +420 777 123 456"])).toContain("phone");
    expect(detectPrivacyWarnings(["volejte 608123456"])).toContain("phone");
  });

  it("zachytí přesnou adresu (PSČ i číslo popisné)", () => {
    expect(detectPrivacyWarnings(["Dlouhá 12/3, 110 00 Praha"])).toContain(
      "address",
    );
    expect(detectPrivacyWarnings(["bydlím v ulici Krátká 5"])).toContain(
      "address",
    );
  });

  it("částka ani rozměr se nepletou s telefonem/adresou", () => {
    expect(detectPrivacyWarnings(["rozpočet 1500000 Kč"])).not.toContain(
      "phone",
    );
    expect(detectPrivacyWarnings(["plocha 120 m2"])).not.toContain("address");
  });

  it("vrací kategorie ve stabilním pořadí (address, phone, email)", () => {
    expect(
      detectPrivacyWarnings(["Krátká 5, 110 00, tel 777123456, mail a@b.cz"]),
    ).toEqual(["address", "phone", "email"]);
  });

  it("ignoruje prázdné/null útržky", () => {
    expect(detectPrivacyWarnings([null, undefined, ""])).toEqual([]);
  });
});
