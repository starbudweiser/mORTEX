/**
 * mORTEX (macOS) : liens nxm:// reçus par l'évènement `open-url` d'Electron.
 *
 * Sur macOS, LaunchServices ne relance pas l'appli avec une ligne de commande :
 * il envoie `open-url` à l'instance déjà lancée (ou à la nouvelle, avant `ready`).
 * Le schéma est déclaré dans l'Info.plist (CFBundleURLTypes, ajouté par
 * mac/package.sh).
 *
 * listenOpenUrl(handler, onAction) : à appeler dès la construction d'Application (avant
 * `ready`) ; Application.applyArguments attend la fenêtre principale avant de traiter le lien.
 * Sans effet hors darwin.
 *
 * mortex://<action>?… : actions des Raccourcis (extension App Intents MortexIntents), passées à
 * `onAction` sous la forme « launch », « deploy », « sort », « snapshot », « profile:<nom> ».
 */
import { app } from "electron";

/** « mortex://profile?name=Survie » → « profile:Survie » ; undefined pour un autre lien */
export function mortexAction(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "mortex:") return undefined;
  const action = parsed.hostname.toLowerCase();
  if (action === "profile") {
    const name = parsed.searchParams.get("name");
    return name ? `profile:${name}` : undefined;
  }
  return ["launch", "deploy", "sort", "snapshot", "show"].includes(action) ? action : undefined;
}

export function listenOpenUrl(
  handler: (url: string) => void,
  onAction: (action: string) => void,
): void {
  if (process.platform !== "darwin") return;
  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (url.toLowerCase().startsWith("nxm://")) {
      handler(url);
      return;
    }
    const action = mortexAction(url);
    if (action !== undefined) onAction(action);
  });
}
