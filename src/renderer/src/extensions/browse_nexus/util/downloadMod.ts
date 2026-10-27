/**
 * mORTEX : télécharge puis installe un mod trouvé dans l'onglet Mods du navigateur Nexus.
 *
 * Avec un seul fichier téléchargeable, il part tout de suite ; sinon une boîte demande lequel
 * (fichiers principaux d'abord). Premium : lien nxm traité comme un clic « Mod Manager Download »
 * sur le site, téléchargé et installé directement. Compte gratuit : le site s'ouvre sur ce
 * fichier, où Nexus impose son bouton de téléchargement lent.
 *
 * Interface :
 *  - downloadMod(api, mod, premium): Promise<void>
 */
import numeral from "numeral";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import {
  type INexusModFile,
  type INexusModSummary,
  type ModFileCategory,
  modFiles,
} from "./nexusMods";

const CATEGORY_LABELS: Record<ModFileCategory, string> = {
  MAIN: "Main file",
  OPTIONAL: "Optional file",
  UPDATE: "Update",
  MISCELLANEOUS: "Miscellaneous",
};

export function nxmFileUrl(mod: INexusModSummary, file: INexusModFile): string {
  return `nxm://${mod.gameDomain}/mods/${mod.modId}/files/${file.fileId}`;
}

export function filePageUrl(mod: INexusModSummary, file?: INexusModFile): string {
  const page = `https://www.nexusmods.com/${mod.gameDomain}/mods/${mod.modId}?tab=files`;
  return file === undefined ? page : `${page}&file_id=${file.fileId}`;
}

async function chooseFile(
  api: IExtensionApi,
  mod: INexusModSummary,
  files: INexusModFile[],
): Promise<INexusModFile | undefined> {
  if (files.length === 1) return files[0];
  const t = api.translate;
  const result = await api.showDialog(
    "question",
    t("Download {{name}}", { replace: { name: mod.name } }),
    {
      text: t("Which file do you want?"),
      choices: files.map((file, idx) => ({
        id: String(file.fileId),
        // beaucoup de noms contiennent déjà la version
        text:
          file.version && !file.name.includes(file.version)
            ? `${file.name} ${file.version}`
            : file.name,
        subText: `${t(CATEGORY_LABELS[file.category])} · ${numeral(file.size).format("0.0 b")}`,
        value: idx === 0,
      })),
    },
    [{ label: "Cancel" }, { label: "Download", default: true }],
  );
  if (result.action !== "Download") return undefined;
  const chosen = Object.keys(result.input).find((id) => result.input[id] === true);
  return files.find((file) => String(file.fileId) === chosen);
}

export async function downloadMod(
  api: IExtensionApi,
  mod: INexusModSummary,
  premium: boolean,
): Promise<void> {
  let files: INexusModFile[];
  try {
    files = await modFiles(mod.modId, mod.gameNumId);
  } catch (err) {
    api.showErrorNotification?.("Failed to read the files of this mod", err, {
      allowReport: false,
    });
    return;
  }
  if (files.length === 0) {
    api.sendNotification?.({
      type: "warning",
      message: "This mod has no file to download",
      displayMS: 5000,
    });
    return;
  }

  const file = await chooseFile(api, mod, files);
  if (file === undefined) return;

  if (!premium) {
    window.api.shell.openUrl(filePageUrl(mod, file));
    return;
  }

  log("info", "downloading mod from the Nexus browser", {
    modId: mod.modId,
    fileId: file.fileId,
  });
  // le même chemin qu'un lien nxm venu du site : téléchargement puis installation. Si
  // l'installation automatique est active, elle s'en charge déjà : la demander aussi
  // l'installerait deux fois.
  const autoInstall = api.getState().settings.automation?.install === true;
  api.events.emit("start-download-url", nxmFileUrl(mod, file), undefined, !autoInstall);
}
