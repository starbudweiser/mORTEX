/**
 * mORTEX (macOS) : carte « Santé de la bouteille » du tableau de bord, visible quand le jeu actif
 * est dans une bouteille Wine.
 */
import type { IExtensionContext } from "../../types/IExtensionContext";
import { bottleForPath } from "../../util/macos/bottles";
import { discoveryByGame } from "../gamemode_management/selectors";
import { activeGameId } from "../profile_management/selectors";
import BottleHealthDashlet from "./BottleHealthDashlet";

function init(context: IExtensionContext): boolean {
  if (process.platform !== "darwin") return true;
  context.registerDashlet(
    "mORTEX bottle health",
    1,
    2,
    15,
    BottleHealthDashlet,
    (state) => {
      const gamePath = discoveryByGame(state, activeGameId(state))?.path;
      return gamePath !== undefined && bottleForPath(gamePath) !== undefined;
    },
    () => ({ api: context.api }),
    { fixed: false, closable: true },
  );
  return true;
}

export default init;
