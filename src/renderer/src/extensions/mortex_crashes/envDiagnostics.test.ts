import type { CrashEvent } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import type { IBottle } from "../../util/macos/bottles";
import { diagnoseEnvironment } from "./envDiagnostics";
import { buildFileIndex, linkEvent } from "./linking";

const bottle: IBottle = {
  path: "/b/mORTEX-Test",
  name: "mORTEX-Test",
  kind: "crossover",
  userDir: "/b/mORTEX-Test/drive_c/users/crossover",
};

const event = (names: string[], bottleName: string | null = "mORTEX-Test"): CrashEvent => ({
  schema: 1,
  crash_time: "t",
  log_name: "l",
  game_runtime: "1.6.1170",
  skse_runtime: "2.2.6",
  verdict: null,
  plugins_hash: null,
  bottle: bottleName,
  suspects: names.map((name) => ({ name, kind: "env", score: 0.5, reasons: [] })),
});

const run = (names: string[], bottleName: string | null, deployed: string[] = []) => {
  const files = buildFileIndex(deployed.map((relPath) => ({ relPath, source: "addr-lib" })));
  const e = event(names, bottleName);
  return diagnoseEnvironment(e, linkEvent(e, files, []).suspects, {
    bottles: [bottle],
    dllOverride: (_b, dll) => (dll === "d3d11" ? "native,builtin" : undefined),
    files,
  });
};

describe("diagnoseEnvironment", () => {
  it("reconnaît la bouteille et recoupe les DLL overrides graphiques", () => {
    const report = run(["D3DMetal"], "mORTEX-Test");
    expect(report.bottle).toEqual({ name: "mORTEX-Test", known: true, kind: "crossover" });
    expect(report.findings[0].notes).toEqual([
      {
        key: "Bottle override {{dll}}: {{value}}",
        params: { dll: "d3d11", value: "native,builtin" },
      },
    ]);
  });

  it("bouteille inconnue de mORTEX", () => {
    const report = run(["DXMT"], "Autre");
    expect(report.bottle?.known).toBe(false);
    expect(report.findings[0].notes[0].key).toMatch(/unknown to mORTEX/);
  });

  it("Address Library : fichier de la version du jeu déployé ou non", () => {
    const missing = run(["Address Library"], null);
    expect(missing.findings[0].notes[0]).toEqual({
      key: "{{file}} is not deployed by any mORTEX mod.",
      params: { file: "versionlib-1-6-1170-0.bin" },
    });
    const present = run(["Address Library"], null, ["SKSE/Plugins/versionlib-1-6-1170-0.bin"]);
    expect(present.findings[0].notes[0].params).toEqual({
      file: "versionlib-1-6-1170-0.bin",
      mod: "addr-lib",
    });
  });
});
