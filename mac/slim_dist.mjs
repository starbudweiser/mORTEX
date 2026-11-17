// mORTEX : allège le paquet macOS avant electron-builder (appelé par mac/package.sh, depuis src/main/dist).
// Ne retire que ce qui ne sert pas à l'exécution sur un Mac ; chaque règle est justifiée ci-dessous.
// Usage : node mac/slim_dist.mjs <src/main/dist>
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2];
if (!dist) throw new Error("usage : slim_dist.mjs <dist>");

// 1. Télémétrie Mixpanel : MixpanelAnalytics.start() retourne dès le début sur macOS
//    (« unofficial build, never report to Nexus Mods »), donc mixpanel-browser n'est jamais
//    initialisé ici. Le renderer l'importe pourtant statiquement : on le remplace par un module vide
//    de même interface (la seule surface utilisée : init, identify, register, unregister, reset,
//    track, get_property) et on retire ses dépendances (@mixpanel/rrweb*, ~26 Mo).
const mixpanelDir = join(dist, "node_modules", "mixpanel-browser");
rmSync(mixpanelDir, { recursive: true, force: true });
rmSync(join(dist, "node_modules", "@mixpanel"), { recursive: true, force: true });
mkdirSync(mixpanelDir, { recursive: true });
writeFileSync(
  join(mixpanelDir, "package.json"),
  JSON.stringify(
    {
      name: "mixpanel-browser",
      version: "0.0.0-mortex-stub",
      description:
        "mORTEX macOS : remplaçant inerte (la télémétrie Mixpanel n'est jamais lancée sur Mac).",
      main: "index.js",
      license: "MIT",
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  join(mixpanelDir, "index.js"),
  `"use strict";
// Remplaçant inerte de mixpanel-browser (voir mac/slim_dist.mjs).
const noop = () => undefined;
module.exports = {
  init: noop,
  identify: noop,
  register: noop,
  unregister: noop,
  reset: noop,
  track: noop,
  get_property: noop,
};
`,
);

// 2. Configuration electron-builder : exclusions et langues.
const configPath = join(dist, "electron-builder.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

const exclusions = [
  // Source maps : en production, seul le processus principal les lit (source-map-support, main.cjs.map,
  // conservé) ; le renderer n'installe source-map-support qu'en développement.
  "!node_modules/**/*.map",
  "!renderer.js.map",
  "!splash.js.map",
  "!bundledPlugins/**/*.map",
  // Types TypeScript et annotations Flow des dépendances : jamais lus à l'exécution.
  "!node_modules/**/*.ts",
  "!node_modules/**/*.d.mts",
  "!node_modules/**/*.d.cts",
  "!node_modules/**/*.flow",
  "!node_modules/**/*.tsbuildinfo",
  // Chaîne de compilation de Tailwind : le CSS est précompilé (assets/css), rien ne la charge à l'exécution.
  "!node_modules/tailwindcss/**",
  "!node_modules/@tailwindcss/**",
  "!node_modules/lightningcss/**",
  "!node_modules/lightningcss-*/**",
  "!node_modules/jiti/**",
  "!node_modules/enhanced-resolve/**",
  "!node_modules/tapable/**",
  "!node_modules/magic-string/**",
  "!node_modules/@jridgewell/**",
  // Outil de build du patch bsdiff : le worker n'a besoin que de hdiff.wasm, copié à côté de main.cjs.
  "!node_modules/@hot-updater/**",
  // QuickBMS : exécutable Windows, jamais lancé nativement sur macOS.
  "!bundledPlugins/quickbms-support/*.exe",
];
config.files = [...new Set([...(config.files ?? ["**/*"]), ...exclusions])];

// Chromium embarque ~660 dossiers de langue (50 Mo) : mORTEX n'est traduit qu'en fr, en, es, it.
config.mac = { ...(config.mac ?? {}), electronLanguages: ["fr", "en", "es", "it"] };

writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log(
  `slim_dist : mixpanel neutralisé, ${exclusions.length} exclusions, langues fr/en/es/it`,
);
