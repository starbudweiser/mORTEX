import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setupAutoUpdaterMock } = vi.hoisted(() => ({ setupAutoUpdaterMock: vi.fn() }));

vi.mock("./autoupdater", () => ({ setupAutoUpdater: setupAutoUpdaterMock }));
vi.mock("../logging", () => ({ log: vi.fn() }));

import { initUpdater, isUpdaterActive } from "./updater";

const realPlatform = process.platform;
const setPlatform = (platform: NodeJS.Platform) =>
  Object.defineProperty(process, "platform", { value: platform, configurable: true });

beforeEach(() => {
  vi.clearAllMocks();
  // the release feed logic below is the Windows/Linux one; macOS is covered on its own
  setPlatform("win32");
  // a developer machine may have the dev-updater opt-in persisted in the user
  // environment; tests must never depend on ambient env
  vi.stubEnv("VORTEX_DEV_UPDATER", "");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  setPlatform(realPlatform);
});

describe("isUpdaterActive", () => {
  // mORTEX: the Vortex feed ships no macOS build, so the updater stays off whatever the install
  it("is always off on macOS", () => {
    setPlatform("darwin");
    expect(isUpdaterActive("regular")).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VORTEX_DEV_UPDATER", "1");
    expect(isUpdaterActive("regular")).toBe(false);
  });

  it("is on for a regular install outside development", () => {
    expect(isUpdaterActive("regular")).toBe(true);
  });

  it("is off for a managed install, since its launcher updates it", () => {
    expect(isUpdaterActive("managed")).toBe(false);
    // the opt-in is a development-only switch, so a shipped build ignores it entirely
    vi.stubEnv("VORTEX_DEV_UPDATER", "1");
    expect(isUpdaterActive("managed")).toBe(false);
  });

  // the point of the change: a source build would otherwise spend a real GitHub request per
  // launch on a check electron-updater refuses to complete
  it("is off in development without the opt-in, on with it", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isUpdaterActive("regular")).toBe(false);
    vi.stubEnv("VORTEX_DEV_UPDATER", "1");
    expect(isUpdaterActive("regular")).toBe(true);
  });

  // a source build has no uninstaller beside it so it always classifies as "managed"; if that
  // were allowed to veto the opt-in, the updater could never be tested from source at all
  it("ignores the install type in development, so the opt-in still works", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VORTEX_DEV_UPDATER", "1");
    expect(isUpdaterActive("managed")).toBe(true);
  });

  it("treats an unknown install type as inactive outside development", () => {
    expect(isUpdaterActive("")).toBe(false);
    expect(isUpdaterActive("something-else")).toBe(false);
  });
});

// This is the only gate: nothing downstream re-checks the install type, so if it stops holding a
// launcher-managed install would start updating itself behind the launcher's back.
describe("initUpdater", () => {
  it("sets the updater up when active", () => {
    initUpdater("regular");
    expect(setupAutoUpdaterMock).toHaveBeenCalledTimes(1);
  });

  it("does not set it up when inactive", () => {
    initUpdater("managed");
    vi.stubEnv("NODE_ENV", "development");
    initUpdater("regular");
    expect(setupAutoUpdaterMock).not.toHaveBeenCalled();
  });

  it("survives a failure in setup", () => {
    setupAutoUpdaterMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(() => initUpdater("regular")).not.toThrow();
  });
});
