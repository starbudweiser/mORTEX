/**
 * mORTEX (macOS) : démarrage après un arrêt brutal.
 *
 * Après un plantage ou un arrêt forcé, macOS tente de restaurer les fenêtres de la session
 * précédente (Saved Application State). Cette restauration bloquait la fin du lancement :
 * `app.whenReady()` ne se résolvait jamais, processus vivant sans fenêtre (constaté lors du
 * stress test du 26/10, écran verrouillé). mORTEX recrée lui-même sa fenêtre ; la
 * restauration système ne sert à rien.
 *
 * guardLaunch(log) : à appeler au tout début de main(), avant `ready`.
 *   - enregistre ApplePersistenceIgnoreState par défaut (le réglage explicite de
 *     l'utilisateur, s'il existe, l'emporte) ;
 *   - journalise une alerte si `ready` n'arrive pas en READY_TIMEOUT_MS.
 * Sans effet hors darwin.
 */
import { app, systemPreferences } from "electron";

export const READY_TIMEOUT_MS = 15_000;

type Log = (level: "warn", message: string, meta?: unknown) => void;

export function guardLaunch(log: Log): void {
  if (process.platform !== "darwin") return;

  systemPreferences.registerDefaults({ ApplePersistenceIgnoreState: true });

  const timer = setTimeout(() => {
    log("warn", "macOS launch did not finish (no 'ready')", { afterMs: READY_TIMEOUT_MS });
  }, READY_TIMEOUT_MS);
  timer.unref();
  void app.whenReady().then(() => clearTimeout(timer));
}
