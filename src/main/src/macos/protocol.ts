/**
 * mORTEX (macOS) : liens nxm:// reçus par l'évènement `open-url` d'Electron.
 *
 * Sur macOS, LaunchServices ne relance pas l'appli avec une ligne de commande :
 * il envoie `open-url` à l'instance déjà lancée (ou à la nouvelle, avant `ready`).
 * Le schéma est déclaré dans l'Info.plist (CFBundleURLTypes, ajouté par
 * mac/package.sh).
 *
 * listenOpenUrl(handler) : à appeler dès la construction d'Application (avant `ready`) ;
 * Application.applyArguments attend la fenêtre principale avant de traiter le lien.
 * Sans effet hors darwin.
 */
import { app } from "electron";

export function listenOpenUrl(handler: (url: string) => void): void {
  if (process.platform !== "darwin") return;
  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (url.toLowerCase().startsWith("nxm://")) {
      handler(url);
    }
  });
}
