import { describe, expect, it } from "vitest";

import { isBuiltInTool, localToolPath } from "./tools";

const GAME = "/bottle/drive_c/Games/Skyrim Special Edition";

describe("localToolPath", () => {
  it("replaces a Windows absolute path of the curator in this game, from its Data folder", () => {
    expect(
      localToolPath(
        "E:\\Game\\Skyrim Anniversary Edition\\Data\\Nemesis_Engine\\Nemesis Unlimited Behavior Engine.exe",
        GAME,
      ),
    ).toBe(`${GAME}/Data/Nemesis_Engine/Nemesis Unlimited Behavior Engine.exe`);
  });

  it("turns Windows separators of a relative path into folders", () => {
    expect(localToolPath("Data\\Pandora Behaviour Engine+\\Pandora.exe", GAME)).toBe(
      `${GAME}/Data/Pandora Behaviour Engine+/Pandora.exe`,
    );
  });

  it("keeps a relative or local absolute path as before", () => {
    expect(localToolPath("SKSE/skse64_loader.exe", GAME)).toBe(`${GAME}/SKSE/skse64_loader.exe`);
    expect(localToolPath("/Applications/Tool.app", GAME)).toBe("/Applications/Tool.app");
  });

  it("leaves a Windows path outside of Data unchanged", () => {
    expect(localToolPath("E:\\Tools\\SSEEdit\\SSEEdit.exe", GAME)).toBe(
      "E:\\Tools\\SSEEdit\\SSEEdit.exe",
    );
  });
});

describe("isBuiltInTool", () => {
  const supported = [{ executable: () => "skse64_loader.exe" }];

  it("recognises a collection tool that launches a program the game already knows", () => {
    expect(
      isBuiltInTool(supported, {
        name: "SKSE",
        exe: "C:\\Games\\Skyrim\\SKSE64_Loader.exe",
      } as never),
    ).toBe(true);
  });

  it("keeps a tool with its own arguments or another program", () => {
    expect(
      isBuiltInTool(supported, { name: "x", exe: "skse64_loader.exe", args: ["-a"] } as never),
    ).toBe(false);
    expect(isBuiltInTool(supported, { name: "x", exe: "Nemesis.exe" } as never)).toBe(false);
  });
});
