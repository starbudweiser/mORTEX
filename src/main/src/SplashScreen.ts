import * as path from "path";
import { pathToFileURL } from "url";

import { BrowserWindow, screen } from "electron";

import { getVortexPath } from "./getVortexPath";
import { log } from "./logging";

// Règle Socle « Splash animé » : fenêtre principale à t = 2 s, sortie du splash à t = 4 s (600 ms)
const MIN_SHOWN_MS = 4000;
const MAIN_WINDOW_AT_MS = 2000;
const WIDTH = 500;
const HEIGHT = 190;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

class SplashScreen {
  private mWindow: Electron.BrowserWindow | null = null;
  private mShownAt = 0;

  /**
   * Retient l'ouverture de la fenêtre principale jusqu'à 2 s après l'apparition du splash
   */
  public async holdMainWindow(): Promise<void> {
    if (this.mWindow === null || this.mWindow.isDestroyed() || this.mShownAt === 0) return;
    await delay(MAIN_WINDOW_AT_MS - (Date.now() - this.mShownAt));
  }

  /**
   * @param mainShown se résout quand la fenêtre principale est affichée : le splash l'attend avant de sortir
   */
  public async fadeOut(mainShown?: Promise<void>): Promise<void> {
    // apparently we can't prevent the user from closing the splash with alt-f4...
    if (this.mWindow === null || this.mWindow.isDestroyed()) return;

    // ensure the splash screen remains visible
    this.mWindow.setAlwaysOnTop(true);

    // don't fade out immediately, otherwise the it looks odd
    // as the main window appears at the same time

    // l'animation reste au moins 4 s à l'écran, même si le démarrage est plus rapide
    await Promise.all([
      delay(Math.max(200, MIN_SHOWN_MS - (Date.now() - this.mShownAt))),
      mainShown,
    ]);

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
        if (process.env.VORTEX_E2E_HEADLESS !== "1") {
          this.mWindow?.show();
          // macOS peut remonter la fenêtre à l'affichage : on la recentre une fois visible
          this.center();
        }
        this.mShownAt = Date.now();
        resolve();
      };

      const { x, y } = this.centeredPosition();
      this.mWindow = new BrowserWindow({
        frame: false,
        // Socle size-splash-* : carte de 476 × 166 et marge de 12 px
        width: WIDTH,
        height: HEIGHT,
        x,
        y,
        transparent: !disableGPU,
        // pas d'ombre native : sur une fenêtre transparente, macOS la dessine autour du cadre entier
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
          // sans ça, require("./splash.js") échoue en silence : ni mention localisée, ni sortie animée
          contextIsolation: false,
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

  /**
   * Position qui centre exactement le splash sur l'écran complet (et non sur la zone utile,
   * qui exclut la barre des menus et le Dock)
   */
  private centeredPosition(): { x: number; y: number } {
    const { bounds } = screen.getPrimaryDisplay();
    return {
      x: Math.round(bounds.x + (bounds.width - WIDTH) / 2),
      y: Math.round(bounds.y + (bounds.height - HEIGHT) / 2),
    };
  }

  private center(): void {
    if (this.mWindow === null || this.mWindow.isDestroyed()) return;
    const { x, y } = this.centeredPosition();
    this.mWindow.setBounds({ x, y, width: WIDTH, height: HEIGHT });
    const bounds = this.mWindow.getBounds();
    if (bounds.x !== x || bounds.y !== y) {
      log("warn", "splash screen not centered", { expected: { x, y }, actual: bounds });
    }
  }

  public getHandle(): Electron.BrowserWindow | null {
    return this.mWindow;
  }
}

export default SplashScreen;
