import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/settings";

const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setSortAdded as any]: (state, payload) => {
      const { sorting } = payload;
      return setSafe(state, ["sortAdded"], sorting);
    },
    [actions.setSortWorkshop as any]: (state, payload) => {
      const { sorting } = payload;
      return setSafe(state, ["sortWorkshop"], sorting);
    },
    [actions.setMacRenderSubstitution as any]: (state, payload) => {
      return setSafe(state, ["macRenderSubstitution"], payload.enabled);
    },
    [actions.setBottledSettingsChoice as any]: (state, payload) => {
      return setSafe(state, ["bottledSettingsChoice"], payload.choice);
    },
  },
  defaults: {
    sortAdded: "datedownloaded",
    sortWorkshop: "recentlyupdated",
    // mORTEX (macOS) : Bottled Shaders remplace Community Shaders dans les collections
    macRenderSubstitution: true,
    // « mortex » : réglages pour DXMT ; « keep » : ceux de la collection ; « default » : ceux de Bottled
    bottledSettingsChoice: "mortex",
  },
};

export default settingsReducer;
