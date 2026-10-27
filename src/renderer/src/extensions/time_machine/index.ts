/**
 * mORTEX (macOS) : machine à remonter le temps du modding. Un instantané APFS (Data, mods,
 * ordre de chargement, INI) est pris juste avant chaque déploiement, au plus un toutes les
 * 10 minutes, et à la demande ; la page « Time Machine » les montre sur une frise
 * et les restaure. Conservation façon Time Machine (util/macos/timeMachine).
 */
import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../../logging";
import type { IExtensionContext } from "../../types/IExtensionContext";
import { listSnapshots } from "../../util/macos/timeMachine";
import { isRestoring, takeSnapshot, timeMachineContext } from "./timeMachineApi";
import TimeMachinePage from "./TimeMachinePage";

const MIN_INTERVAL_MS = 10 * 60 * 1000;

function init(context: IExtensionContext): boolean {
  if (process.platform !== "darwin") return true;
  const { api } = context;

  context.registerMainPage("history", "Time Machine", TimeMachinePage, {
    priority: 66,
    group: "per-game",
    visible: () => timeMachineContext(api) !== undefined,
    props: () => ({ api }),
  });

  context.once(() => {
    api.onAsync("will-deploy", async () => {
      if (isRestoring()) return;
      const tm = timeMachineContext(api);
      if (tm === undefined) return;
      try {
        const [latest] = await listSnapshots(tm.root);
        if (latest !== undefined && Date.now() - latest.created < MIN_INTERVAL_MS) return;
        await takeSnapshot(api, "deploy");
      } catch (err) {
        // l'instantané ne doit jamais empêcher un déploiement
        log("warn", "time machine snapshot failed", { error: getErrorMessageOrDefault(err) });
      }
    });
  });
  return true;
}

export default init;
