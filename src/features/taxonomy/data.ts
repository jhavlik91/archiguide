// Kanonický zdroj taxonomie profesí (17 kategorií dle
// `zadani/legacy-master-spec.md` §5, resp. `zadani/18-content-taxonomy.md`).
// Jediný zdroj pravdy pro seed (`prisma/seed`), query vrstvu i testy.
//
// Sluggy se odvozují z názvů (viz `buildTaxonomy`), pořadí = pořadí v poli.
// Synonyma / regulated / verificationHints jsou vyplněny tam, kde dávají smysl;
// zbytek profesí je needitovaný „active" bez synonym.

import { slugify, type TaxonomyStatus } from "./match";

export interface SeedProfession {
  name: string;
  /// Volitelné přepsání odvozeného slugu (pro případ kolize / lepší URL).
  slug?: string;
  synonyms?: string[];
  regulated?: boolean;
  verificationHints?: string[];
  status?: TaxonomyStatus;
}

export interface SeedCategory {
  name: string;
  slug?: string;
  professions: SeedProfession[];
}

/// Materializovaná profese s doplněnými výchozími hodnotami a pořadím.
export interface TaxonomyProfession {
  slug: string;
  name: string;
  synonyms: string[];
  regulated: boolean;
  verificationHints: string[];
  status: TaxonomyStatus;
  position: number;
}

/// Materializovaná kategorie i s profesemi.
export interface TaxonomyCategory {
  slug: string;
  name: string;
  position: number;
  professions: TaxonomyProfession[];
}

export const TAXONOMY: SeedCategory[] = [
  {
    name: "Architecture & Design",
    professions: [
      { name: "architekt", synonyms: ["projektant architekt", "autor návrhu"] },
      {
        name: "autorizovaný architekt",
        regulated: true,
        verificationHints: ["Autorizace České komory architektů (ČKA)"],
      },
      { name: "junior architekt" },
      {
        name: "interiérový architekt",
        synonyms: ["interiérista", "návrhář interiérů"],
      },
      { name: "interiérový designér", synonyms: ["bytový designér"] },
      { name: "urbanista", synonyms: ["územní plánování"] },
      { name: "krajinářský architekt", synonyms: ["landscape architekt"] },
      { name: "zahradní architekt", synonyms: ["návrhář zahrad"] },
      { name: "světelný designér", synonyms: ["lighting designer"] },
      { name: "workplace designer" },
      { name: "retail designer" },
      { name: "hospitality designer" },
    ],
  },
  {
    name: "Engineering & Project Design",
    professions: [
      { name: "projektant pozemních staveb", synonyms: ["projektant staveb"] },
      { name: "projektant rodinných domů" },
      { name: "projektant rekonstrukcí" },
      { name: "projektant průmyslových staveb" },
      { name: "projektant dopravních staveb" },
      { name: "projektant vodohospodářských staveb" },
      { name: "koordinátor profesí" },
    ],
  },
  {
    name: "Structures",
    professions: [
      {
        name: "statik",
        synonyms: [
          "statika",
          "statické posouzení",
          "autorizovaný inženýr statika",
        ],
        regulated: true,
        verificationHints: ["Autorizace ČKAIT — statika a dynamika staveb"],
      },
      { name: "konstruktér" },
      {
        name: "specialista železobeton",
        synonyms: ["železobetonové konstrukce"],
      },
      {
        name: "specialista ocelové konstrukce",
        synonyms: ["ocelové konstrukce"],
      },
      { name: "specialista dřevostavby", synonyms: ["dřevěné konstrukce"] },
      { name: "sanace konstrukcí", synonyms: ["sanace betonu"] },
    ],
  },
  {
    name: "Building Services",
    professions: [
      { name: "vytápění", synonyms: ["topení", "ÚT"] },
      { name: "vzduchotechnika", synonyms: ["VZT"] },
      { name: "rekuperace" },
      { name: "klimatizace", synonyms: ["chlazení"] },
      { name: "zdravotechnika", synonyms: ["ZTI", "voda a kanalizace"] },
      { name: "kanalizace" },
      { name: "elektro", synonyms: ["elektroinstalace"] },
      { name: "silnoproud" },
      { name: "slaboproud" },
      { name: "fotovoltaika", synonyms: ["FVE", "solární panely"] },
      {
        name: "bateriová úložiště",
        synonyms: ["baterie", "akumulace energie"],
      },
      { name: "chytré domy", synonyms: ["smart home", "chytrá domácnost"] },
      { name: "MaR", synonyms: ["měření a regulace"] },
      { name: "BMS", synonyms: ["building management system"] },
    ],
  },
  {
    name: "Energy & Sustainability",
    professions: [
      {
        name: "energetický specialista",
        synonyms: ["energetický průkaz", "PENB zpracovatel"],
        regulated: true,
        verificationHints: ["Zápis v seznamu energetických specialistů (MPO)"],
      },
      { name: "PENB", synonyms: ["průkaz energetické náročnosti budovy"] },
      {
        name: "energetický auditor",
        synonyms: ["energetický audit"],
        regulated: true,
        verificationHints: [
          "Zápis v seznamu energetických specialistů (MPO) — energetický audit",
        ],
      },
      {
        name: "dotační poradenství",
        synonyms: ["Nová zelená úsporám", "dotace"],
      },
      {
        name: "pasivní domy",
        synonyms: ["pasivní dům", "nízkoenergetické domy"],
      },
      { name: "environmentální certifikace", synonyms: ["LEED", "BREEAM"] },
    ],
  },
  {
    name: "Survey & Diagnostics",
    professions: [
      {
        name: "geodet",
        synonyms: ["zeměměřič", "geodézie", "vytyčení"],
        regulated: true,
        verificationHints: [
          "Úřední oprávnění pro ověřování výsledků zeměměřických činností (ČÚZK)",
        ],
      },
      { name: "geolog", synonyms: ["inženýrská geologie"] },
      { name: "hydrogeolog", synonyms: ["hydrogeologie", "studny"] },
      {
        name: "radonový specialista",
        synonyms: ["měření radonu"],
        regulated: true,
        verificationHints: ["Povolení SÚJB pro měření radonu"],
      },
      { name: "termografie", synonyms: ["termovize", "termokamera"] },
      { name: "akustik", synonyms: ["akustika", "měření hluku"] },
      { name: "diagnostik staveb", synonyms: ["stavební diagnostika"] },
      { name: "specialista vlhkosti", synonyms: ["vlhkost zdiva"] },
    ],
  },
  {
    name: "BIM & Digital",
    professions: [
      { name: "BIM manager", synonyms: ["BIM manažer"] },
      { name: "BIM koordinátor" },
      { name: "BIM modeler", synonyms: ["BIM modelář"] },
      { name: "Revit specialista", synonyms: ["Revit"] },
      { name: "Archicad specialista", synonyms: ["Archicad"] },
      { name: "CDE specialista", synonyms: ["common data environment"] },
      { name: "digitální koordinátor" },
    ],
  },
  {
    name: "Visualisation & Media",
    professions: [
      { name: "3D vizualizátor", synonyms: ["vizualizace", "3D vizualizace"] },
      { name: "3D modelář", synonyms: ["3D modelování"] },
      { name: "animátor", synonyms: ["3D animace"] },
      {
        name: "fotograf architektury",
        synonyms: ["architektonická fotografie"],
      },
      { name: "dronový operátor", synonyms: ["dron", "letecké snímky"] },
      { name: "virtuální staging", synonyms: ["home staging"] },
    ],
  },
  {
    name: "Cost & Procurement",
    professions: [
      {
        name: "rozpočtář",
        synonyms: ["rozpočet", "rozpočtování", "výkaz výměr"],
      },
      { name: "cost manager", synonyms: ["cost management"] },
      { name: "quantity surveyor" },
      { name: "přípravář", synonyms: ["příprava staveb"] },
      {
        name: "procurement specialista",
        synonyms: ["nákup", "výběrová řízení"],
      },
    ],
  },
  {
    name: "Permits & Legal",
    professions: [
      { name: "inženýring", synonyms: ["inženýrská činnost", "IČ"] },
      { name: "specialista povolování", synonyms: ["stavební povolení"] },
      { name: "stavební právo", synonyms: ["právník staveb"] },
      { name: "koordinace stanovisek", synonyms: ["dotčené orgány"] },
      { name: "permit manager" },
    ],
  },
  {
    name: "Construction Management",
    professions: [
      {
        name: "projektový manažer",
        synonyms: ["project manager", "projekťák"],
      },
      { name: "construction manager" },
      { name: "stavbyvedoucí" },
      {
        name: "technický dozor investora",
        synonyms: ["TDI", "technický dozor stavebníka"],
      },
      { name: "stavební dozor" },
      {
        name: "koordinátor BOZP",
        synonyms: ["BOZP", "koordinátor bezpečnosti"],
        regulated: true,
        verificationHints: ["Osvědčení koordinátora BOZP na staveništi"],
      },
    ],
  },
  {
    name: "Construction Companies",
    professions: [
      { name: "generální dodavatel", synonyms: ["GD", "generální zhotovitel"] },
      { name: "firma na rodinné domy", synonyms: ["stavba rodinného domu"] },
      { name: "rekonstrukční firma", synonyms: ["rekonstrukce"] },
      { name: "dřevostavby", synonyms: ["dřevostavba", "montované domy"] },
      { name: "průmyslové stavby" },
      { name: "zemní práce", synonyms: ["výkopové práce", "bagr"] },
    ],
  },
  {
    name: "Trades",
    professions: [
      {
        name: "elektrikář",
        synonyms: ["elektroinstalatér", "elektrikářské práce"],
      },
      {
        name: "instalatér",
        synonyms: ["vodoinstalatér", "voda a topení", "vodař"],
      },
      { name: "topenář", synonyms: ["topení", "topenářství"] },
      { name: "zedník", synonyms: ["zednické práce", "zednictví"] },
      { name: "obkladač", synonyms: ["obklady a dlažby", "dlaždič"] },
      { name: "malíř", synonyms: ["malování", "malíř a natěrač"] },
      {
        name: "sádrokartonář",
        synonyms: ["sádrokarton", "montáž sádrokartonu"],
      },
      { name: "podlahář", synonyms: ["pokládka podlah", "podlahářství"] },
      { name: "truhlář", synonyms: ["truhlářské práce"] },
      { name: "tesař", synonyms: ["tesařské práce", "krovy"] },
      { name: "pokrývač", synonyms: ["pokrývačství", "střechy"] },
      { name: "klempíř", synonyms: ["klempířství", "klempířské práce"] },
      { name: "fasádník", synonyms: ["zateplení fasád", "fasádnické práce"] },
      { name: "izolatér", synonyms: ["izolace", "hydroizolace"] },
      { name: "zámečník", synonyms: ["zámečnictví", "kovovýroba"] },
      { name: "sklenář", synonyms: ["sklenářství", "zasklívání"] },
    ],
  },
  {
    name: "Interior Execution",
    professions: [
      { name: "kuchyňské studio", synonyms: ["kuchyně na míru"] },
      { name: "zakázkový nábytek", synonyms: ["nábytek na míru"] },
      { name: "truhlářství", synonyms: ["truhlárna"] },
      { name: "podlahy", synonyms: ["podlahové krytiny"] },
      { name: "osvětlení", synonyms: ["svítidla"] },
      { name: "akustické prvky", synonyms: ["akustické panely"] },
      { name: "čalounictví", synonyms: ["čalouník"] },
    ],
  },
  {
    name: "Exterior",
    professions: [
      {
        name: "zahradní realizace",
        synonyms: ["realizace zahrad", "zahradník"],
      },
      { name: "pergoly", synonyms: ["pergola"] },
      { name: "terasy", synonyms: ["terasa"] },
      { name: "bazény", synonyms: ["bazén"] },
      { name: "jezírka", synonyms: ["jezírko", "koupací jezírko"] },
      { name: "oplocení", synonyms: ["plot", "ploty"] },
      { name: "závlahy", synonyms: ["zavlažování"] },
      { name: "venkovní osvětlení", synonyms: ["zahradní osvětlení"] },
    ],
  },
  {
    name: "Real Estate & Property",
    professions: [
      {
        name: "inspektor nemovitostí",
        synonyms: ["technická inspekce nemovitosti"],
      },
      { name: "odhadce", synonyms: ["oceňování nemovitostí", "znalec"] },
      { name: "property manager", synonyms: ["správa nemovitostí"] },
      { name: "facility manager", synonyms: ["správa budov"] },
      {
        name: "technický poradce při koupi",
        synonyms: ["poradce při koupi nemovitosti"],
      },
    ],
  },
  {
    name: "Supply",
    professions: [
      { name: "výrobce", synonyms: ["dodavatel"] },
      { name: "distributor", synonyms: ["velkoobchod"] },
      { name: "materiály", synonyms: ["stavební materiál"] },
      { name: "stavební systémy" },
      { name: "technické produkty" },
      { name: "nábytek" },
      { name: "světla", synonyms: ["svítidla"] },
    ],
  },
];

/// Doplní odvozené slugy, pořadí a výchozí hodnoty. Výstup je stabilní zdroj
/// pro seed i pro testy vyhledávání (bez připojení k DB).
export function buildTaxonomy(
  source: SeedCategory[] = TAXONOMY,
): TaxonomyCategory[] {
  return source.map((category, categoryIndex) => ({
    slug: category.slug ?? slugify(category.name),
    name: category.name,
    position: categoryIndex,
    professions: category.professions.map((profession, professionIndex) => ({
      slug: profession.slug ?? slugify(profession.name),
      name: profession.name,
      synonyms: profession.synonyms ?? [],
      regulated: profession.regulated ?? false,
      verificationHints: profession.verificationHints ?? [],
      status: profession.status ?? "active",
      position: professionIndex,
    })),
  }));
}
