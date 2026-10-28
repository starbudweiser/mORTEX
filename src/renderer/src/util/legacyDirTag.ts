import * as path from "path";

import * as fs from "./fs";

/**
 * mORTEX: renames a folder's pre-rename marker file (named after Vortex) to its mORTEX name, unless
 * the folder already has the mORTEX one. Does nothing when neither exists.
 */
export async function adoptLegacyDirTag(
  dirPath: string,
  tag: string,
  legacyTag: string,
): Promise<void> {
  const tagPath = path.join(dirPath, tag);
  try {
    await fs.statAsync(tagPath);
    return;
  } catch {
    // no mORTEX marker yet: take over the old one if there is one
  }
  await fs.renameAsync(path.join(dirPath, legacyTag), tagPath).catch(() => undefined);
}
