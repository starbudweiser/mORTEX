/**
 * mORTEX : rattachement des suspects d'un plantage sKYCRASH aux mods installés. Logique pure, sans
 * accès au disque ni à l'état : on lui donne la liste des fichiers déployés (manifeste de
 * déploiement : chemin relatif + mod d'origine) et les noms des mods.
 *
 * Un DLL ou un plugin est retrouvé par le nom de son fichier. Plusieurs mods peuvent fournir le
 * même nom (un écrasement) : tous sont listés, sans en choisir un. Sans correspondance, le
 * suspect est « hors mORTEX » (installé à la main, ou fichier du jeu).
 */
import path from "path";

import type { CrashEvent, CrashSuspect } from "@vortex/shared/ipc";

export interface IDeployedLike {
  relPath: string;
  /** Identifiant du mod d'où vient le fichier. */
  source: string;
}

export interface IModNames {
  id: string;
  names: string[];
}

export interface ICandidate {
  modId: string;
  /** Chemin relatif du fichier qui correspond (vide pour un rattachement par nom de mod). */
  relPath: string;
}

/**
 * - `mod` : au moins un mod de mORTEX correspond ;
 * - `external` : DLL, plugin ou mod sans correspondance, donc hors mORTEX ;
 * - `object` : un objet du jeu (maillage, formulaire…), qu'aucun fichier ne désigne ;
 * - `env` : un constat sur l'environnement (jeu, SKSE, bouteille).
 */
export type SuspectStatus = "mod" | "external" | "object" | "env";

export interface ILinkedSuspect {
  suspect: CrashSuspect;
  status: SuspectStatus;
  candidates: ICandidate[];
}

export interface ILinkedEvent {
  event: CrashEvent;
  /** Suspects classés par score décroissant. */
  suspects: ILinkedSuspect[];
}

/** Fichiers déployés indexés par nom de fichier en minuscules. */
export type FileIndex = Map<string, ICandidate[]>;

const normalize = (name: string) => path.basename(name.replace(/\\/g, "/")).toLowerCase();

export function buildFileIndex(files: IDeployedLike[]): FileIndex {
  const index: FileIndex = new Map();
  for (const file of files) {
    const key = normalize(file.relPath);
    const list = index.get(key) ?? [];
    if (!list.some((c) => c.modId === file.source && c.relPath === file.relPath)) {
      list.push({ modId: file.source, relPath: file.relPath });
    }
    index.set(key, list);
  }
  return index;
}

function linkSuspect(suspect: CrashSuspect, index: FileIndex, mods: IModNames[]): ILinkedSuspect {
  switch (suspect.kind) {
    case "env":
      return { suspect, status: "env", candidates: [] };
    case "object":
      return { suspect, status: "object", candidates: [] };
    case "mod": {
      const wanted = suspect.name.trim().toLowerCase();
      const candidates = mods
        .filter(({ id, names }) =>
          [id, ...names].some((name) => name.trim().toLowerCase() === wanted),
        )
        .map(({ id }) => ({ modId: id, relPath: "" }));
      return { suspect, status: candidates.length > 0 ? "mod" : "external", candidates };
    }
    default: {
      // Un DLL peut être nommé sans extension dans l'analyse (« EngineFixes »).
      const base = normalize(suspect.name);
      const keys =
        suspect.kind === "dll" && path.extname(base) === "" ? [`${base}.dll`, base] : [base];
      const candidates = keys.flatMap((key) => index.get(key) ?? []);
      return { suspect, status: candidates.length > 0 ? "mod" : "external", candidates };
    }
  }
}

export function linkEvent(event: CrashEvent, index: FileIndex, mods: IModNames[]): ILinkedEvent {
  const suspects = event.suspects
    .map((suspect) => linkSuspect(suspect, index, mods))
    .sort((a, b) => b.suspect.score - a.suspect.score);
  return { event, suspects };
}

/** Du plus récent au plus ancien. */
export function sortNewestFirst(events: CrashEvent[]): CrashEvent[] {
  return [...events].sort((a, b) => b.crash_time.localeCompare(a.crash_time));
}

export const RECURRENCE_WINDOW = 10;

export interface IModAppearance {
  /** Plantages récents examinés. */
  total: number;
  /** Parmi eux, ceux où le mod est un suspect. */
  count: number;
  /** Le plus récent où il apparaît, avec son rang parmi les suspects. */
  latest?: { linked: ILinkedEvent; suspect: ILinkedSuspect; rank: number };
}

/** Récurrence d'un mod parmi les `window` derniers plantages (événements du plus récent au plus ancien). */
export function modAppearance(
  modId: string,
  linked: ILinkedEvent[],
  window = RECURRENCE_WINDOW,
): IModAppearance {
  const recent = linked.slice(0, window);
  const result: IModAppearance = { total: recent.length, count: 0 };
  for (const entry of recent) {
    const rank = entry.suspects.findIndex((s) => s.candidates.some((c) => c.modId === modId));
    if (rank >= 0) {
      result.count++;
      result.latest ??= { linked: entry, suspect: entry.suspects[rank], rank: rank + 1 };
    }
  }
  return result;
}
