import update from "immutability-helper";

import type { IReducerSpec } from "@/types/IExtensionContext";

import * as actions from "../actions/interface";

const MORTEX_LANGUAGES = ["fr", "en", "es", "it"];

/**
 * mORTEX : première langue préférée du système qui fait partie des quatre traduites
 * (« de, fr » donne le français), sinon l'anglais
 */
function systemLanguage(): string {
  const preferred: readonly string[] =
    typeof navigator !== "undefined" && (navigator.languages?.length ?? 0) > 0
      ? navigator.languages
      : [Intl.DateTimeFormat().resolvedOptions().locale];
  for (const language of preferred) {
    const base = language.split("-")[0].toLowerCase();
    if (MORTEX_LANGUAGES.includes(base)) return base;
  }
  return "en";
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
    [actions.setPresence as any]: (state, payload) =>
      update(state, { presence: { $set: payload } }),
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
    // mORTEX (macOS) : barre de menus seulement
    presence: "menubar",
    usage: {},
  },
};

export default settingsReducer;
