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
 *  - csBuild (Community Shaders d'origine) → « Remplacer par Bottled Shaders » : activer Bottled s'il
 *                                est installé (en désactivant le Community Shaders d'origine et ses
 *                                modules), sinon l'installer avec la collection qui l'apporte (règles
 *                                échangées, installation relancée) ou ouvrir sa page Nexus ; au
 *                                choix, les réglages de Community Shaders de la collection ;
 *                                « Revenir au Community Shaders de la collection » dans l'autre sens
 *  - csBuild / shaders         → activer Bottled Shaders s'il est installé mais désactivé ; sinon,
 *                                si la bouteille compile avec le compilateur de Wine, poser celui de
 *                                Microsoft (celui du .NET 8 Desktop, installé d'abord au besoin),
 *                                en gardant la copie de Wine
 *  - bridge                    → facultatif, rien à corriger
 */
import { readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import * as actions from "../../actions";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { SymbolName } from "../../ui/components/icon/Icon";
import { installDotnetRuntime } from "../../util/macos/bottleSetup";
import { type IDxmtCheck, fixDisplayTweaks, useDxmt } from "../../util/macos/dxmtChecks";
import { installNativeCompiler, nativeCompilerSource } from "../../util/macos/hlslCompiler";
import { ATTR_SAFETY_NET, isBottled, isStockPack } from "../collections/util/bottledSafetyNet";
import {
  applyBottledSettings,
  ATTR_SETTINGS_APPLIED,
  ATTR_SETTINGS_CHOICE,
  type BottledSettingsChoice,
} from "../collections/util/bottledSettings";
import {
  collectionsWithCommunityShaders,
  useBottledShaders,
  useStockCommunityShaders,
} from "../collections/util/bottledSwap";
import {
  ATTR_SUBSTITUTION,
  ATTR_SUBSTITUTION_OFF,
  BOTTLED_URL,
} from "../collections/util/macRenderSubstitution";
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
  /** la confirmation propose aussi les trois choix pour les réglages de Community Shaders */
  settingsChoice?: boolean;
  run: (settings?: BottledSettingsChoice) => Promise<IFixResult | undefined>;
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

    case "csBuild":
    case "shaders": {
      if (check.status !== "error" && check.status !== "warning") return undefined;
      const allMods: Record<string, IMod> = api.getState().persistent.mods[gameId] ?? {};
      const installed = Object.values(allMods).filter((mod) => mod.state === "installed");
      const enabled = (mod: IMod) => profile?.modState?.[mod.id]?.enabled === true;
      const bottledMod = installed.find(
        (mod) => isBottled(mod) || (/bottled/i.test(modName(mod)) && !isStockPack(mod)),
      );
      const stockEnabled = () => installed.filter((mod) => isStockPack(mod) && enabled(mod));
      if (bottledMod !== undefined && profile !== undefined && !enabled(bottledMod)) {
        return {
          label: "Enable Bottled Shaders",
          icon: "toggle_on",
          settingsChoice: true,
          confirm: {
            text: "mORTEX enables the mod {{mod}} in the profile {{profile}}; it is deployed with your other mods. The original Community Shaders and its feature mods, which Bottled Shaders replaces, are disabled. Launch the game once, then check the installation again.",
            replace: { mod: modName(bottledMod), profile: profile.name },
          },
          run: async (choice) => {
            const stock = stockEnabled();
            await setModsEnabled(api, profile.id, [bottledMod.id], true);
            if (stock.length > 0) {
              await setModsEnabled(
                api,
                profile.id,
                stock.map((mod) => mod.id),
                false,
              );
            }
            const undoSettings =
              choice === undefined ? undefined : await applyBottledSettings(gamePath, choice);
            return {
              text: "Bottled Shaders enabled: it is deployed with your mods",
              undo: async () => {
                await setModsEnabled(api, profile.id, [bottledMod.id], false);
                if (stock.length > 0) {
                  await setModsEnabled(
                    api,
                    profile.id,
                    stock.map((mod) => mod.id),
                    true,
                  );
                }
                await undoSettings?.();
              },
            };
          },
        };
      }
      if (check.id === "csBuild" && bottledMod === undefined && profile !== undefined) {
        return {
          label: "Replace with Bottled Shaders",
          icon: "swap_horiz",
          settingsChoice: true,
          confirm: {
            text: "Bottled Shaders is the version of Community Shaders made for CrossOver; it already includes the feature mods (Grass Collision, Screen Space GI, Skylighting…). If a collection brought the original Community Shaders, mORTEX swaps it for Bottled Shaders in that collection and starts its installation again: only Bottled Shaders is downloaded from Nexus Mods (with a free account you click Download on its page). The original Community Shaders and its feature mods are disabled once Bottled Shaders is installed, never deleted. Otherwise mORTEX opens the page of Bottled Shaders.",
          },
          run: async (choice) => {
            const collections = await collectionsWithCommunityShaders(api, gameId);
            if (collections.length === 0) {
              window.api.shell.openUrl(BOTTLED_URL);
              return {
                text: "The page of Bottled Shaders is open: download and install it, then check the installation again",
              };
            }
            for (const collection of collections) {
              await useBottledShaders(api, gameId, collection.id);
              api.store.dispatch(
                actions.setModAttributes(gameId, collection.id, {
                  // le filet repasse, et les réglages choisis s'appliquent une fois Bottled installé
                  [ATTR_SAFETY_NET]: undefined,
                  [ATTR_SETTINGS_CHOICE]: choice ?? "keep",
                  [ATTR_SETTINGS_APPLIED]: false,
                }),
              );
              api.events.emit("resume-collection", gameId, collection.id);
            }
            return {
              text: "Bottled Shaders will be installed with the collection: follow the installation, launch the game once, then check again",
              undo: async () => {
                for (const collection of collections) {
                  await useStockCommunityShaders(api, gameId, collection.id);
                }
              },
            };
          },
        };
      }
      if (check.id !== "shaders" || check.shaders?.compiler !== "wine") return undefined;
      return {
        label: "Install Microsoft's shader compiler",
        icon: "build",
        confirm: {
          text: "Wine's own shader compiler can't compile Community Shaders. mORTEX puts Microsoft's compiler (D3DCompiler_47, signed by Microsoft) in this bottle and keeps Wine's copy, so you can undo. If .NET 8 isn't in the bottle yet, mORTEX first downloads Microsoft's .NET 8 Desktop Runtime (about 60 MB) from microsoft.com and installs it there; that part stays. Nothing else changes.",
        },
        run: async () => {
          let source = await nativeCompilerSource(bottlePath);
          if (source === undefined) {
            await installDotnetRuntime(bottlePath);
            source = await nativeCompilerSource(bottlePath);
          }
          if (source === undefined) {
            throw new Error("Microsoft's compiler was not found after installing .NET");
          }
          const undo = await installNativeCompiler(bottlePath, source);
          return {
            text: "Microsoft's shader compiler is installed. Launch the game once, then check the installation again.",
            undo,
          };
        },
      };
    }

    default:
      return undefined;
  }
}

/**
 * Correctifs supplémentaires d'un contrôle. « Revenir au Community Shaders de la collection » est
 * proposé quand mORTEX a remplacé Community Shaders par Bottled Shaders dans une collection.
 */
export function moreFixesFor(check: IDxmtCheck, context: IFixContext): IDxmtFix[] {
  if (check.id !== "csBuild" || check.status === "na") return [];
  const { api, gameId } = context;
  const profile = activeProfile(api.getState());
  const mods: Record<string, IMod> = api.getState().persistent.mods[gameId] ?? {};
  const substituted = Object.values(mods).filter(
    (mod) =>
      mod.attributes?.[ATTR_SUBSTITUTION] !== undefined &&
      mod.attributes?.[ATTR_SUBSTITUTION_OFF] !== true,
  );
  if (substituted.length === 0 || profile === undefined) return [];
  return [
    {
      label: "Revert to the Community Shaders of the collection",
      icon: "undo",
      confirm: {
        text: "mORTEX goes back to the Community Shaders chosen by the author of {{collections}}, and installs it again from Nexus Mods. Bottled Shaders is disabled, never deleted. The original Community Shaders doesn't work on a Mac: expect a red screen and shaders that fail to compile.",
        replace: { collections: substituted.map(modName).join(", ") },
      },
      run: async () => {
        for (const collection of substituted) {
          await useStockCommunityShaders(api, gameId, collection.id);
        }
        const bottled = Object.values(mods).filter(
          (mod) => mod.state === "installed" && isBottled(mod),
        );
        const enabledBottled = bottled.filter(
          (mod) => profile.modState?.[mod.id]?.enabled === true,
        );
        if (enabledBottled.length > 0) {
          await setModsEnabled(
            api,
            profile.id,
            enabledBottled.map((mod) => mod.id),
            false,
          );
        }
        for (const collection of substituted) {
          api.events.emit("resume-collection", gameId, collection.id);
        }
        return {
          text: "Back to the Community Shaders of the collection: follow its installation, then check again",
          undo: async () => {
            for (const collection of substituted) {
              await useBottledShaders(api, gameId, collection.id);
            }
            if (enabledBottled.length > 0) {
              await setModsEnabled(
                api,
                profile.id,
                enabledBottled.map((mod) => mod.id),
                true,
              );
            }
          },
        };
      },
    },
  ];
}
