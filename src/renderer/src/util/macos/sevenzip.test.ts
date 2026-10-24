import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import SevenZip from "node-7z";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// mORTEX : 7z-bin n'a pas de binaire darwin ; mac/install_7zz.sh y dépose 7zz (darwin/7z).
describe.skipIf(process.platform !== "darwin")("7zz arm64 (node-7z)", () => {
  let tmp: string;
  const bin: string = require("7z-bin");

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-7z-"));
    fs.mkdirSync(path.join(tmp, "src", "meshes"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src", "meshes", "a.nif"), "mesh");
    for (const ext of ["7z", "zip"]) {
      execFileSync(bin, ["a", path.join(tmp, `t.${ext}`), "meshes"], {
        cwd: path.join(tmp, "src"),
      });
    }
  });

  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("fournit un exécutable arm64", () => {
    expect(path.basename(path.dirname(bin))).toBe("darwin");
    expect(fs.existsSync(bin)).toBe(true);
  });

  it.each(["7z", "zip"])("extrait une archive .%s", async (ext) => {
    const dest = path.join(tmp, `out-${ext}`);
    await new SevenZip().extractFull(path.join(tmp, `t.${ext}`), dest);
    expect(fs.readFileSync(path.join(dest, "meshes", "a.nif"), "utf8")).toBe("mesh");
  });
});
