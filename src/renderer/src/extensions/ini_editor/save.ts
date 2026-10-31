/**
 * mORTEX (macOS) : enregistrement des réglages en attente de l'Éditeur de réglages.
 *  - previewSave : ce qui sera écrit, fichier par fichier, pour la boîte « Voici ce qui va changer »
 *  - commitSave  : copie de sécurité, puis écriture ligne à ligne (util/macos/iniEdit)
 * Rien n'est écrit si un fichier est en lecture seule ou a changé depuis l'aperçu.
 */
import { access, chmod, constants } from "node:fs/promises";
import * as path from "node:path";

import {
  type IChange,
  type IIniFile,
  type IIniPlan,
  type IPlannedChange,
  applyChanges,
  planChanges,
} from "../../util/macos/iniEdit";
import { type IBackup, createBackup, restoreBackup } from "./backup";

export type SaveErrorCode = "readOnly";

export class SettingsSaveError extends Error {
  public constructor(
    public readonly code: SaveErrorCode,
    public readonly file: string,
  ) {
    super(`${code}: ${path.basename(file)}`);
  }
}

/**
 * Case « Protéger en écriture après l'enregistrement » : les fichiers écrits passent en lecture seule,
 * le jeu ne peut plus les réécrire en quittant. Restaurer ou annuler les rend de nouveau modifiables.
 */
export async function protectFiles(files: string[]): Promise<void> {
  for (const file of files) await chmod(file, 0o444);
}

export interface IPlanFileSummary {
  /** nom du fichier (SkyrimPrefs.ini) */
  name: string;
  changes: IPlannedChange[];
}

export const previewSave = (files: IIniFile[], changes: IChange[]): IIniPlan =>
  planChanges(files, changes);

/** le plan, regroupé par fichier, dans l'ordre des fichiers modifiés */
export function summarizePlan(plan: IIniPlan): IPlanFileSummary[] {
  return plan.files.map((file) => ({
    name: path.basename(file.path),
    changes: plan.changes.filter((c) => c.path === file.path),
  }));
}

export interface ISaveResult {
  backup: IBackup;
  written: string[];
}

export async function commitSave(plan: IIniPlan): Promise<ISaveResult> {
  for (const file of plan.files) {
    if (file.base === undefined) continue;
    await access(file.path, constants.W_OK).catch(() => {
      throw new SettingsSaveError("readOnly", file.path);
    });
  }

  const existing = plan.files.filter((f) => f.base !== undefined).map((f) => f.path);
  const created = plan.files.filter((f) => f.base === undefined).map((f) => f.path);
  const backup = await createBackup(existing, created);
  try {
    return { backup, written: await applyChanges(plan) };
  } catch (err) {
    // écriture interrompue : on remet les fichiers comme ils étaient
    await restoreBackup(backup.dir).catch(() => undefined);
    throw err;
  }
}

export interface ISummaryWords {
  /** « (absent) » : la clé n'existait pas */
  unset: string;
  /** « — nouvelle section » */
  newSection: string;
}

/** le plan en texte lisible pour la boîte de confirmation, un fichier après l'autre */
export function formatSummary(summary: IPlanFileSummary[], words: ISummaryWords): string {
  return summary
    .map((file) =>
      [
        file.name,
        ...file.changes.map(
          (c) =>
            `  [${c.section}] ${c.key} : ${c.oldValue ?? words.unset} → ${c.newValue}` +
            (c.createsSection ? ` ${words.newSection}` : ""),
        ),
      ].join("\n"),
    )
    .join("\n\n");
}
