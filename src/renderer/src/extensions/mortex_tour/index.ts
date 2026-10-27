/**
 * mORTEX : visite guidée de l'appli (TourOverlay), en 4 langues avec la voix. Elle démarre seule au
 * premier lancement où un jeu est géré, puis depuis le menu Aide.
 */
import safeCreateAction from "../../actions/safeCreateAction";
import type { IExtensionContext, IReducerSpec } from "../../types/IExtensionContext";
import { setSafe } from "../../util/storeHelper";
import { activeGameId } from "../profile_management/selectors";
import TourOverlay, { START_EVENT } from "./TourOverlay";

const FIRST_DELAY_MS = 5000;

const markTourSeen = safeCreateAction("MORTEX_TOUR_SEEN", (seen: boolean) => seen);

const reducer: IReducerSpec = {
  reducers: {
    [markTourSeen as any]: (state, payload) => setSafe(state, ["seen"], payload),
  },
  defaults: { seen: false },
};

function init(context: IExtensionContext): boolean {
  context.registerReducer(["settings", "mortexTour"], reducer);
  context.registerOverlay("mortex-tour", TourOverlay, () => ({ api: context.api }));

  context.once(() => {
    const { api } = context;
    setTimeout(() => {
      const state = api.getState();
      if ((state.settings as any).mortexTour?.seen === true || activeGameId(state) === undefined) {
        return;
      }
      api.store.dispatch(markTourSeen(true));
      api.events.emit(START_EVENT);
    }, FIRST_DELAY_MS);
  });
  return true;
}

export default init;
