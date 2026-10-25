import { describe, expect, it } from "vitest";

import { parseLsof } from "./whoLocks";

describe("parseLsof", () => {
  it("lit les paires pid / commande", () => {
    expect(parseLsof("p123\ncSkyrimSE.exe\np456\ncwine64-preloader\n")).toEqual([
      { appName: "SkyrimSE.exe", pid: 123 },
      { appName: "wine64-preloader", pid: 456 },
    ]);
  });

  it("renvoie une liste vide pour une sortie vide", () => {
    expect(parseLsof("")).toEqual([]);
  });
});
