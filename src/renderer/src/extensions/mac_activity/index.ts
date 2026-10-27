import { log } from "../../logging";
/**
 * mORTEX (macOS) : l'icône de la barre des menus montre l'activité (téléchargements,
 * installations, déploiement) et lance le jeu sans ouvrir la fenêtre ; le Dock porte une pastille
 * et une barre de progression. L'état est relu au plus une fois par seconde.
 *
 * Exécute aussi les actions des Raccourcis (liens mortex://, extension MortexIntents) :
 * « deploy », « sort », « snapshot », « profile:<nom> » ; « launch » est traité par GameActions,
 * comme le bouton LANCER.
 */
import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { discoveryByGame } from "../gamemode_management/selectors";
import { setNextProfile } from "../profile_management/actions/settings";
import { activeGameId } from "../profile_management/selectors";
import type { IProfile } from "../profile_management/types/IProfile";
import { takeSnapshot } from "../time_machine/timeMachineApi";
import { buildActivity } from "./activity";

const THROTTLE_MS = 1000;

function runShortcut(api: IExtensionApi, action: string): void {
  log("info", "shortcut action", { action });
  if (action === "deploy") {
    api.events.emit("deploy-mods", () => undefined, undefined, undefined, { manual: true });
  } else if (action === "sort") {
    api.events.emit("autosort-plugins", true, () => undefined);
  } else if (action === "snapshot") {
    takeSnapshot(api, "manual").catch((err) =>
      api.showErrorNotification?.("Failed to take a snapshot", err),
    );
  } else if (action.startsWith("profile:")) {
    const wanted = action.slice("profile:".length).trim().toLowerCase();
    const state = api.getState();
    const gameId = activeGameId(state);
    const profile = Object.values(state.persistent.profiles as Record<string, IProfile>).find(
      (candidate) => candidate.gameId === gameId && candidate.name.toLowerCase() === wanted,
    );
    if (profile === undefined) {
      api.sendNotification?.({
        type: "warning",
        message: "No profile named {{name}}",
        replace: { name: action.slice("profile:".length) },
        displayMS: 6000,
      });
    } else {
      api.store.dispatch(setNextProfile(profile.id));
    }
  }
}

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

    window.api.menu.onActivityAction((action) => runShortcut(api, action));

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
