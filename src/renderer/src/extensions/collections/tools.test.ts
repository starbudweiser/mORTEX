import { describe, expect, it } from "vitest";

import { localToolPath } from "./tools";

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
