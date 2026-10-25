import React from "react";

import type { IExtensionContext } from "../../types/IExtensionContext";
import { PluginAssistant } from "./PluginAssistant";

/**
 * mORTEX : l'Assistant. Explique, sans IA et sans réseau, ce qui se passe pour un plugin
 * (inspecteur Plugins) et pour un mod (fiche Mod, voir ModAssistant). Lecture seule.
 */
function init(context: IExtensionContext): boolean {
  context.registerTableAttribute("gamebryo-plugins", {
    id: "mortex_assistant",
    name: "Assistant",
    edit: {},
    // juste avant « LOOT Messages » (position 100 par défaut)
    position: 99,
    customRenderer: (plugin: any) => React.createElement(PluginAssistant, { plugin }),
    calc: (plugin: any) => plugin.id,
    placement: "detail",
    isVolatile: true,
  });
  return true;
}

export default init;
