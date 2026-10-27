#!/usr/bin/env node
/**
 * mORTEX : traductions propres à mORTEX (packs « <Langue> translation for mORTEX »), faites par lots.
 *
 *   node scripts/translations.mjs inventory <dossier d'un pack> <code compilé>…
 *       recense les textes anglais encore utilisés par le code compilé → translations/inventory.json
 *   node scripts/translations.mjs add <fichier>
 *       ajoute des textes relevés dans l'appli (clés manquantes) à l'inventaire
 *   node scripts/translations.mjs status
 *       avancement par langue
 *   node scripts/translations.mjs next <langue> [nombre]
 *       prochain lot à traduire (textes les plus courts, donc les plus visibles, d'abord)
 *       → translations/work/<langue>.json : { "<ns>": { "<clé>": "<anglais>" } }
 *   node scripts/translations.mjs merge <langue> <fichier>
 *       vérifie variables et balises, puis range le lot dans locales/<langue>/<ns>.json
 *   node scripts/translations.mjs pack <langue>
 *       construit dist/translations/<Langue> translation for mORTEX/ (info.json + fichiers)
 *
 * Les clés imbriquées utilisent « :: », comme i18next (keySeparator) dans mORTEX.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = path.join(ROOT, "locales");
const INVENTORY = path.join(ROOT, "translations", "inventory.json");
const WORK = path.join(ROOT, "translations", "work");
const SEP = "::";

const LANGUAGES = {
  es: { name: "Spanish", native: "Español" },
  it: { name: "Italian", native: "Italiano" },
  fr: { name: "French", native: "Français" },
};

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
};

/** { "a::b": "texte" } depuis un objet imbriqué */
const flatten = (obj, prefix = "") =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    if (typeof value === "string") acc[prefix + key] = value;
    else if (value && typeof value === "object")
      Object.assign(acc, flatten(value, prefix + key + SEP));
    return acc;
  }, {});

const setNested = (obj, key, value) => {
  const parts = key.split(SEP);
  let node = obj;
  for (const part of parts.slice(0, -1)) node = node[part] ??= {};
  node[parts.at(-1)] = value;
};

/** variables {{x}} et balises <x></x> d'un texte, pour vérifier qu'une traduction les garde */
export const markers = (text) =>
  (text.match(/\{\{\s*[\w.]+\s*\}\}|<\/?[\w-]+\s*\/?>|\[\/?\w+(=[^\]]*)?\]/g) ?? [])
    .map((m) => m.replace(/\s/g, ""))
    .sort();

function inventory(packDir, codePaths) {
  let code = "";
  const walk = (p) => {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(p))
        if (entry !== "node_modules") walk(path.join(p, entry));
    } else if (/\.c?js$/.test(p)) code += fs.readFileSync(p, "utf8");
  };
  codePaths.forEach(walk);
  code += code
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\u2026/g, "…");

  const result = {};
  const unresolved = [];
  const add = (ns, key, english) => {
    (result[ns] ??= {})[key] = english;
  };
  for (const file of fs.readdirSync(packDir).filter((f) => f.endsWith(".json"))) {
    const ns = file.replace(/\.json$/, "");
    const pack = readJson(path.join(packDir, file));
    if (pack === undefined) continue;
    const english = flatten(readJson(path.join(LOCALES, "en", file), {}));
    for (const key of Object.keys(flatten(pack))) {
      const base = key.replace(/_plural$/, "");
      if (!code.includes(base) && !code.includes(base.split(SEP).at(-1))) continue;
      if (english[key] !== undefined) add(ns, key, english[key]);
      else if (!key.includes(SEP)) add(ns, key, key.replace(/_plural$/, ""));
      else unresolved.push(`${ns}:${key}`);
    }
  }
  // les textes de mORTEX lui-même (locales/en)
  for (const file of fs.readdirSync(path.join(LOCALES, "en"))) {
    const ns = file.replace(/\.json$/, "");
    for (const [key, value] of Object.entries(
      flatten(readJson(path.join(LOCALES, "en", file), {})),
    )) {
      if (!key.endsWith("_comment")) add(ns, key, value);
    }
  }
  writeJson(INVENTORY, result);
  const count = Object.values(result).reduce((n, ns) => n + Object.keys(ns).length, 0);
  console.log(`${count} textes inventoriés ; ${unresolved.length} sans source anglaise, ignorés`);
}

/** ajoute à l'inventaire des textes relevés ailleurs, { "<ns>": { "<clé>": "<anglais>" } } */
function add(file) {
  const inv = readJson(INVENTORY, {});
  let added = 0;
  for (const [ns, entries] of Object.entries(readJson(file, {}))) {
    for (const [key, english] of Object.entries(entries)) {
      if (inv[ns]?.[key] === undefined) {
        (inv[ns] ??= {})[key] = english;
        added++;
      }
    }
  }
  writeJson(INVENTORY, inv);
  console.log(`${added} textes ajoutés à l'inventaire`);
}

const done = (lng, ns) => flatten(readJson(path.join(LOCALES, lng, `${ns}.json`), {}));

function pending(lng) {
  const inv = readJson(INVENTORY, {});
  const out = [];
  for (const [ns, keys] of Object.entries(inv)) {
    const have = done(lng, ns);
    for (const [key, english] of Object.entries(keys)) {
      if (have[key] === undefined) out.push({ ns, key, english });
    }
  }
  return out;
}

/** avancement de nos packs, publié pour les réglages de langue (locales/progress.json) */
function status() {
  const inv = readJson(INVENTORY, {});
  const total = Object.values(inv).reduce((n, ns) => n + Object.keys(ns).length, 0);
  const progress = {};
  for (const lng of Object.keys(LANGUAGES)) {
    const left = pending(lng).length;
    const percent = Math.floor(((total - left) / total) * 100);
    console.log(`${lng} : ${total - left}/${total} (${percent} %)`);
    // le français vit du pack communautaire : pas d'avancement affiché
    if (lng !== "fr") progress[lng] = percent;
  }
  writeJson(path.join(LOCALES, "progress.json"), progress);
}

function next(lng, count = 400) {
  const batch = pending(lng)
    .sort((a, b) => a.english.length - b.english.length)
    .slice(0, Number(count));
  const out = {};
  for (const { ns, key, english } of batch) (out[ns] ??= {})[key] = english;
  const file = path.join(WORK, `${lng}.json`);
  writeJson(file, out);
  console.log(`${batch.length} textes → ${path.relative(ROOT, file)}`);
}

function merge(lng, file) {
  const inv = readJson(INVENTORY, {});
  const batch = readJson(file);
  const problems = [];
  let merged = 0;
  for (const [ns, entries] of Object.entries(batch)) {
    const target = path.join(LOCALES, lng, `${ns}.json`);
    const data = readJson(target, {});
    for (const [key, translated] of Object.entries(entries)) {
      const english = inv[ns]?.[key];
      if (english === undefined) {
        problems.push(`hors inventaire ${ns}:${key}`);
        continue;
      }
      if (markers(english).join() !== markers(translated).join()) {
        problems.push(`variables ${ns}:${key}`);
        continue;
      }
      setNested(data, key, translated);
      merged++;
    }
    writeJson(target, data);
  }
  console.log(`${merged} textes rangés dans locales/${lng}`);
  status();
  if (problems.length > 0) {
    console.log(problems.join("\n"));
    process.exitCode = 1;
  }
}

function pack(lng) {
  const language = LANGUAGES[lng];
  const name = `${language.name} translation for mORTEX`;
  const dir = path.join(ROOT, "dist", "translations", name);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const file of fs.readdirSync(path.join(LOCALES, lng))) {
    fs.mkdirSync(path.join(dir, lng), { recursive: true });
    fs.copyFileSync(path.join(LOCALES, lng, file), path.join(dir, lng, file));
  }
  writeJson(path.join(dir, "info.json"), {
    name,
    author: "mORTEX",
    version: readJson(path.join(ROOT, "package.json"), {}).version ?? "1.0.0",
    description: `${language.native} — ${name}`,
    type: "translation",
  });
  console.log(path.relative(ROOT, dir));
}

const [command, ...args] = process.argv.slice(2);
const commands = {
  inventory: () => inventory(args[0], args.slice(1)),
  add: () => add(args[0]),
  status,
  next: () => next(...args),
  merge: () => merge(...args),
  pack: () => pack(...args),
};
if (commands[command] === undefined) {
  console.log(
    "usage : inventory | add <fichier> | status | next <langue> [nombre] | merge <langue> <fichier> | pack <langue>",
  );
  process.exitCode = 1;
} else {
  commands[command]();
}
