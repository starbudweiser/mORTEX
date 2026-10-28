import { readdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { makeTempDir } from "../test-utils/tempDir";
import { adoptLegacyDirTag } from "./legacyDirTag";

describe("adoptLegacyDirTag", () => {
  it("renames the pre-rename marker to its mORTEX name", async () => {
    const dir = await makeTempDir("legacy-tag-");
    await writeFile(path.join(dir, "__vortex_staging_folder"), "{}");

    await adoptLegacyDirTag(dir, "__mortex_staging_folder", "__vortex_staging_folder");

    expect(await readdir(dir)).toEqual(["__mortex_staging_folder"]);
  });

  it("leaves both alone when the folder already has the mORTEX marker", async () => {
    const dir = await makeTempDir("legacy-tag-");
    await writeFile(path.join(dir, "__mortex_staging_folder"), "{}");
    await writeFile(path.join(dir, "__vortex_staging_folder"), "{}");

    await adoptLegacyDirTag(dir, "__mortex_staging_folder", "__vortex_staging_folder");

    expect((await readdir(dir)).sort()).toEqual([
      "__mortex_staging_folder",
      "__vortex_staging_folder",
    ]);
  });

  it("does nothing when there is no marker at all", async () => {
    const dir = await makeTempDir("legacy-tag-");

    await adoptLegacyDirTag(dir, "__mortex_staging_folder", "__vortex_staging_folder");

    expect(await readdir(dir)).toEqual([]);
  });
});
