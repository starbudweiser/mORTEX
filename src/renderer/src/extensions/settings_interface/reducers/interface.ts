import update from "immutability-helper";

import type { IReducerSpec } from "@/types/IExtensionContext";

import * as actions from "../actions/interface";

const MORTEX_LANGUAGES = ["fr", "en", "es", "it"];

/**
 * mORTEX : langue préférée du système si c'est l'une des quatre traduites, sinon l'anglais
 */
function systemLanguage(): string {
  const preferred =
    typeof navigator !== "undefined"
      ? navigator.languages?.[0]
      : Intl.DateTimeFormat().resolvedOptions().locale;
  const base = (preferred ?? "en").split("-")[0].toLowerCase();
  return MORTEX_LANGUAGES.includes(base) ? base : "en";
}

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setLanguage as any]: (state, payload) =>
      update(state, { language: { $set: payload } }),
    [actions.setAdvancedMode as any]: (state, payload) =>
      update(state, { advanced: { $set: payload.advanced } }),
    [actions.setProfilesVisible as any]: (state, payload) =>
      update(state, { profilesVisible: { $set: payload.visible } }),
    [actions.setDesktopNotifications as any]: (state, payload) =>
      update(state, { desktopNotifications: { $set: payload } }),
    [actions.setHideTopLevelCategory as any]: (state, payload) =>
      update(state, { hideTopLevelCategory: { $set: payload.hide } }),
    [actions.showUsageInstruction as any]: (state, payload) =>
      update(state, { usage: { [payload.usageId]: { $set: payload.show } } }),
    [actions.setRelativeTimes as any]: (state, payload) =>
      update(state, { relativeTimes: { $set: payload } }),
    [actions.setForegroundDL as any]: (state, payload) =>
      update(state, { foregroundDL: { $set: payload } }),
    [actions.setAlwaysCompactHeaders as any]: (state, payload) =>
      update(state, { alwaysCompactHeaders: { $set: payload } }),
    // Deliberately absent from the defaults below: unset means "follow the OS".
    [actions.setReduceMotion as any]: (state, payload) =>
      update(state, { reduceMotion: { $set: payload } }),
  },
  defaults: {
    language: systemLanguage(),
    advanced: false,
    profilesVisible: true,
    desktopNotifications: false,
    hideTopLevelCategory: false,
    relativeTimes: true,
    foregroundDL: true,
    alwaysCompactHeaders: false,
    usage: {},
  },
};

export default settingsReducer;
