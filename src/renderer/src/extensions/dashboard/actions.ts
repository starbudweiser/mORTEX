import safeCreateAction from "../../actions/safeCreateAction";

export const setLayout = safeCreateAction("SET_LAYOUT", (layout) => layout);

export const setDashletEnabled = safeCreateAction(
  "SET_WIDGET_ENABLED",
  (widgetId: string, enabled: boolean) => ({ widgetId, enabled }),
);

export const setDashletWidth = safeCreateAction(
  "SET_WIDGET_WIDTH",
  (widgetId: string, width: number) => ({ widgetId, width }),
);

export const setDashletHeight = safeCreateAction(
  "SET_WIDGET_HEIGHT",
  (widgetId: string, height: number) => ({ widgetId, height }),
);

/** positions et tailles (en cases) de toutes les cartes du tableau de bord */
export const setDashboardGrid = safeCreateAction(
  "SET_DASHBOARD_GRID",
  (grid: { [widgetId: string]: { x: number; y: number; w: number; h: number } }) => grid,
);
