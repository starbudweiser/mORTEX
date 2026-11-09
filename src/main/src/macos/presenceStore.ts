/**
 * mORTEX (macOS) : lecture et enregistrement du mode de présence (Dock, barre de menus, ou les deux)
 * dans `presence.json`, dans le dossier de données de l'appli. La logique pure est dans presence.ts.
 */
import path from "node:path";

import { app } from "electron";

import { log } from "../logging";
import { type PresenceMode, readPresence, setPresence, writePresence } from "./presence";

const presenceFile = () => path.join(app.getPath("userData"), "presence.json");

/** Relit le mode enregistré et en fait le mode courant (au lancement, avant la fenêtre). */
export function loadPresence(): PresenceMode {
  const mode = readPresence(presenceFile());
  setPresence(mode);
  return mode;
}

/** Fait de `mode` le mode courant et le garde pour le prochain lancement. */
export function savePresence(mode: PresenceMode): void {
  setPresence(mode);
  try {
    writePresence(presenceFile(), mode);
  } catch (err) {
    log("warn", "failed to save the presence mode", err);
  }
}
