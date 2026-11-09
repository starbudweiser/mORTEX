import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PRESENCE,
  getPresence,
  hidesOnClose,
  normalizePresence,
  readPresence,
  setPresence,
  shouldHideOnToggle,
  showsDock,
  showsMenuBar,
  writePresence,
} from "./presence";

describe("presence mode", () => {
  it("defaults to the menu bar only", () => {
    expect(DEFAULT_PRESENCE).toBe("menubar");
    expect(normalizePresence(undefined)).toBe("menubar");
    expect(normalizePresence("tray")).toBe("menubar");
    expect(normalizePresence(3)).toBe("menubar");
  });

  it("keeps the three known modes", () => {
    expect(normalizePresence("dock")).toBe("dock");
    expect(normalizePresence("menubar")).toBe("menubar");
    expect(normalizePresence("both")).toBe("both");
  });

  it("shows the Dock icon and the menu bar icon according to the mode", () => {
    expect([showsDock("dock"), showsMenuBar("dock")]).toEqual([true, false]);
    expect([showsDock("menubar"), showsMenuBar("menubar")]).toEqual([false, true]);
    expect([showsDock("both"), showsMenuBar("both")]).toEqual([true, true]);
  });

  it("remembers the current mode", () => {
    setPresence("both");
    expect(getPresence()).toBe("both");
    setPresence("menubar");
    expect(getPresence()).toBe("menubar");
  });
});

describe("closing the window", () => {
  it("hides the window in menu bar mode on macOS", () => {
    expect(hidesOnClose("menubar", "darwin", false)).toBe(true);
  });

  it("quits as before in the other modes", () => {
    expect(hidesOnClose("dock", "darwin", false)).toBe(false);
    expect(hidesOnClose("both", "darwin", false)).toBe(false);
  });

  it("never hides the window while the app is quitting", () => {
    expect(hidesOnClose("menubar", "darwin", true)).toBe(false);
  });

  it("changes nothing outside macOS", () => {
    expect(hidesOnClose("menubar", "win32", false)).toBe(false);
    expect(hidesOnClose("menubar", "linux", false)).toBe(false);
  });
});

describe("clicking the icon", () => {
  const window = (visible: boolean, focused: boolean, minimized: boolean) => ({
    isVisible: () => visible,
    isFocused: () => focused,
    isMinimized: () => minimized,
  });

  it("hides a window that is in front", () => {
    expect(shouldHideOnToggle(window(true, true, false))).toBe(true);
  });

  it("brings forward a window that is hidden, behind other apps or minimized", () => {
    expect(shouldHideOnToggle(window(false, false, false))).toBe(false);
    expect(shouldHideOnToggle(window(true, false, false))).toBe(false);
    expect(shouldHideOnToggle(window(true, true, true))).toBe(false);
  });
});

describe("presence file", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "mortex-presence-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("falls back to the default when there is no file", () => {
    expect(readPresence(path.join(dir, "presence.json"))).toBe("menubar");
  });

  it("falls back to the default when the file is damaged", () => {
    const file = path.join(dir, "presence.json");
    writeFileSync(file, "{ not json");
    expect(readPresence(file)).toBe("menubar");
  });

  it("reads back what was written, without leaving a temporary file", () => {
    const file = path.join(dir, "presence.json");
    writePresence(file, "both");
    expect(readPresence(file)).toBe("both");
    writePresence(file, "dock");
    expect(readPresence(file)).toBe("dock");
    expect(readdirSync(dir)).toEqual(["presence.json"]);
  });
});
