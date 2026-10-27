import path from "node:path";

import type { MacActivity } from "@vortex/shared/ipc";
import { app, BrowserWindow, Menu, type MenuItemConstructorOptions, Tray } from "electron";

import { getVortexPath } from "./getVortexPath";
import { log } from "./logging";

/** l'icône active, que l'IPC « activity:update » met à jour (mORTEX) ; posée par Application */
let activeTray: TrayIcon | undefined;
export const getTrayIcon = () => activeTray;
export const setTrayIcon = (tray: TrayIcon | undefined) => {
  activeTray = tray;
};

/**
 * Manages the system tray icon: clicking it toggles the main window
 * visibility and its context menu offers quitting the app.
 *
 * mORTEX (macOS) : le menu de l'icône montre l'activité (téléchargements, installations,
 * déploiement) et lance le jeu sans ouvrir la fenêtre ; le Dock porte une pastille et une barre
 * de progression (setActivity).
 */
class TrayIcon {
  private mWindow: BrowserWindow | undefined;
  private mLastActivity: string | undefined;
  private mTrayIcon: Tray | undefined;
  private mImagePath: string;
  private mInitialized: boolean = false;

  constructor() {
    // macOS: icône de 18 px (tray@2x.png pour Retina) ; vortex.png est trop grand pour la barre de menus
    const trayImage =
      process.platform === "win32"
        ? "vortex.ico"
        : process.platform === "darwin"
          ? "tray.png"
          : "vortex.png";
    this.mImagePath = path.resolve(getVortexPath("assets"), "images", trayImage);
    try {
      this.initTrayIcon();
    } catch {
      // This appears to be caused by a bug in electron. It happens randomly,
      // very rarely and the error message looks like it's entirely internal
      setTimeout(() => {
        try {
          this.initTrayIcon();
        } catch (err) {
          log("error", "failed to initialize tray icon", err);
        }
      }, 500);
    }
  }

  public get initialized() {
    return this.mInitialized;
  }

  public close() {
    if (this.mTrayIcon !== undefined) {
      this.mTrayIcon.destroy();
    }
  }

  public setMainWindow(window: BrowserWindow) {
    this.mWindow = window;
    if (this.mTrayIcon === undefined || this.mTrayIcon.isDestroyed()) {
      return;
    }
    // macOS : un clic ouvre le menu d'activité, qui a son entrée pour afficher la fenêtre
    if (process.platform === "darwin") {
      return;
    }
    this.mTrayIcon.on("click", () => {
      if (window.isDestroyed()) {
        return;
      }
      if (process.env.VORTEX_E2E_HEADLESS === "1") {
        return;
      }
      if (window.isVisible()) {
        window.hide();
      } else {
        window.show();
      }
    });
  }

  public setActivity(activity: MacActivity) {
    const key = JSON.stringify(activity);
    if (key === this.mLastActivity) return;
    this.mLastActivity = key;

    app.dock?.setBadge(activity.badge);
    if (this.mWindow !== undefined && !this.mWindow.isDestroyed()) {
      this.mWindow.setProgressBar(activity.progress);
    }
    if (this.mTrayIcon === undefined || this.mTrayIcon.isDestroyed()) return;
    this.mTrayIcon.setTitle(activity.title);

    const window = this.mWindow;
    const items: MenuItemConstructorOptions[] = activity.lines.map((line) => ({
      label: line,
      enabled: false,
    }));
    if (items.length > 0) items.push({ type: "separator" });
    if (activity.launchLabel !== undefined) {
      items.push({
        label: activity.launchLabel,
        click: () => window?.webContents.send("activity:action", "launch"),
      });
    }
    items.push(
      {
        label: activity.showLabel,
        click: () => {
          window?.show();
          window?.focus();
        },
      },
      { type: "separator" },
      {
        label: activity.quitLabel,
        // comme « Quit » d'origine : fermer les fenêtres laisse mORTEX finir proprement
        click: () => BrowserWindow.getAllWindows().forEach((win) => win.close()),
      },
    );
    this.mTrayIcon.setContextMenu(Menu.buildFromTemplate(items));
  }

  private initTrayIcon() {
    this.mTrayIcon = new Tray(this.mImagePath);

    this.mTrayIcon.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Quit",
          click: () => {
            for (const win of BrowserWindow.getAllWindows()) {
              win.close();
            }
          },
        },
      ]),
    );

    this.mInitialized = true;
  }
}

export default TrayIcon;
