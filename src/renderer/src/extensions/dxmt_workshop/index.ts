/**
 * mORTEX (macOS) : l'Atelier DXMT, page exclusive au Mac pour Skyrim SE dans une bouteille
 * CrossOver (bilan de la bouteille, pièges du rendu sous DXMT et leurs solutions).
 */
import type { IExtensionContext } from "../../types/IExtensionContext";
import { activeGameId } from "../../util/selectors";
import DxmtWorkshopPage from "./DxmtWorkshopPage";

const GAMES = ["skyrimse"];

function init(context: IExtensionContext): boolean {
  context.registerMainPage("memory", "DXMT workshop", DxmtWorkshopPage, {
    priority: 65,
    group: "per-game",
    visible: () =>
      process.platform === "darwin" && GAMES.includes(activeGameId(context.api.getState())),
    props: () => ({ api: context.api }),
  });
  return true;
}

export default init;
