import safeCreateAction from "../../actions/safeCreateAction";
import type { IExtensionContext, IReducerSpec } from "../../types/IExtensionContext";
import { setSafe } from "../../util/storeHelper";
import { setDashletEnabled, setLayout } from "../dashboard/actions";
import { discoveryByGame } from "../gamemode_management/selectors";
import { activeGameId } from "../profile_management/selectors";
import BottleSetupDashlet from "./BottleSetupDashlet";
import { menuOrderReducers } from "./menuOrder";
import MortexStatusDashlet from "./MortexStatusDashlet";

const DASHLET_ID = "mORTEX";
const BOTTLE_DASHLET_ID = "mORTEX bottle setup";

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

/** cartes de Vortex, masquées par défaut */
const INHERITED_DASHLETS = [
  "News",
  "Latest Mods",
  "Onboarding",
  "ToDo List",
  "Tools",
  "Recently Managed",
  "Extensions",
  "Changelog",
  "Go Premium",
  "Nexus Mods Account Banner",
];

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

  // Tant qu'aucun Skyrim n'est trouvé : disparaît dès que le jeu est détecté.
  context.registerDashlet(
    BOTTLE_DASHLET_ID,
    3,
    2,
    5,
    BottleSetupDashlet,
    (state) =>
      process.platform === "darwin" && discoveryByGame(state, "skyrimse")?.path === undefined,
    undefined,
    { fixed: false, closable: true },
  );

  context.once(() => {
    const { store } = context.api;
    // Une seule fois : les cartes mORTEX passent en tête et toutes les cartes héritées de Vortex
    // (actualités, vidéos d'initiation, extensions, bannières Nexus…) sont masquées : le tableau
    // de bord par défaut ne garde que les modules de mORTEX (« Personnaliser le tableau de bord »
    // les remet).
    if (store.getState().settings.mortex?.dashboardArranged) {
      return;
    }
    const layout: string[] = store.getState().settings.interface.dashboardLayout ?? [];
    const first = [BOTTLE_DASHLET_ID, DASHLET_ID];
    store.dispatch(setLayout([...first, ...layout.filter((id) => !first.includes(id))]));
    for (const id of INHERITED_DASHLETS) {
      store.dispatch(setDashletEnabled(id, false));
    }
    store.dispatch(markDashboardArranged(true));
  });

  return true;
}

export default init;
