/**
 * mORTEX : le « m » du nom de l'appli en orange Vortex dans tous les textes (util/brandHighlight).
 */
import type { IExtensionContext } from "../../types/IExtensionContext";
import { startBrandHighlight } from "../../util/brandHighlight";

function init(context: IExtensionContext): boolean {
  context.once(() => {
    startBrandHighlight();
  });
  return true;
}

export default init;
