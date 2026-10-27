import { describe, expect, it } from "vitest";

import { bottleEnv, parseMountType, setBottleEnv } from "./bottleHealth";

describe("bottle health", () => {
  it("reads the file system of a mount point", () => {
    const mount = [
      "/dev/disk3s1s1 on / (apfs, sealed, local, read-only, journaled)",
      "/dev/disk9s1 on /Volumes/SAMSUNG T7 (apfs, local, journaled, noowners)",
      "/dev/disk20s1 on /Volumes/USB (exfat, local, nodev, nosuid, noowners)",
    ].join("\n");
    expect(parseMountType(mount, "/Volumes/SAMSUNG T7")).toBe("apfs");
    expect(parseMountType(mount, "/Volumes/USB")).toBe("exfat");
    expect(parseMountType(mount, "/Volumes/None")).toBeUndefined();
  });

  it("turns MSync on in cxbottle.conf, whatever was there", () => {
    const base = '[Bottle]\n"Preview" = "0"\n\n[EnvironmentVariables]\n;;"PROMPT" = "$p$g"\n';
    const added = setBottleEnv(base, "WINEMSYNC", "1");
    expect(bottleEnv(added, "WINEMSYNC")).toBe("1");
    expect(added).toContain('[EnvironmentVariables]\n"WINEMSYNC" = "1"\n;;"PROMPT"');

    const off = setBottleEnv(added, "WINEMSYNC", "0");
    expect(bottleEnv(setBottleEnv(off, "WINEMSYNC", "1"), "WINEMSYNC")).toBe("1");
    expect(
      bottleEnv(setBottleEnv('[Bottle]\n;"WINEMSYNC" = "1"\n', "WINEMSYNC", "1"), "WINEMSYNC"),
    ).toBe("1");
    expect(bottleEnv(setBottleEnv("[Bottle]\n", "WINEMSYNC", "1"), "WINEMSYNC")).toBe("1");
  });
});
