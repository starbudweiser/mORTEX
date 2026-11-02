import { createAction } from "redux-act";

export const setSortAdded = createAction("SORT_COLLECTION_ADDED", (sorting: string) => ({
  sorting,
}));

export const setSortWorkshop = createAction("SORT_COLLECTION_WORKSHOP", (sorting: string) => ({
  sorting,
}));

export const setMacRenderSubstitution = createAction(
  "SET_MAC_RENDER_SUBSTITUTION",
  (enabled: boolean) => ({ enabled }),
);

/** que faire des réglages de Community Shaders de la collection : voir util/bottledSettings */
export const setBottledSettingsChoice = createAction(
  "SET_BOTTLED_SETTINGS_CHOICE",
  (choice: string) => ({ choice }),
);
