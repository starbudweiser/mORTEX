import * as path from "path";

import { VortexError } from "@vortex/shared";

import { log } from "../../../logging";
import { knownArchiveExt } from "../../../util/archives";
import { folderIsMissing } from "../../../util/folderIsMissing";
import * as fs from "../../../util/fs";

const ADD_CHUNK_SIZE = 256;

/** archive files in the folder; read errors propagate */
async function readArchiveNames(downloadPath: string): Promise<string[]> {
  const entries: string[] = await fs.readdirAsync(downloadPath);
  const archives = entries.filter((fileName) => knownArchiveExt(fileName));
  const isFile = await Promise.all(
    archives.map((fileName) =>
      fs.statAsync(path.join(downloadPath, fileName)).then(
        (stat) => !stat.isDirectory(),
        () => false,
      ),
    ),
  );
  return archives.filter((_name, idx) => isFile[idx]);
}

/**
 * Reconciles the download database against the archives on disk: registers
 * archives that aren't in the database and removes records whose archive is
 * gone.
 */
export async function refreshDownloads(
  downloadPath: string,
  knownDLs: string[],
  normalize: (input: string) => string,
  onAddDownload: (name: string) => PromiseLike<void>,
  onRemoveDownload: (name: string) => PromiseLike<void>,
  confirmElevation: () => PromiseLike<void>,
): Promise<void> {
  // Never create the folder we are about to treat as the source of truth: with
  // records on file, an absent folder means unavailable, not emptied.
  if (knownDLs.length > 0 && (await folderIsMissing(downloadPath))) {
    throw new VortexError(`Download folder is not available: ${downloadPath}`, {
      kind: "fs:not-found",
      path: downloadPath,
    });
  }

  await fs.ensureDirWritableAsync(downloadPath, confirmElevation);
  const downloadNames = await readArchiveNames(downloadPath);

  const dlsNormalized = downloadNames.map(normalize);
  // Sets: with tens of thousands of archives, array lookups made this quadratic.
  const knownSet = new Set(knownDLs);
  const presentSet = new Set(dlsNormalized);
  const addedDLs = downloadNames.filter((_name, idx) => !knownSet.has(dlsNormalized[idx]));
  const removedDLs = knownDLs.filter((name) => !presentSet.has(name));

  // In chunks, so a huge folder doesn't open thousands of stat calls at once.
  for (let i = 0; i < addedDLs.length; i += ADD_CHUNK_SIZE) {
    await Promise.all(addedDLs.slice(i, i + ADD_CHUNK_SIZE).map((name) => onAddDownload(name)));
  }

  if (removedDLs.length === 0) {
    return;
  }

  // An empty read is the same signal by another route: a drive remounted blank,
  // or a path pointing somewhere new.
  if (downloadNames.length === 0) {
    log("error", "download folder read empty, keeping the download database", {
      downloadPath,
      keptRecords: removedDLs.length,
    });
    return;
  }

  log("info", "removing downloads whose archive is gone", {
    downloadPath,
    count: removedDLs.length,
    files: removedDLs,
  });
  await Promise.all(removedDLs.map((name) => onRemoveDownload(name)));
}
