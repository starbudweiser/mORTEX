import * as fs from "fs";
import * as path from "path";

import { describe, expect, it } from "vitest";

import { SKYRIMSE_CATALOG } from "./catalog/skyrimse";

const LANGS = ["fr", "en", "es", "it"] as const;
const TABS = [
  "display",
  "shadows",
  "distance",
  "grassLod",
  "waterFx",
  "interface",
  "game",
  "camera",
  "audio",
];

// les tests tournent depuis src/renderer
const localesDir = path.resolve(process.cwd(), "../../locales");
const load = (lang: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(localesDir, lang, "settings_editor.json"), "utf8"));

const texts = Object.fromEntries(LANGS.map((lang) => [lang, load(lang)])) as Record<
  (typeof LANGS)[number],
  Record<string, string>
>;

/** toutes les clés de texte que le catalogue exige */
function expectedKeys(): string[] {
  const keys = TABS.map((tab) => `tab.${tab}`);
  for (const s of SKYRIMSE_CATALOG) {
    keys.push(`label.${s.id}`, `help.${s.id}`);
    if (s.macNote) keys.push(`macNote.${s.id}`);
    for (const option of s.options ?? []) {
      if (option.label === undefined) keys.push(`options.${s.id}.${option.value}`);
    }
  }
  return keys;
}

describe("textes de l'Éditeur de réglages", () => {
  it("has the same keys in the four languages, and exactly the keys the catalog needs", () => {
    const expected = expectedKeys().sort();
    for (const lang of LANGS) {
      expect(Object.keys(texts[lang]).sort(), lang).toEqual(expected);
    }
  });

  it("has no empty text", () => {
    for (const lang of LANGS) {
      const empty = Object.entries(texts[lang])
        .filter(([, value]) => value.trim() === "")
        .map(([key]) => key);
      expect(empty, lang).toEqual([]);
    }
  });

  it("translates the helps instead of copying the French", () => {
    const same = Object.keys(texts.fr).filter(
      (key) =>
        key.startsWith("help.") &&
        (texts.fr[key] === texts.en[key] ||
          texts.fr[key] === texts.es[key] ||
          texts.fr[key] === texts.it[key]),
    );
    expect(same).toEqual([]);
  });

  it("keeps helps to a short sentence or two", () => {
    for (const lang of LANGS) {
      const long = Object.entries(texts[lang])
        .filter(([key, value]) => /^(help|macNote)\./.test(key) && value.length > 190)
        .map(([key]) => key);
      expect(long, lang).toEqual([]);
    }
  });

  it("keeps the same placeholders in every language", () => {
    const braces = (value: string) =>
      value
        .match(/\{\{\w+\}\}/g)
        ?.sort()
        .join() ?? "";
    for (const key of Object.keys(texts.fr)) {
      for (const lang of ["en", "es", "it"] as const) {
        expect(braces(texts[lang][key]), `${lang} ${key}`).toBe(braces(texts.fr[key]));
      }
    }
  });
});
