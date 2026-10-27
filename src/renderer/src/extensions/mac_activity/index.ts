/**
 * mORTEX (macOS) : l'icône de la barre des menus montre l'activité (téléchargements,
 * installations, déploiement) et lance le jeu sans ouvrir la fenêtre ; le Dock porte une pastille
 * et une barre de progression. L'état est relu au plus une fois par seconde.
 */
import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { discoveryByGame } from "../gamemode_management/selectors";
import { activeGameId } from "../profile_management/selectors";
import { buildActivity } from "./activity";

const THROTTLE_MS = 1000;

function init(context: IExtensionContext): boolean {
  if (process.platform !== "darwin") return true;

  context.once(() => {
    const { api } = context;
    const t = (text: string, options?: { replace?: Record<string, unknown> }) =>
      api.translate(text, { ns: "common", ...options });

    let timer: NodeJS.Timeout | undefined;
    const publish = () => {
      timer = undefined;
      const state: IState = api.getState();
      const gameId = activeGameId(state);
      const game = state.session.gameMode.known.find((known) => known.id === gameId);
      window.api.menu.setActivity(
        buildActivity(
          {
            downloads: state.persistent.downloads.files,
            notifications: state.session.notifications.notifications,
            gameName: game?.name,
            canLaunch:
              discoveryByGame(state, gameId)?.path !== undefined &&
              Object.keys(state.session.base.toolsRunning ?? {}).length === 0,
          },
          t,
        ),
      );
    };

    publish();
    api.store.subscribe(() => {
      if (timer === undefined) timer = setTimeout(publish, THROTTLE_MS);
    });
    // la langue peut changer : les libellés suivent
    api.events.on("language-changed", publish);
  });
  return true;
}

export default init;
