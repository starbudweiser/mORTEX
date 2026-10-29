/**
 * mORTEX : le « m » du nom de l'appli en orange Vortex dans tous les textes (util/brandHighlight),
 * et le nom des collections installées en bleu Socle (util/collectionHighlight).
 */
import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { startBrandHighlight } from "../../util/brandHighlight";
import { startCollectionHighlight } from "../../util/collectionHighlight";
import renderModName from "../mod_management/util/modName";
import { activeGameId } from "../profile_management/selectors";

function init(context: IExtensionContext): boolean {
  context.once(() => {
    startBrandHighlight();
    startCollectionHighlight(() => {
      const state: IState = context.api.getState();
      return Object.values(state.persistent.mods[activeGameId(state)] ?? {})
        .filter((mod) => mod.type === "collection" && mod.state === "installed")
        .map((mod) => renderModName(mod));
    });
  });
  return true;
}

export default init;
