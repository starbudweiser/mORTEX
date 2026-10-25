import safeCreateAction from "../../actions/safeCreateAction";
import type { IExtensionContext, IReducerSpec } from "../../types/IExtensionContext";
import { setSafe } from "../../util/storeHelper";
import { setLayout } from "../dashboard/actions";
import { activeGameId } from "../profile_management/selectors";
import CrashesDashlet from "./CrashesDashlet";
import { setCrashApi } from "./crashStore";

const DASHLET_ID = "mORTEX crashes";
const STATUS_DASHLET_ID = "mORTEX";

const markCrashesArranged = safeCreateAction(
  "MORTEX_CRASHES_ARRANGED",
  (arranged: boolean) => arranged,
);

const reducer: IReducerSpec = {
  reducers: {
    [markCrashesArranged as any]: (state, payload) => setSafe(state, ["arranged"], payload),
  },
  defaults: { arranged: false },
};

/**
 * mORTEX : le pont avec sKYCRASH. Lit les plantages analysés (export JSONL, côté main), les
 * rattache aux mods déployés et les montre dans l'Accueil et dans la fiche d'un mod.
 */
function init(context: IExtensionContext): boolean {
  setCrashApi(context.api);
  context.registerReducer(["settings", "mortexCrashes"], reducer);

  context.registerDashlet(
    DASHLET_ID,
    3,
    5,
    11,
    CrashesDashlet,
    (state) => activeGameId(state) !== undefined,
    undefined,
    { fixed: false, closable: true },
  );

  context.once(() => {
    const { store } = context.api;
    // Une seule fois : la carte vient juste après les cartes d'état (« Personnaliser le tableau
    // de bord » la déplace ensuite à volonté).
    if (store.getState().settings["mortexCrashes"]?.arranged) {
      return;
    }
    const layout: string[] = store.getState().settings.interface.dashboardLayout ?? [];
    const rest = layout.filter((id) => id !== DASHLET_ID);
    const at = rest.indexOf(STATUS_DASHLET_ID) + 1;
    store.dispatch(setLayout([...rest.slice(0, at), DASHLET_ID, ...rest.slice(at)]));
    store.dispatch(markCrashesArranged(true));
  });

  return true;
}

export default init;
