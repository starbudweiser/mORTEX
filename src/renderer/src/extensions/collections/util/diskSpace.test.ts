import { describe, expect, it } from "vitest";

import { estimateSpace, INSTALLED_FACTOR, SPARE_BYTES } from "./diskSpace";

const GB = 1024 ** 3;

const rule = (type: string, fileSize: number, fileMD5?: string): any => ({
  type,
  reference: { fileSize, fileMD5 },
});

describe("estimateSpace", () => {
  const rules = [rule("requires", 10 * GB, "a"), rule("recommends", 5 * GB, "b")];

  it("counts only archives not yet downloaded", () => {
    const downloads: any = { d1: { state: "finished", fileMD5: "a" } };
    const volume = { dev: 1, free: 500 * GB };
    const estimate = estimateSpace(rules, downloads, { downloads: volume, mods: volume });
    expect(estimate.archives).toBe(15 * GB);
    expect(estimate.toDownload).toBe(5 * GB);
    expect(estimate.installed).toBe(15 * GB * INSTALLED_FACTOR);
    expect(estimate.missing).toBe(0);
  });

  it("ignores unfinished downloads and other rule types", () => {
    const downloads: any = { d1: { state: "started", fileMD5: "a" } };
    const volume = { dev: 1, free: 500 * GB };
    const estimate = estimateSpace([...rules, rule("conflicts", 99 * GB, "c")], downloads, {
      downloads: volume,
      mods: volume,
    });
    expect(estimate.toDownload).toBe(15 * GB);
  });

  it("adds both needs when downloads and mods share a disk", () => {
    const volume = { dev: 1, free: 40 * GB };
    const estimate = estimateSpace(rules, {}, { downloads: volume, mods: volume });
    // 15 à télécharger + 30 installés + la marge, pour 40 libres
    expect(estimate.missing).toBe(15 * GB + 30 * GB + SPARE_BYTES - 40 * GB);
  });

  it("checks each disk on its own", () => {
    const estimate = estimateSpace(
      rules,
      {},
      { downloads: { dev: 1, free: 100 * GB }, mods: { dev: 2, free: 31 * GB } },
    );
    expect(estimate.missing).toBe(30 * GB + SPARE_BYTES - 31 * GB);
    expect(estimate.free).toBe(31 * GB);
  });
});
