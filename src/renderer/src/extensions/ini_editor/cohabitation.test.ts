/**
 * Cohabitation avec ini_prep : à chaque déploiement, ini_prep recrée les INI à partir de « .base ».
 * Avant cela, il reporte dans « .base » les changements faits à la main (INI ≠ .baked). Une valeur
 * écrite par l'Éditeur de réglages doit donc survivre à un déploiement, sans toucher au reste.
 *
 * Constat (29/10/2026) : sous macOS, ini_prep ne fait rien (son format « winapi » n'existe que sous
 * Windows : genIniFormat renvoie undefined), donc un déploiement ne réécrit pas les INI de la
 * bouteille. Ce test garde la garantie : si ini_prep est un jour activé sur Mac, il doit reporter la
 * valeur dans « .base » au lieu de l'écraser.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import PromiseBB from "bluebird";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paths = vi.hoisted(() => ({ documents: "" }));

vi.mock("../../util/getVortexPath", () => ({ default: () => paths.documents }));
vi.mock("../mod_management/selectors", () => ({ installPathForGame: () => "/staging" }));

import type { IState } from "../../types/IState";
import { loadSkyrimIniFiles } from "../../util/macos/iniEdit";
import { bakeSettings, discoverSettingsChanges } from "../ini_prep";
import { commitSave, previewSave } from "./save";

describe("cohabitation avec ini_prep", () => {
  let root: string;
  let iniDir: string;
  const discovery = { path: "/Games/Skyrim Special Edition" } as never;
  const api = { translate: (text: string) => text, showErrorNotification: vi.fn() } as never;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-cohab-"));
    paths.documents = root;
    iniDir = path.join(root, "My Games", "Skyrim Special Edition");
    fs.mkdirSync(iniDir, { recursive: true });
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const write = (name: string, text: string) => fs.writeFileSync(path.join(iniDir, name), text);
  const read = (name: string) => fs.readFileSync(path.join(iniDir, name), "utf8");

  it("keeps a value written by the editor through a deployment", async () => {
    const prefs = "[Display]\r\niShadowMapResolution=2048\r\nfGamma=1.0000\r\n";
    // état d'ini_prep après un premier déploiement : .base et .baked identiques à l'INI
    for (const name of ["Skyrim.ini", "SkyrimCustom.ini"]) write(name, "");
    write("SkyrimPrefs.ini", prefs);
    for (const name of ["Skyrim.ini", "SkyrimPrefs.ini", "SkyrimCustom.ini"]) {
      for (const ext of [".base", ".baked"]) {
        fs.copyFileSync(path.join(iniDir, name), path.join(iniDir, name + ext));
      }
    }

    // l'éditeur écrit une valeur
    const plan = previewSave(await loadSkyrimIniFiles(iniDir), [
      { section: "Display", key: "iShadowMapResolution", value: "4096" },
    ]);
    await commitSave(plan);
    expect(read("SkyrimPrefs.ini")).toContain("iShadowMapResolution=4096");

    // déploiement : changements manuels reportés dans .base, puis INI recréés depuis .base
    await discoverSettingsChanges(api, "skyrimse", discovery);
    await bakeSettings(
      ((text: string) => text) as never,
      "skyrimse",
      discovery,
      [],
      {} as IState,
      () => PromiseBB.resolve(),
    );

    expect(read("SkyrimPrefs.ini")).toMatch(/iShadowMapResolution\s*=\s*4096/);
    expect(read("SkyrimPrefs.ini")).toMatch(/fGamma\s*=\s*1\.0000/);
  });
});
