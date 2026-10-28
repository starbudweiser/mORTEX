/**
 * mORTEX : correctifs de l'Atelier DXMT, un par contrôle du bilan quand mORTEX sait le faire.
 * Simples, explicites et réversibles : chacun dit avant d'agir ce qui change (et ce qui ne change
 * pas), puis renvoie de quoi tout remettre comme avant (« Annuler » dans la notification).
 *
 *  - engine en erreur          → la bouteille passe sur DXMT (cxbottle.conf, copie gardée)
 *  - displayTweaks à revoir    → réglages DXMT dans SSEDisplayTweaks.ini (copie gardée)
 *  - displayTweaks absent      → activer le mod s'il est installé, sinon sa page Nexus
 *  - bottledDuplicates         → désactiver les mods qui déploient Terrain Helper / Inverse Square
 *                                Lighting autonomes (d'après le manifeste de déploiement)
 *  - bridge                    → facultatif, rien à corriger
 */
import { readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import type { IExtensionApi } from "../../types/IExtensionContext";
import type { SymbolName } from "../../ui/components/icon/Icon";
import { type IDxmtCheck, fixDisplayTweaks, useDxmt } from "../../util/macos/dxmtChecks";
import type { IMod } from "../mod_management/types/IMod";
import { getManifest } from "../mod_management/util/activationStore";
import { setModsEnabled } from "../profile_management/actions/profiles";
import { activeProfile } from "../profile_management/selectors";

/** SSE Display Tweaks sur Nexus Mods */
const DISPLAY_TWEAKS = {
  modId: 34705,
  url: "https://www.nexusmods.com/skyrimspecialedition/mods/34705",
};

export interface IFixText {
  /** clé à traduire */
  text: string;
  replace?: Record<string, string>;
}

export interface IFixResult extends IFixText {
  /** remet tout comme avant le correctif */
  undo?: () => Promise<void>;
}

export interface IDxmtFix {
  label: string;
  icon: SymbolName;
  /** ce qui va changer, montré avant d'agir ; absent pour une simple ouverture de page */
  confirm?: IFixText;
  run: () => Promise<IFixResult | undefined>;
}

export interface IFixContext {
  api: IExtensionApi;
  gameId: string;
  bottlePath: string;
  gamePath: string;
}

/** mods activés qui déploient l'un de ces fichiers (noms de DLL, sans tenir compte de la casse) */
export function modsDeploying(
  files: Array<{ relPath: string; source: string }>,
  dlls: string[],
  mods: Record<string, IMod>,
  enabled: (modId: string) => boolean,
): IMod[] {
  const wanted = new Set(dlls.map((dll) => dll.toLowerCase()));
  const sources = new Set(
    files
      .filter((file) => wanted.has(path.basename(file.relPath).toLowerCase()))
      .map((file) => file.source),
  );
  return Object.values(mods).filter((mod) => sources.has(mod.installationPath) && enabled(mod.id));
}

/** garde le contenu d'un fichier pour pouvoir le remettre tel quel */
async function keepCopy(file: string): Promise<() => Promise<void>> {
  const before = await readFile(file).catch(() => undefined);
  return async () => {
    if (before !== undefined) await writeFile(file, before);
  };
}

function displayTweaksMod(api: IExtensionApi, gameId: string): IMod | undefined {
  const mods: Record<string, IMod> = api.getState().persistent.mods[gameId] ?? {};
  return Object.values(mods).find(
    (mod) => Number(mod.attributes?.modId) === DISPLAY_TWEAKS.modId && mod.state === "installed",
  );
}

const modName = (mod: IMod) => mod.attributes?.name ?? mod.id;

export function fixFor(check: IDxmtCheck, context: IFixContext): IDxmtFix | undefined {
  const { api, gameId, bottlePath, gamePath } = context;
  const profile = activeProfile(api.getState());

  switch (check.id) {
    case "engine":
      if (check.status !== "error") return undefined;
      return {
        label: "Switch to DXMT",
        icon: "memory",
        confirm: {
          text: "mORTEX sets the graphics backend of the bottle to DXMT in its cxbottle.conf, instead of {{engine}}. It applies at the next launch of the game. Nothing else in the bottle changes.",
          replace: { engine: (check.found || "?").toUpperCase() },
        },
        run: async () => {
          const undo = await keepCopy(path.join(bottlePath, "cxbottle.conf"));
          await useDxmt(bottlePath);
          return { text: "The bottle now uses DXMT, from the next launch of the game", undo };
        },
      };

    case "displayTweaks": {
      if (check.status === "error" || check.status === "warning") {
        return {
          label: "Optimize for DXMT",
          icon: "build",
          confirm: {
            text: "mORTEX changes three lines of SSEDisplayTweaks.ini: SwapEffect = flip_discard, SwapBufferCount = 3 and VideoMemorySizeMb. Your other settings and comments stay as they are.",
          },
          run: async () => {
            const undo = await keepCopy(
              path.join(gamePath, "Data", "SKSE", "Plugins", "SSEDisplayTweaks.ini"),
            );
            await fixDisplayTweaks(gamePath);
            return { text: "SSE Display Tweaks optimized for DXMT", undo };
          },
        };
      }
      if (check.status !== "na") return undefined;
      const mod = displayTweaksMod(api, gameId);
      if (
        mod !== undefined &&
        profile !== undefined &&
        profile.modState?.[mod.id]?.enabled !== true
      ) {
        return {
          label: "Enable SSE Display Tweaks",
          icon: "toggle_on",
          confirm: {
            text: "mORTEX enables the mod {{mod}} in the profile {{profile}}; it is deployed with your other mods.",
            replace: { mod: modName(mod), profile: profile.name },
          },
          run: async () => {
            await setModsEnabled(api, profile.id, [mod.id], true);
            return {
              text: "SSE Display Tweaks enabled: it is deployed with your mods",
              undo: async () => {
                await setModsEnabled(api, profile.id, [mod.id], false);
              },
            };
          },
        };
      }
      if (mod !== undefined) return undefined;
      return {
        label: "Get SSE Display Tweaks",
        icon: "open_in_new",
        run: async () => {
          window.api.shell.openUrl(DISPLAY_TWEAKS.url);
          return undefined;
        },
      };
    }

    case "bottledDuplicates": {
      if (check.status !== "error" || profile === undefined) return undefined;
      const findCulprits = async () => {
        const manifest = await getManifest(api, "", gameId);
        return modsDeploying(
          manifest.files,
          (check.found ?? "").split(", ").filter((dll) => dll !== ""),
          api.getState().persistent.mods[gameId] ?? {},
          (modId) => profile.modState?.[modId]?.enabled === true,
        );
      };
      return {
        label: "Disable the duplicates",
        icon: "block",
        confirm: {
          text: "mORTEX disables, in the profile {{profile}}, the mods that install {{dlls}} on their own: Bottled Shaders already includes them. The mods stay installed and can be enabled again.",
          replace: { profile: profile.name, dlls: check.found ?? "" },
        },
        run: async () => {
          const culprits = await findCulprits();
          if (culprits.length === 0) {
            return { text: "These DLLs don't come from a mod: remove them from Data/SKSE/Plugins" };
          }
          const ids = culprits.map((mod) => mod.id);
          await setModsEnabled(api, profile.id, ids, false);
          return {
            text: "Disabled: {{mods}}",
            replace: { mods: culprits.map(modName).join(", ") },
            undo: async () => {
              await setModsEnabled(api, profile.id, ids, true);
            },
          };
        },
      };
    }

    default:
      return undefined;
  }
}
