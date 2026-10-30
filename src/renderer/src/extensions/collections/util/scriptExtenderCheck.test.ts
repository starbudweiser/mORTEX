import { describe, expect, it } from "vitest";

import { checkScriptExtender } from "./scriptExtenderCheck";

const AE = "1.6.1170.0";
const loader = ["SkyrimSE.exe", "skse64_loader.exe"];

describe("checkScriptExtender", () => {
  it("is quiet when SKSE and the Address Library match the game", () => {
    expect(
      checkScriptExtender(
        AE,
        [...loader, "skse64_1_6_1170.dll"],
        ["EngineFixes.dll", "versionlib-1-6-1170-0.bin"],
      ),
    ).toEqual([]);
  });

  it("is quiet without any SKSE plugin", () => {
    expect(checkScriptExtender(AE, ["SkyrimSE.exe"], [])).toEqual([]);
  });

  it("names the SKSE build made for another version", () => {
    const issues = checkScriptExtender(
      AE,
      [...loader, "skse64_1_7_104.dll"],
      ["versionlib-1-6-1170-0.bin", "a.dll"],
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].params).toEqual({ skse: "1.7.104", game: "1.6.1170" });
  });

  it("reports plugins without SKSE", () => {
    const issues = checkScriptExtender(
      AE,
      ["SkyrimSE.exe"],
      ["a.dll", "b.DLL", "versionlib-1-6-1170-0.bin"],
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].params).toEqual({ plugins: "2", game: "1.6.1170" });
  });

  it("names the Address Library made for another version", () => {
    const issues = checkScriptExtender(
      AE,
      [...loader, "skse64_1_6_1170.dll"],
      ["a.dll", "versionlib-1-7-104-0.bin"],
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].params).toEqual({ found: "1.7.104", game: "1.6.1170" });
  });

  it("reports a missing Address Library, and reads the 1.5 file name", () => {
    expect(
      checkScriptExtender("1.5.97.0", [...loader, "skse64_1_5_97.dll"], ["a.dll"])[0].params,
    ).toEqual({ game: "1.5.97" });
    expect(
      checkScriptExtender(
        "1.5.97.0",
        [...loader, "skse64_1_5_97.dll"],
        ["a.dll", "version-1-5-97-0.bin"],
      ),
    ).toEqual([]);
  });

  it("checks nothing when the game version is unknown", () => {
    expect(checkScriptExtender("unknown", ["skse64_1_7_104.dll"], ["a.dll"])).toEqual([]);
  });
});
