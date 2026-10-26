import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { extractWithUnar, needsUnarFallback, unarPath } from "./unarFallback";

describe("needsUnarFallback", () => {
  it("retries with unar when 7-Zip lacks the compression method, on macOS", () => {
    const errors = ["ERROR: Unsupported Method : meshes/a.nif"];
    expect(needsUnarFallback(errors, "darwin")).toBe(true);
    expect(needsUnarFallback(errors, "win32")).toBe(false);
  });

  it("leaves other extraction errors to the usual handling", () => {
    expect(needsUnarFallback(["ERROR: Data Error : a.nif"], "darwin")).toBe(false);
  });
});

// Archives WinRAR 7 réelles (dossier de téléchargements de l'utilisateur, non versionnées) :
// 7-Zip échoue dessus, unar doit les extraire.
const DOWNLOADS = "/Volumes/LaCie 6To/VORTEX/skyrimse";
const RAR7 = [
  ".1130 _ResourcePack Fixes-117234-1-11-1715022545.rar",
  "_Fuse00_ArmorHelga_CBBE.rar",
].map((name) => path.join(DOWNLOADS, name));

describe.skipIf(process.platform !== "darwin" || !RAR7.every((p) => fs.existsSync(p)))(
  "WinRAR 7 archives",
  () => {
    let tmp: string | undefined;
    afterEach(() => {
      if (tmp !== undefined) fs.rmSync(tmp, { recursive: true, force: true });
    });

    it.each(RAR7)(
      "7-Zip refuses %s, unar extracts it",
      async (archive) => {
        const sevenZip: string = require("7z-bin");
        let output = "";
        try {
          execFileSync(sevenZip, ["t", archive], { encoding: "utf8", stdio: "pipe" });
        } catch (err) {
          const { stdout, stderr } = err as { stdout?: string; stderr?: string };
          output = `${stdout ?? ""}\n${stderr ?? ""}`;
        }
        expect(needsUnarFallback(output.split("\n"))).toBe(true);

        expect(unarPath()).toBeDefined();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-unar-"));
        await extractWithUnar(archive, tmp);
        const files = fs.readdirSync(tmp, { recursive: true }) as string[];
        expect(files.some((f) => f.toLowerCase().endsWith(".nif"))).toBe(true);
      },
      60_000,
    );
  },
);
