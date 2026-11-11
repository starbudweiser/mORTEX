import { describe, expect, it } from "vitest";

import { isFinderJunk, isMacMetadata } from "./finderJunk";

describe("isFinderJunk", () => {
  it("reconnaît .DS_Store, où qu'il soit", () => {
    expect(isFinderJunk("/Data/Scripts/.DS_Store")).toBe(true);
  });

  it("reconnaît les fichiers d'attributs « ._ » des disques exFAT", () => {
    expect(isFinderJunk("/Volumes/EXFAT/Data/SKSE/Plugins/._EngineFixes.dll")).toBe(true);
    expect(isFinderJunk("._Skyrim.esm")).toBe(true);
  });

  it("ne prend pas un vrai fichier pour un déchet du Finder", () => {
    expect(isFinderJunk("/Data/Scripts/armor.pex")).toBe(false);
    expect(isFinderJunk("/Data/DS_Store.esp")).toBe(false);
    expect(isFinderJunk("/Data/_patch.esp")).toBe(false);
    expect(isFinderJunk("/Data/.hidden.ini")).toBe(false);
  });
});

describe("isMacMetadata", () => {
  it("écarte tout ce qui est sous __MACOSX", () => {
    expect(isMacMetadata("/staging/MonMod/__MACOSX/Data/plugin.esp")).toBe(true);
    expect(isMacMetadata("__MACOSX\\._plugin.esp")).toBe(true);
  });

  it("garde les vrais fichiers", () => {
    expect(isMacMetadata("/staging/MonMod/Data/plugin.esp")).toBe(false);
    expect(isMacMetadata("/staging/MACOSX_patch/plugin.esp")).toBe(false);
  });
});
