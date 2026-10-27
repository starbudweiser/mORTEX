// node translations/work/apply.mjs <lotXX.mjs> : fabrique les lots es et it depuis translations/work/es.json
import fs from "node:fs";
import path from "node:path";
const dir = path.dirname(new URL(import.meta.url).pathname);
const map = (await import(path.resolve(process.argv[2]))).default;
const batch = JSON.parse(fs.readFileSync(path.join(dir, "es.json"), "utf8"));
const missing = new Set();
["es", "it"].forEach((lng, i) => {
  const out = {};
  for (const [ns, entries] of Object.entries(batch))
    for (const [key, english] of Object.entries(entries)) {
      const tr = map[english];
      if (tr === undefined) {
        missing.add(english);
        continue;
      }
      (out[ns] ??= {})[key] = tr[i];
    }
  fs.writeFileSync(path.join(dir, `${lng}.done.json`), JSON.stringify(out, null, 2));
});
console.log(missing.size ? "sans traduction : " + [...missing].join(" | ") : "lot complet");
