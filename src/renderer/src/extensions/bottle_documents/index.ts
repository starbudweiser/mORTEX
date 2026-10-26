/**
 * mORTEX (macOS) : avertit quand la bouteille du jeu partage ses Documents avec le Mac (et donc
 * avec toutes les autres bouteilles), et propose de lui donner son propre dossier.
 *
 * Contrôle « bottle-shared-documents » (à l'activation du jeu) : bouton « Corriger » qui copie
 * `My Games/<dossier du jeu>` dans un vrai dossier Documents de la bouteille
 * (util/macos/bottleDocuments). Une notification permet ensuite d'annuler.
 */
import * as path from "node:path";

import { getErrorMessageOrDefault } from "@vortex/shared";
import Bluebird from "bluebird";

import { log } from "../../logging";
import type { IExtensionApi, IExtensionContext } from "../../types/IExtensionContext";
import type { ITestResult } from "../../types/ITestResult";
import getVortexPath from "../../util/getVortexPath";
import {
  isolateDocuments,
  restoreSharedDocuments,
  sharedDocumentsTarget,
} from "../../util/macos/bottleDocuments";
import { discoveryByGame } from "../gamemode_management/selectors";
import { iniFiles } from "../ini_prep/gameSupport";
import { activeGameId } from "../profile_management/selectors";

/** dossiers de `My Games` où le jeu actif range ses INI (et ses sauvegardes) */
function gameFolders(api: IExtensionApi, gameId: string): string[] {
  const discovery = discoveryByGame(api.getState(), gameId);
  if (discovery?.path === undefined) return [];
  const myGames = path.join(getVortexPath("documents"), "My Games");
  const folders = iniFiles(gameId, discovery)
    .map((file) => path.relative(myGames, path.dirname(file)).split(path.sep)[0])
    .filter((folder) => folder !== "" && !folder.startsWith(".."));
  return [...new Set(folders)];
}

async function isolate(api: IExtensionApi, gameId: string): Promise<void> {
  const documents = getVortexPath("documents");
  try {
    await isolateDocuments(documents, gameFolders(api, gameId));
  } catch (err) {
    api.showErrorNotification?.("Failed to give the bottle its own Documents folder", err, {
      allowReport: false,
    });
    return;
  }
  log("info", "bottle Documents isolated", { documents });
  api.sendNotification({
    id: "bottle-documents-isolated",
    type: "success",
    message: "This bottle now has its own Documents folder",
    actions: [
      {
        title: "Undo",
        action: (dismiss) => {
          restoreSharedDocuments(documents)
            .then((kept) => log("info", "bottle Documents shared again", { kept }))
            .catch((err) =>
              log("warn", "failed to restore shared Documents", {
                error: getErrorMessageOrDefault(err),
              }),
            )
            .finally(dismiss);
        },
      },
    ],
  });
}

function checkSharedDocuments(api: IExtensionApi): Bluebird<ITestResult | undefined> {
  if (process.platform !== "darwin") return Bluebird.resolve(undefined);
  const documents = getVortexPath("documents");
  // seules les bouteilles (drive_c/users/<u>/Documents) sont concernées
  if (!documents.includes(`${path.sep}drive_c${path.sep}users${path.sep}`)) {
    return Bluebird.resolve(undefined);
  }
  const gameId = activeGameId(api.getState());
  return Bluebird.resolve(sharedDocumentsTarget(documents)).then((target) =>
    target === undefined || gameId === undefined
      ? undefined
      : {
          description: {
            short: "This bottle shares its game settings and saves with your other bottles",
            long:
              "The Documents folder of this bottle is a link to your Mac's Documents folder " +
              "({{target}}), as CrossOver sets it up. Every bottle therefore uses the same " +
              "My Games folder: an INI change made for this game, by mORTEX or a mod, also " +
              "applies to your other bottles, and they share the same saves.\n\n" +
              "Fix gives this bottle its own Documents folder and copies this game's My Games " +
              "folder into it. Nothing is removed from your Mac's Documents, and you can undo it.",
            replace: { target },
          },
          severity: "warning",
          automaticFix: () => isolate(api, gameId),
        },
  );
}

function init(context: IExtensionContext): boolean {
  context.registerTest("bottle-shared-documents", "gamemode-activated", () =>
    checkSharedDocuments(context.api),
  );
  return true;
}

export default init;
