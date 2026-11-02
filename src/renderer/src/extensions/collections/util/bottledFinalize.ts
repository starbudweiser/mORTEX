import { getErrorMessageOrDefault } from "@vortex/shared";

/**
 * mORTEX (macOS) : ce qui suit l'installation d'une collection où Bottled Shaders a pris la place de
 * Community Shaders (trace `mortexSubstitution` sur le mod de collection) :
 *  - le filet : désactiver les mods que Bottled rend inutiles (util/bottledSafetyNet)
 *  - le choix des réglages de Community Shaders fait dans le dialogue de départ, appliqué une fois
 *    (util/bottledSettings)
 */
import { setModAttribute } from "../../../actions";
import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { discoveryByGame } from "../../gamemode_management/selectors";
import type { IMod } from "../../mod_management/types/IMod";
import { runSafetyNet } from "./bottledSafetyNet";
import {
  applyBottledSettings,
  ATTR_SETTINGS_APPLIED,
  ATTR_SETTINGS_CHOICE,
  isBottledSettingsChoice,
} from "./bottledSettings";
import { ATTR_SUBSTITUTION, ATTR_SUBSTITUTION_OFF, BOTTLED_MOD_ID } from "./macRenderSubstitution";

export async function finalizeBottled(
  api: IExtensionApi,
  gameId: string,
  collectionModId: string,
): Promise<void> {
  const state = api.getState();
  const mods: Record<string, IMod> = state.persistent.mods[gameId] ?? {};
  const collection = mods[collectionModId];
  if (collection?.attributes?.[ATTR_SUBSTITUTION] === undefined) return;
  // le joueur a demandé le Community Shaders de la collection : on n'y touche pas
  if (collection.attributes[ATTR_SUBSTITUTION_OFF] === true) return;

  try {
    await runSafetyNet(api, gameId, collection);
  } catch (err) {
    log("warn", "Bottled Shaders safety net failed", { error: getErrorMessageOrDefault(err) });
  }

  try {
    const choice = collection.attributes[ATTR_SETTINGS_CHOICE];
    const bottledInstalled = Object.values(mods).some(
      (mod) => mod.state === "installed" && Number(mod.attributes?.modId) === BOTTLED_MOD_ID,
    );
    const gamePath = discoveryByGame(state, gameId)?.path;
    if (
      collection.attributes[ATTR_SETTINGS_APPLIED] !== true &&
      isBottledSettingsChoice(choice) &&
      bottledInstalled &&
      gamePath !== undefined
    ) {
      await applyBottledSettings(gamePath, choice);
      api.store.dispatch(setModAttribute(gameId, collectionModId, ATTR_SETTINGS_APPLIED, true));
    }
  } catch (err) {
    log("warn", "Bottled Shaders settings could not be applied", {
      error: getErrorMessageOrDefault(err),
    });
  }
}
