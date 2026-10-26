import * as path from "path";
import { pathToFileURL } from "url";

import { BrowserWindow } from "electron";

import { getVortexPath } from "./getVortexPath";
import { log } from "./logging";

const MIN_SHOWN_MS = 4000;

class SplashScreen {
  private mWindow: Electron.BrowserWindow | null = null;
  private mShownAt = 0;

  public async fadeOut(): Promise<void> {
    // apparently we can't prevent the user from closing the splash with alt-f4...
    if (this.mWindow === null || this.mWindow.isDestroyed()) return;

    // ensure the splash screen remains visible
    this.mWindow.setAlwaysOnTop(true);

    // don't fade out immediately, otherwise the it looks odd
    // as the main window appears at the same time

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => resolve(), ms);
      });

    // l'animation reste au moins 4 s à l'écran, même si le démarrage est plus rapide
    await delay(Math.max(200, MIN_SHOWN_MS - (Date.now() - this.mShownAt)));

    if (!this.mWindow?.isDestroyed()) {
      try {
        this.mWindow?.webContents.send("fade-out");
      } catch (err) {
        log("warn", "failed to fade out splash screen", err);
      }
    }

    // laisse la sortie animée (600 ms) aller au bout
    await delay(650);

    if (!this.mWindow?.isDestroyed()) {
      this.mWindow?.close();
    }

    this.mWindow = null;
  }

  public create(disableGPU?: boolean): Promise<void> {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        log("warn", "splash screen taking awfully long");
        resolve();
      }, 1000);

      const onReady = () => {
        clearTimeout(timeout);
        this.mShownAt = Date.now();
        if (process.env.VORTEX_E2E_HEADLESS !== "1") {
          this.mWindow?.show();
        }
        resolve();
      };

      this.mWindow = new BrowserWindow({
        frame: false,
        // carte de 476 × 166 et marge de 12 px pour son ombre
        width: 500,
        height: 190,
        transparent: !disableGPU,
        // pas d'ombre native : sur une fenêtre transparente, macOS la dessine autour du cadre
        // entier et non autour de la carte, qui a déjà la sienne
        hasShadow: false,
        backgroundColor: "#00000000",
        show: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,

        skipTaskbar: true,
        webPreferences: {
          javascript: true,
          webgl: false,
          backgroundThrottling: false,
          sandbox: false,
          nodeIntegration: true,
        },
      });

      this.mWindow.once("ready-to-show", onReady);

      this.mWindow
        .loadURL(
          pathToFileURL(path.join(getVortexPath("base"), "splash.html")).href +
            `?disableGPU=${disableGPU ? 1 : 0}`,
        )
        .catch((err: unknown) => log("error", "failed to load splash screen URL", err));
    });
  }

  public getHandle(): Electron.BrowserWindow | null {
    return this.mWindow;
  }
}

export default SplashScreen;
