import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";

const settingsReducer: types.IReducerSpec = {
  reducers: {
    [actions.selectTheme as any]: (state, payload) =>
      util.setSafe(state, ["currentTheme"], payload),
    [actions.setWatermark as any]: (state, payload) => util.setSafe(state, ["watermark"], payload),
    [actions.markThemeMigrated as any]: (state, payload) =>
      util.setSafe(state, ["themeMigrated"], payload),
  },
  defaults: {
    currentTheme: "socle",
    watermark: "center",
    themeMigrated: false,
  },
};

export default settingsReducer;
