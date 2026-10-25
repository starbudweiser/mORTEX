import { createAction } from "redux-act";

export const selectTheme = createAction<string, {}>("SELECT_UI_THEME");

export const setWatermark = createAction<string, {}>("SET_UI_WATERMARK");
export const markThemeMigrated = createAction<boolean, {}>("SET_UI_THEME_MIGRATED");
