import { describe, expect, it } from "vitest";

import { parseScriptExtenderLog } from "./skseLog";

describe("script extender log", () => {
  it("lists refused plugins with the reason SKSE gave", () => {
    const report = parseScriptExtenderLog(
      [
        "plugin directory = C:\\Games\\Skyrim Special Edition\\Data\\SKSE\\Plugins\\",
        "checking plugin BugFixesSSE.dll",
        "plugin BugFixesSSE.dll (00000001 Bug Fixes SSE 0000000A) disabled, address library needs to be updated 0 (handle 0)",
        "plugin Old.dll (00000001 Old 00000001) disabled, incompatible with current runtime version 0 (handle 0)",
        "couldn't load plugin C:\\Games\\Skyrim Special Edition\\Data\\SKSE\\Plugins\\Needs.dll (Error 126)",
        "plugin Fine.dll (00000001 Fine 00000001) loaded correctly (handle 3)",
      ].join("\r\n"),
    );
    expect(report.loaded).toEqual(["Fine.dll"]);
    expect(report.refused).toEqual([
      {
        plugin: "BugFixesSSE.dll",
        kind: "address-library",
        reason: "address library needs to be updated",
      },
      {
        plugin: "Old.dll",
        kind: "runtime",
        reason: "incompatible with current runtime version",
      },
      { plugin: "Needs.dll", kind: "missing-dependency", reason: "Error 126" },
    ]);
  });
});
