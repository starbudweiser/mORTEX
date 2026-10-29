/**
 * mORTEX (macOS) : l'Éditeur de réglages, page exclusive au Mac pour Skyrim SE / AE. Il modifie les
 * INI de la bouteille (Skyrim.ini, SkyrimPrefs.ini, SkyrimCustom.ini) sans jamais les réécrire en
 * entier : voir util/macos/iniEdit.ts.
 */
import type { IExtensionContext } from "../../types/IExtensionContext";
import { activeGameId } from "../../util/selectors";
import SettingsEditorPage from "./SettingsEditorPage";

const GAMES = ["skyrimse"];

function init(context: IExtensionContext): boolean {
  context.registerMainPage("tune", "Settings editor", SettingsEditorPage, {
    priority: 66,
    group: "per-game",
    visible: () =>
      process.platform === "darwin" && GAMES.includes(activeGameId(context.api.getState())),
    props: () => ({ api: context.api }),
  });
  return true;
}

export default init;
