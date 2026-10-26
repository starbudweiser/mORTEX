/**
 * mORTEX (macOS) : repli sur The Unarchiver pour les archives que 7-Zip ne lit pas.
 *
 * 7-Zip 26 répond « Unsupported Method » aux RAR créés par WinRAR 7 (méthode « v6 »), de plus en
 * plus courants sur Nexus. `unar` (LGPL, déposé à côté de 7z par mac/install_7zz.sh) les extrait.
 *
 * Interface :
 *  - needsUnarFallback(errors, platform?): boolean   7-Zip a échoué faute de méthode, sur macOS
 *  - unarPath(): string | undefined                  `unar` embarqué, sinon celui de Homebrew
 *  - extractWithUnar(archivePath, destPath): Promise  vide destPath puis y extrait l'archive
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import * as path from "node:path";

const UNSUPPORTED = /unsupported method/i;

export function needsUnarFallback(
  errors: string[],
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform === "darwin" && errors.some((err) => UNSUPPORTED.test(err));
}

export function unarPath(): string | undefined {
  const candidates: string[] = [];
  try {
    // 7z-bin donne <7z-bin>/darwin/7z ; unar est posé dans le même dossier (hors de l'asar)
    const sevenZip: string = require("7z-bin");
    candidates.push(
      path
        .join(path.dirname(sevenZip), "unar")
        .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`),
    );
  } catch {
    // 7z-bin introuvable : on tente Homebrew
  }
  candidates.push("/opt/homebrew/bin/unar", "/usr/local/bin/unar");
  return candidates.find((candidate) => existsSync(candidate));
}

export async function extractWithUnar(archivePath: string, destPath: string): Promise<void> {
  const bin = unarPath();
  if (bin === undefined) {
    throw new Error("unar is not available to extract this archive");
  }
  // ce que 7-Zip a pu extraire avant d'échouer est incomplet
  await rm(destPath, { recursive: true, force: true });
  await mkdir(destPath, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    // -q silencieux, -f écrase, -D sans dossier englobant, -o dossier de sortie
    execFile(
      bin,
      ["-q", "-f", "-D", "-o", destPath, archivePath],
      { maxBuffer: 16 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(`unar failed: ${stderr.trim() || err.message}`));
        } else {
          resolve();
        }
      },
    );
  });
}
