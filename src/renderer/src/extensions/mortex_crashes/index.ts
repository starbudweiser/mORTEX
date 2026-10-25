import type { IExtensionContext } from "../../types/IExtensionContext";
import { activeGameId } from "../profile_management/selectors";
import CrashesDashlet from "./CrashesDashlet";
import { setCrashApi } from "./crashStore";

/**
 * mORTEX : le pont avec sKYCRASH. Lit les plantages analysés (export JSONL, côté main), les
 * rattache aux mods déployés et les montre dans l'Accueil et dans la fiche d'un mod.
 */
function init(context: IExtensionContext): boolean {
  setCrashApi(context.api);

  context.registerDashlet(
    "mORTEX crashes",
    3,
    2,
    11,
    CrashesDashlet,
    (state) => activeGameId(state) !== undefined,
    undefined,
    { fixed: false, closable: true },
  );

  return true;
}

export default init;
