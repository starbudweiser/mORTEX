import safeCreateAction from "../../actions/safeCreateAction";
import type { IExtensionContext, IReducerSpec } from "../../types/IExtensionContext";
import { setSafe } from "../../util/storeHelper";
import { setDashletEnabled, setLayout } from "../dashboard/actions";
import { activeGameId } from "../profile_management/selectors";
import { menuOrderReducers } from "./menuOrder";
import MortexStatusDashlet from "./MortexStatusDashlet";

const DASHLET_ID = "mORTEX";

const markDashboardArranged = safeCreateAction(
  "MORTEX_DASHBOARD_ARRANGED",
  (arranged: boolean) => arranged,
);

const reducer: IReducerSpec = {
  reducers: {
    [markDashboardArranged as any]: (state, payload) =>
      setSafe(state, ["dashboardArranged"], payload),
    ...menuOrderReducers,
  },
  defaults: { dashboardArranged: false },
};

function init(context: IExtensionContext): boolean {
  context.registerReducer(["settings", "mortex"], reducer);

  // En tête du tableau de bord, sur toute la largeur, dès qu'un jeu est géré.
  context.registerDashlet(
    DASHLET_ID,
    3,
    2,
    10,
    MortexStatusDashlet,
    (state) => activeGameId(state) !== undefined,
    undefined,
    { fixed: false, closable: true },
  );

  context.once(() => {
    const { store } = context.api;
    // Une seule fois : les cartes mORTEX passent en tête et les fils d'actualité Nexus sont
    // masqués (« Personnaliser le tableau de bord » les remet).
    if (store.getState().settings.mortex?.dashboardArranged) {
      return;
    }
    const layout: string[] = store.getState().settings.interface.dashboardLayout ?? [];
    store.dispatch(setLayout([DASHLET_ID, ...layout.filter((id) => id !== DASHLET_ID)]));
    store.dispatch(setDashletEnabled("News", false));
    store.dispatch(setDashletEnabled("Latest Mods", false));
    store.dispatch(markDashboardArranged(true));
  });

  return true;
}

export default init;
