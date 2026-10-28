import { describe, expect, it, vi } from "vitest";

vi.mock("../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

import type { IMod } from "../mod_management/types/IMod";
import { modsDeploying } from "./fixes";

const mod = (id: string): IMod => ({ id, installationPath: id }) as IMod;

describe("DXMT workshop fixes", () => {
  it("finds the enabled mods that deploy the duplicated DLLs", () => {
    const files = [
      { relPath: "SKSE/Plugins/TerrainHelper.dll", source: "Terrain Helper" },
      { relPath: "SKSE/Plugins/CommunityShaders.dll", source: "Bottled" },
      { relPath: "SKSE/Plugins/InverseSquareLighting.dll", source: "ISL off" },
    ];
    const mods = {
      "Terrain Helper": mod("Terrain Helper"),
      Bottled: mod("Bottled"),
      "ISL off": mod("ISL off"),
    };
    const found = modsDeploying(
      files,
      ["terrainhelper.dll", "InverseSquareLighting.dll"],
      mods,
      (id) => id !== "ISL off",
    );
    expect(found.map((m) => m.id)).toEqual(["Terrain Helper"]);
  });
});
