/**
 * mORTEX (macOS) : dossier Documents propre à chaque bouteille.
 *
 * CrossOver relie `drive_c/users/<u>/Documents` au ~/Documents du Mac. Toutes les bouteilles
 * partagent alors `My Games/<jeu>` : INI, sauvegardes, journaux SKSE. Un réglage écrit par
 * mORTEX (ou un mod) dans une bouteille s'applique aux autres.
 *
 * Interface :
 *  - sharedDocumentsTarget(documents): string | undefined   cible du lien si Documents est partagé
 *  - isolateDocuments(documents, gameFolders): Promise       remplace le lien par un vrai dossier où
 *    sont copiés les `My Games/<dossier>` du jeu ; rien n'est retiré de ~/Documents
 *  - restoreSharedDocuments(documents): Promise<string>      annule : remet le lien, garde le dossier
 *    isolé à côté (Documents.isolé-<date>) et renvoie son chemin
 *
 * Un fichier MARKER dans le dossier isolé garde la cible d'origine (pour l'annulation).
 */
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";

export const MARKER = ".mortex-documents.json";

interface IMarker {
  linkedTo: string;
  isolatedAt: string;
  imported: string[];
}

/** cible du lien Documents d'une bouteille, ou undefined s'il n'est pas partagé */
export async function sharedDocumentsTarget(documents: string): Promise<string | undefined> {
  try {
    const stats = await lstat(documents);
    if (!stats.isSymbolicLink()) return undefined;
    const target = await readlink(documents);
    return path.resolve(path.dirname(documents), target);
  } catch {
    return undefined;
  }
}

export async function isolateDocuments(documents: string, gameFolders: string[]): Promise<void> {
  const linkedTo = await sharedDocumentsTarget(documents);
  if (linkedTo === undefined) {
    throw new Error("Documents is not linked to a shared folder");
  }

  const staging = `${documents}.mortex-new`;
  await rm(staging, { recursive: true, force: true });
  const imported: string[] = [];
  for (const folder of gameFolders) {
    const source = path.join(linkedTo, "My Games", folder);
    try {
      await lstat(source);
    } catch {
      continue;
    }
    await cp(source, path.join(staging, "My Games", folder), {
      recursive: true,
      preserveTimestamps: true,
      verbatimSymlinks: true,
    });
    imported.push(folder);
  }
  await mkdir(staging, { recursive: true });
  const marker: IMarker = { linkedTo, isolatedAt: new Date().toISOString(), imported };
  await writeFile(path.join(staging, MARKER), JSON.stringify(marker, undefined, 2));

  // le lien n'est qu'un raccourci : le retirer ne touche pas à ~/Documents
  await rm(documents);
  try {
    await rename(staging, documents);
  } catch (err) {
    await symlink(linkedTo, documents);
    throw err;
  }
}

export async function restoreSharedDocuments(documents: string): Promise<string> {
  const marker = JSON.parse(await readFile(path.join(documents, MARKER), "utf8")) as IMarker;
  // date et heure : deux annulations le même jour ne se marchent pas dessus
  const stamp = marker.isolatedAt.slice(0, 19).replace(/[:T]/g, "-");
  const kept = `${documents}.isolé-${stamp}`;
  await rename(documents, kept);
  await symlink(marker.linkedTo, documents);
  return kept;
}
