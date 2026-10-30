/**
 * mORTEX : l'espace disque qu'une collection va prendre, comparé à l'espace libre, pour prévenir
 * avant l'installation plutôt que de remplir le disque en cours de route.
 *
 * Interface :
 *  - estimateSpace(rules, downloads, volumes)  archives à télécharger, place des mods installés,
 *    espace libre et verdict, par disque (téléchargements et mods peuvent être sur deux disques)
 *  - volumeOf(dir)                             le disque d'un dossier (même s'il n'existe pas encore)
 */
import { statfsSync, statSync } from "node:fs";
import * as path from "node:path";

import type { IDownload } from "../../download_management/types/IDownload";
import type { IModRule } from "../../mod_management/types/IMod";

/**
 * Une fois extraits, les mods prennent environ deux fois la taille de leurs archives
 * (mesuré : 94 Go d'archives d'I&A ont pris un peu plus de 200 Go).
 */
export const INSTALLED_FACTOR = 2;
/** marge gardée libre sur le disque, comme le reste de mORTEX */
export const SPARE_BYTES = 2 * 1024 ** 3;

export interface IVolume {
  /** identifiant du disque (stat.dev) */
  dev: number;
  free: number;
}

export interface ISpaceEstimate {
  archives: number;
  toDownload: number;
  installed: number;
  /** espace manquant sur le disque le plus juste (0 s'il y a assez de place) */
  missing: number;
  /** espace libre sur le disque des mods */
  free: number;
}

export function volumeOf(dir: string | undefined): IVolume | undefined {
  // sans profil ni dossier de staging (tous les profils supprimés), le chemin est indéfini
  if (typeof dir !== "string" || dir === "") return undefined;
  let current = dir;
  // un dossier pas encore créé : on remonte jusqu'à un parent existant
  for (;;) {
    try {
      const stats = statfsSync(current);
      return { dev: statSync(current).dev, free: stats.bavail * stats.bsize };
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

export function estimateSpace(
  rules: IModRule[],
  downloads: { [id: string]: IDownload },
  volumes: { downloads: IVolume; mods: IVolume },
): ISpaceEstimate {
  const have = new Set(
    Object.values(downloads ?? {})
      .filter((download) => download.state === "finished" && download.fileMD5 !== undefined)
      .map((download) => download.fileMD5),
  );

  let archives = 0;
  let toDownload = 0;
  for (const rule of rules ?? []) {
    if (rule.type !== "requires" && rule.type !== "recommends") continue;
    const size = rule.reference?.fileSize ?? 0;
    archives += size;
    if (rule.reference?.fileMD5 === undefined || !have.has(rule.reference.fileMD5)) {
      toDownload += size;
    }
  }
  const installed = archives * INSTALLED_FACTOR;

  const needs = new Map<number, { free: number; need: number }>();
  const add = (volume: IVolume, bytes: number) => {
    const entry = needs.get(volume.dev) ?? { free: volume.free, need: SPARE_BYTES };
    entry.need += bytes;
    needs.set(volume.dev, entry);
  };
  add(volumes.downloads, toDownload);
  add(volumes.mods, installed);

  const missing = Math.max(0, ...[...needs.values()].map((entry) => entry.need - entry.free));
  return { archives, toDownload, installed, missing, free: volumes.mods.free };
}
