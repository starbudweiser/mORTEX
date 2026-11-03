import { describe, expect, it } from "vitest";

import { BOTTLED_MIN_VERSION, bottledStatus, compareVersions } from "./bottledVersion";
import type { IShadersReport } from "./dxmtChecks";

const report = (patch: Partial<IShadersReport>): IShadersReport => ({
  bottled: true,
  outdatedFeatures: [],
  logged: false,
  failures: 0,
  ...patch,
});

describe("compareVersions", () => {
  it("compares segment by segment as numbers", () => {
    expect(compareVersions("1.0.9", "1.0.26")).toBeLessThan(0);
    expect(compareVersions("1.0.26", "1.0.26")).toBe(0);
    expect(compareVersions("1.1", "1.0.26")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("v1.0.27-beta", "1.0.26")).toBeGreaterThan(0);
  });

  it("puts an unreadable version before any other", () => {
    expect(compareVersions("?", "1.0.26")).toBeLessThan(0);
  });
});

describe("bottledStatus", () => {
  it("requires Bottled Shaders 1.0.26 at least", () => {
    expect(BOTTLED_MIN_VERSION).toBe("1.0.26");
  });

  it("flags a local version older than the minimum as outdated", () => {
    const status = bottledStatus(report({ version: "1.0.25" }));
    expect(status).toMatchObject({ state: "outdated", version: "1.0.25", source: "dll" });
    expect(status.text).toEqual({
      key: "mackit.bottled.outdated",
      params: { version: "1.0.25", minimum: "1.0.26" },
    });
  });

  it("accepts the minimum and anything newer", () => {
    expect(bottledStatus(report({ version: "1.0.26" })).state).toBe("ok");
    expect(bottledStatus(report({ version: "1.0.27" })).state).toBe("ok");
  });

  it("prefers the version the caller knows over the one in the DLL", () => {
    const status = bottledStatus(report({ version: "1.2.1" }), "1.0.25");
    expect(status).toMatchObject({ state: "outdated", version: "1.0.25", source: "caller" });
  });

  it("does not guess when no version can be read", () => {
    expect(bottledStatus(report({})).state).toBe("unknown");
  });

  it("tells the original Community Shaders and an absent one apart from Bottled", () => {
    expect(bottledStatus(report({ bottled: false, version: "1.2.1" })).state).toBe("stock");
    expect(bottledStatus(undefined).state).toBe("absent");
  });
});
