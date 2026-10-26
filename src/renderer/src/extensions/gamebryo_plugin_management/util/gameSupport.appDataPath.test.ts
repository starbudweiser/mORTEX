import * as path from "path";

import { afterEach, describe, expect, it, vi } from "vitest";

// mORTEX: on macOS "localAppData" is the active bottle's AppData/Local, so plugins.txt must land there
const BOTTLE_LOCAL = "/bottles/Skyrim/drive_c/users/crossover/AppData/Local";
vi.mock("../../../util/getVortexPath", () => ({
  default: vi.fn((id: string) => (id === "localAppData" ? BOTTLE_LOCAL : `/unused/${id}`)),
}));

import { appDataPath, pluginPath } from "./gameSupport";

describe("appDataPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("puts plugins.txt in the bottle's AppData/Local, not ~/Library/Local", () => {
    vi.stubEnv("LOCALAPPDATA", undefined as unknown as string);

    expect(appDataPath("skyrimse")).toBe(path.join(BOTTLE_LOCAL, "Skyrim Special Edition"));
    expect(pluginPath("skyrimse")).toBe(path.join(BOTTLE_LOCAL, "Skyrim Special Edition"));
  });
});
