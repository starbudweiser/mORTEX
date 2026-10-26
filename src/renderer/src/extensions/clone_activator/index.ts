/**
 * mORTEX (macOS) : déploiement par clones APFS.
 *
 * Interface :
 *  - DeploymentMethod (id `clone_activator`) : chaque fichier est cloné (`copyFile(…,
 *    COPYFILE_FICLONE)`, qui fait un clonefile sur APFS ; Node n'a pas FICLONE_FORCE sur macOS) du
 *    staging vers le dossier du jeu, puis reçoit la date de l'original. Un clone ne coûte
 *    aucun octet tant qu'il n'est pas modifié, comme un lien physique ; mais un outil qui modifie un
 *    fichier déployé (xEdit, BethINI…) ne modifie plus le fichier du staging.
 *  - Exige macOS et le même volume APFS pour le staging et le jeu. Priorité 6 : le lien physique
 *    reste la méthode par défaut, celle-ci se choisit dans Paramètres › Mods.
 *  - Reconnaissance d'un fichier déployé : même taille et même date de modification qu'un fichier du
 *    staging au même chemin relatif (la date de l'original est recopiée sur le clone).
 */
import * as nodeFs from "node:fs";
import * as path from "path";

import { getErrorCode, unknownToError } from "@vortex/shared";
import PromiseBB from "bluebird";
import type { TFunction } from "i18next";

import { log } from "../../logging";
import type { IExtensionApi, IExtensionContext } from "../../types/IExtensionContext";
import type { IGame } from "../../types/IGame";
import type { IState } from "../../types/IState";
import * as fs from "../../util/fs";
import { installPathForGame } from "../../util/selectors";
import walk from "../../util/walk";
import type { IDiscoveryResult } from "../gamemode_management/types/IDiscoveryResult";
import { getGame } from "../gamemode_management/util/getGame";
import LinkingDeployment from "../mod_management/LinkingDeployment";
import type {
  IDeploymentMethod,
  IUnavailableReason,
} from "../mod_management/types/IDeploymentMethod";

const CLONE = nodeFs.constants.COPYFILE_FICLONE;
/** f_type de statfs pour APFS */
const APFS_TYPE = 26;

/** clone puis recopie la date de l'original, qui sert à reconnaître le fichier déployé */
async function cloneFile(sourcePath: string, linkPath: string): Promise<void> {
  await nodeFs.promises.copyFile(sourcePath, linkPath, CLONE);
  const stats = await nodeFs.promises.stat(sourcePath);
  await nodeFs.promises.utimes(linkPath, stats.atime, stats.mtime);
}

/** clé d'un fichier : chemin relatif (casse ignorée, comme APFS) et taille */
export function cloneKey(relPath: string, size: number): string {
  return `${relPath.toLowerCase()}|${size}`;
}

/**
 * même date à moins d'une seconde près. La date recopiée sur le clone est arrondie à la
 * milliseconde (886,9996 s devient 887,000 s) : comparer des secondes tronquées signalait
 * à tort des fichiers modifiés et en laissait au retrait.
 */
export function sameTime(aMs: number, bMs: number): boolean {
  return Math.abs(aMs - bMs) < 1000;
}

/** même fichier qu'à son déploiement : même taille, même date */
export function sameAsSource(link: fs.Stats, source: fs.Stats): boolean {
  return link.size === source.size && sameTime(link.mtimeMs, source.mtimeMs);
}

class DeploymentMethod extends LinkingDeployment {
  public priority: number = 6;

  constructor(api: IExtensionApi) {
    super(
      "clone_activator",
      "APFS Clone Deployment",
      "Deploys mods as APFS clones: no extra disk space, and edits to deployed files leave your staging folder untouched.",
      true,
      api,
    );
  }

  public detailedDescription(t: TFunction): string {
    return t(
      "APFS clones share their data with the original file until one of them is modified.\n" +
        "Advantages:\n" +
        " - no extra disk space, like hard links\n" +
        " - a tool that edits a deployed file (xEdit, BethINI) does not change the file in the staging folder\n" +
        "Disadvantages:\n" +
        " - macOS only, mods have to be on the same APFS volume as the game\n" +
        " - deploying is a little slower than with hard links",
    );
  }

  public isSupported(state: IState, gameId: string, typeId: string): IUnavailableReason {
    if (process.platform !== "darwin") {
      return { description: (t) => t("APFS clones are only available on macOS.") };
    }
    const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameId];
    if (discovery?.path == null) {
      return { description: (t) => t("Game not discovered.") };
    }
    const game: IGame = getGame(gameId);
    const modPaths = game.getModPaths(discovery.path);
    if (modPaths[typeId] === undefined) {
      return undefined;
    }
    const installationPath = installPathForGame(state, gameId);
    try {
      if (fs.statSync(installationPath).dev !== fs.statSync(modPaths[typeId]).dev) {
        return {
          description: (t) => t("Works only if mods are installed on the same drive as the game."),
          order: 5,
          solution: (t) =>
            t(
              "Please go to Settings->Mods and set the mod staging folder to be on the same drive as the game.",
            ),
        };
      }
    } catch (err) {
      log("info", "clone deployment: failed to stat, directory missing?", {
        err: unknownToError(err).message,
      });
      return {
        description: (t) => t("Game not fully initialized yet, this should disappear soon."),
      };
    }

    // le clone n'existe que sur APFS ; ailleurs copyFile ferait une copie complète
    try {
      if (nodeFs.statfsSync(modPaths[typeId]).type !== APFS_TYPE) {
        return { description: (t) => t("Filesystem doesn't support APFS clones.") };
      }
    } catch {
      return {
        description: (t) => t("Game not fully initialized yet, this should disappear soon."),
      };
    }
    return undefined;
  }

  protected linkFile(linkPath: string, sourcePath: string, dirTags?: boolean): Promise<void> {
    return this.ensureDir(path.dirname(linkPath), dirTags)
      .then(() => cloneFile(sourcePath, linkPath))
      .catch((err: unknown) =>
        getErrorCode(err) !== "EEXIST"
          ? Promise.reject(unknownToError(err))
          : fs.removeAsync(linkPath).then(() => cloneFile(sourcePath, linkPath)),
      );
  }

  protected unlinkFile(linkPath: string): PromiseBB<void> {
    return fs.unlinkAsync(linkPath);
  }

  protected isLink(
    linkPath: string,
    sourcePath: string,
    linkStatsIn: fs.Stats,
    sourceStatsIn: fs.Stats,
  ): PromiseBB<boolean> {
    if (linkStatsIn !== undefined && sourceStatsIn !== undefined) {
      return PromiseBB.resolve(sameAsSource(linkStatsIn, sourceStatsIn));
    }
    return PromiseBB.all([fs.statAsync(linkPath), fs.statAsync(sourcePath)])
      .then(([link, source]) => sameAsSource(link, source))
      .catch((err) =>
        getErrorCode(err) === "ENOENT"
          ? PromiseBB.resolve(false)
          : PromiseBB.reject(unknownToError(err)),
      );
  }

  /**
   * Retire du dossier du jeu les fichiers identiques (chemin, taille, date) à un fichier du staging.
   * Un fichier modifié après déploiement n'est pas retiré : il n'est plus le clone d'un mod.
   */
  protected purgeLinks(installPath: string, dataPath: string): PromiseBB<void> {
    // clé chemin+taille → dates des fichiers du staging qui la portent
    const staged = new Map<string, number[]>();
    return PromiseBB.resolve(
      walk(installPath, (iterPath: string, stats: fs.Stats) => {
        if (stats.isFile()) {
          // <staging>/<mod>/<chemin relatif>
          const rel = path.relative(installPath, iterPath).split(path.sep).slice(1).join(path.sep);
          if (rel.length > 0) {
            const key = cloneKey(rel, stats.size);
            staged.set(key, [...(staged.get(key) ?? []), stats.mtimeMs]);
          }
        }
        return PromiseBB.resolve();
      }),
    )
      .then(() =>
        walk(dataPath, (iterPath: string, stats: fs.Stats) => {
          if (!stats.isFile()) {
            return PromiseBB.resolve();
          }
          const rel = path.relative(dataPath, iterPath);
          const times = staged.get(cloneKey(rel, stats.size)) ?? [];
          if (!times.some((mtimeMs) => sameTime(mtimeMs, stats.mtimeMs))) {
            return PromiseBB.resolve();
          }
          return fs
            .unlinkAsync(iterPath)
            .catch((err) =>
              log("warn", "failed to remove clone", { iterPath, error: err.message }),
            );
        }),
      )
      .then(() => undefined);
  }

  protected canRestore(): boolean {
    return true;
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerDeploymentMethod: (method: IDeploymentMethod) => void;
}

function init(context: IExtensionContextEx): boolean {
  context.registerDeploymentMethod(new DeploymentMethod(context.api));
  return true;
}

export default init;
