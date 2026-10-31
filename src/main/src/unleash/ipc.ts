import { BrowserWindow } from "electron";

import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import type { UnleashClient } from "./client";

/**
 * Sous macOS, mORTEX ne contacte pas le service de drapeaux de Nexus : aucune requête (ni version
 * de l'appli, ni identifiant Nexus), aucune métrique. L'interface reçoit une liste vide, ce qui
 * revient aux valeurs par défaut de chaque fonction.
 */
export const flagsDisabled = (): boolean => process.platform === "darwin";

export function synchronizeFeatureFlags(client: UnleashClient): () => void {
  betterIpcMain.handle("flags:get-current", () => {
    return flagsDisabled() ? [] : client.flags;
  });

  if (flagsDisabled()) {
    return () => undefined;
  }

  betterIpcMain.on("flags:setContext", (_event, context) => {
    client.setContext(context);
  });

  betterIpcMain.on("flags:metrics", (_event, bucket) => {
    client.postMetrics(bucket).catch((err: unknown) => {
      log("warn", "unleash metrics post failed", { err });
    });
  });

  return client.start(undefined, (flags) => {
    for (const win of BrowserWindow.getAllWindows()) {
      betterIpcMain.send(win.webContents, "flags:synchronize", flags);
    }
  });
}
