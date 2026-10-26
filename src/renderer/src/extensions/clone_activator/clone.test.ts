import * as nodeFs from "node:fs";
import * as path from "node:path";

import { describe, expect } from "vitest";

import { test } from "../../test-utils/deploymentTest";
import { cloneKey, sameTime } from "./index";

const FILES = {
  "SkyUI_SE.esp": "esp data",
  "meshes/armor/helmet.nif": "nif data",
};

describe.skipIf(process.platform !== "darwin")("clone APFS deployment", () => {
  test("deploys real files, not hard links", async ({ makeDeployment }) => {
    const h = makeDeployment({ files: FILES, method: "clone" });
    await h.deploy();

    expect(h.deployedFiles().sort()).toEqual(Object.keys(FILES).sort());
    const deployed = h.inGame("SkyUI_SE.esp");
    expect(nodeFs.statSync(deployed).nlink).toBe(1);
    expect(nodeFs.readFileSync(deployed, "utf8")).toBe("esp data");
  });

  test("an edit to a deployed file leaves the staging file untouched", async ({
    makeDeployment,
  }) => {
    const h = makeDeployment({ files: FILES, method: "clone" });
    await h.deploy();

    nodeFs.writeFileSync(h.inGame("SkyUI_SE.esp"), "edited by xEdit");

    expect(nodeFs.readFileSync(path.join(h.modDir("SomeMod"), "SkyUI_SE.esp"), "utf8")).toBe(
      "esp data",
    );
  });

  test("purge removes the clones and keeps a deployed file edited since", async ({
    makeDeployment,
  }) => {
    const h = makeDeployment({ files: FILES, method: "clone" });
    await h.deploy();
    const edited = h.inGame("SkyUI_SE.esp");
    nodeFs.writeFileSync(edited, "edited by xEdit, longer than before");

    await h.method.purge(h.stagingDir, h.gameDir, "skyrimse");

    expect(nodeFs.existsSync(h.inGame("meshes/armor/helmet.nif"))).toBe(false);
    expect(nodeFs.existsSync(edited)).toBe(true);
  });
});

describe.skipIf(process.platform !== "darwin")("purge and the Finder", () => {
  test("a folder left with only a .DS_Store is removed", async ({ makeDeployment }) => {
    const h = makeDeployment({ files: FILES, method: "clone" });
    await h.deploy();
    const folder = path.dirname(h.inGame("meshes/armor/helmet.nif"));
    nodeFs.writeFileSync(path.join(folder, ".DS_Store"), "finder");

    await h.method.purge(h.stagingDir, h.gameDir, "skyrimse");

    expect(nodeFs.existsSync(folder)).toBe(false);
  });
});

describe("cloneKey", () => {
  test("ignores case", () => {
    expect(cloneKey("Meshes/A.nif", 3)).toBe(cloneKey("meshes/a.nif", 3));
  });

  test("differs when the size differs", () => {
    expect(cloneKey("a.esp", 3)).not.toBe(cloneKey("a.esp", 4));
  });
});

describe("sameTime", () => {
  // cas réel du stress test : 886,999636 s recopié en 887,000 s sur le clone
  test("accepts a date rounded across a second boundary", () => {
    expect(sameTime(1_792_976_886_999.636, 1_792_976_887_000)).toBe(true);
  });

  test("rejects a file touched later", () => {
    expect(sameTime(1_792_976_886_999.636, 1_792_976_889_000)).toBe(false);
  });
});
