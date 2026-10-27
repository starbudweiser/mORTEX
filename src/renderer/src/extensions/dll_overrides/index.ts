/**
 * mORTEX (macOS) : overrides DLL automatiques (util/macos/dllOverrides). Après un déploiement ou
 * une purge, la bouteille du jeu reçoit l'override « native,builtin » des DLL de substitution
 * déposées par les mods, et perd ceux que mORTEX avait posés pour des DLL retirées.
 *
 * Différé de quelques secondes et un seul à la fois : `regedit` démarre la bouteille (jusqu'à
 * 15 s à froid), le déploiement n'attend pas.
 */
import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../../logging";
import type { IExtensionApi, IExtensionContext } from "../../types/IExtensionContext";
import { bottleForPath } from "../../util/macos/bottles";
import { syncDllOverrides } from "../../util/macos/dllOverrides";
import { discoveryByGame } from "../gamemode_management/selectors";
import { activeGameId } from "../profile_management/selectors";

const DELAY_MS = 3000;

function makeSync(api: IExtensionApi) {
  let timer: NodeJS.Timeout | undefined;
  let running = Promise.resolve();

  const sync = async () => {
    const gamePath = discoveryByGame(api.getState(), activeGameId(api.getState()))?.path;
    const bottle = gamePath !== undefined ? bottleForPath(gamePath) : undefined;
    if (bottle === undefined) return;
    try {
      const plan = await syncDllOverrides(bottle, gamePath);
      if (plan.add.length > 0) {
        log("info", "DLL overrides added", { bottle: bottle.name, dlls: plan.add });
        api.sendNotification?.({
          id: "dll-overrides-added",
          type: "success",
          message: "The bottle now loads the game's own {{dlls}}",
          replace: { dlls: plan.add.map((dll) => `${dll}.dll`).join(", ") },
          displayMS: 6000,
        });
      }
      if (plan.remove.length > 0) {
        log("info", "DLL overrides removed", { bottle: bottle.name, dlls: plan.remove });
      }
    } catch (err) {
      log("warn", "failed to update DLL overrides", { error: getErrorMessageOrDefault(err) });
      api.sendNotification?.({
        id: "dll-overrides-failed",
        type: "warning",
        message: "mORTEX couldn't update the bottle's DLL overrides",
      });
    }
  };

  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      running = running.then(sync);
    }, DELAY_MS);
    return Promise.resolve();
  };
}

function init(context: IExtensionContext): boolean {
  if (process.platform !== "darwin") return true;
  context.once(() => {
    const schedule = makeSync(context.api);
    context.api.onAsync("did-deploy", schedule);
    context.api.onAsync("did-purge", schedule);
  });
  return true;
}

export default init;
