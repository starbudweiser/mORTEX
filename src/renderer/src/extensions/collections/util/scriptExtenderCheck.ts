/**
 * Après l'installation d'une collection Skyrim SE, vérifie que SKSE et l'Address Library
 * correspondent à la version du jeu : une collection faite pour une autre version déploie souvent
 * un SKSE ou des fichiers d'adresses qui ne chargent pas, et le jeu plante au lancement.
 */
import * as path from "path";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import * as fs from "../../../util/fs";
import { discoveryByGame } from "../../gamemode_management/selectors";
import { getGame } from "../../gamemode_management/util/getGame";

export const SCRIPT_EXTENDER_GAMES = ["skyrimse"];

export interface IScriptExtenderIssue {
  key: string;
  params?: Record<string, string>;
}

/** « 1.6.1170.0 » → [1, 6, 1170]. */
function versionParts(version: string): number[] | undefined {
  const parts = version.split(".").map((part) => parseInt(part, 10));
  return parts.length >= 3 && parts.slice(0, 3).every((n) => !isNaN(n))
    ? parts.slice(0, 3)
    : undefined;
}

/** « skse64_1_6_1170.dll » → « 1.6.1170 ». */
const SKSE_RUNTIME = /^skse64_(\d+)_(\d+)_(\d+)\.dll$/i;
/** « versionlib-1-6-1170-0.bin » (1.6 et plus) ou « version-1-5-97-0.bin » (1.5). */
const ADDRESS_FILE = /^version(?:lib)?-(\d+)-(\d+)-(\d+)-\d+\.bin$/i;

/**
 * @param gameVersion version de SkyrimSE.exe
 * @param rootFiles fichiers du dossier du jeu
 * @param pluginFiles fichiers de Data/SKSE/Plugins
 */
export function checkScriptExtender(
  gameVersion: string,
  rootFiles: string[],
  pluginFiles: string[],
): IScriptExtenderIssue[] {
  const parts = versionParts(gameVersion);
  if (parts === undefined) {
    return [];
  }
  const game = parts.join(".");
  const issues: IScriptExtenderIssue[] = [];

  const runtimes = rootFiles
    .map((file) => SKSE_RUNTIME.exec(file))
    .filter((match) => match !== null)
    .map((match) => match.slice(1, 4).join("."));
  const hasLoader = rootFiles.some((file) => file.toLowerCase() === "skse64_loader.exe");
  const plugins = pluginFiles.filter((file) => file.toLowerCase().endsWith(".dll"));

  if (runtimes.length > 0 && !runtimes.includes(game)) {
    issues.push({
      key: "SKSE is made for Skyrim {{skse}}, but your game is version {{game}}. Skyrim will not start through SKSE: install the SKSE build for {{game}}.",
      params: { skse: runtimes.join(", "), game },
    });
  } else if (!hasLoader && runtimes.length === 0 && plugins.length > 0) {
    issues.push({
      key: "{{plugins}} SKSE plugins are installed, but SKSE is not in the game folder. Install SKSE for Skyrim {{game}}, or these mods will not load.",
      params: { plugins: String(plugins.length), game },
    });
  }

  if (plugins.length > 0) {
    const addresses = pluginFiles
      .map((file) => ADDRESS_FILE.exec(file))
      .filter((match) => match !== null)
      .map((match) => match.slice(1, 4).join("."));
    if (!addresses.includes(game)) {
      issues.push(
        addresses.length > 0
          ? {
              key: "The Address Library installed is for Skyrim {{found}}, not for your version {{game}}. Most SKSE plugins will not load: install the Address Library for {{game}}.",
              params: { found: addresses.join(", "), game },
            }
          : {
              key: "The Address Library for Skyrim {{game}} is missing. Most SKSE plugins need it to load.",
              params: { game },
            },
      );
    }
  }
  return issues;
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    return await fs.readdirAsync(dir);
  } catch {
    return [];
  }
}

/** Lit le dossier du jeu et prévient si SKSE ou l'Address Library ne correspondent pas. */
export async function warnScriptExtenderMismatch(
  api: IExtensionApi,
  gameId: string,
  collectionName: string,
): Promise<void> {
  if (!SCRIPT_EXTENDER_GAMES.includes(gameId)) {
    return;
  }
  const discovery = discoveryByGame(api.getState(), gameId);
  if (discovery?.path === undefined) {
    return;
  }
  try {
    const gameVersion = await getGame(gameId).getInstalledVersion(discovery);
    const issues = checkScriptExtender(
      gameVersion,
      await listFiles(discovery.path),
      await listFiles(path.join(discovery.path, "Data", "SKSE", "Plugins")),
    );
    if (issues.length === 0) {
      return;
    }
    const t = api.translate;
    api.sendNotification({
      id: `collection-script-extender-${gameId}`,
      type: "warning",
      title: "SKSE does not match your game version",
      message: t("After installing “{{collection}}”:", { replace: { collection: collectionName } }),
      actions: [
        {
          title: "More",
          action: () =>
            api.showDialog(
              "info",
              "SKSE does not match your game version",
              {
                text: [
                  t("Your game version: {{game}}", { replace: { game: gameVersion } }),
                  ...issues.map((issue) => t(issue.key, { replace: issue.params })),
                ].join("\n\n"),
                options: { translated: true },
              },
              [{ label: "Close" }],
            ),
        },
      ],
    });
  } catch (err) {
    log("warn", "Could not check SKSE against the game version", {
      error: (err as Error).message,
    });
  }
}
