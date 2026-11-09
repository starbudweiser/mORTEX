import path from "node:path";

import type { MacActivity } from "@vortex/shared/ipc";
import { app, BrowserWindow, Menu, type MenuItemConstructorOptions, Tray } from "electron";

import { markQuitting } from "./errorHandling";
import { getVortexPath } from "./getVortexPath";
import { log } from "./logging";
import { type PresenceMode, shouldHideOnToggle, showsDock, showsMenuBar } from "./macos/presence";

/** l'icône active, que l'IPC « activity:update » met à jour (mORTEX) ; posée par Application */
let activeTray: TrayIcon | undefined;
export const getTrayIcon = () => activeTray;
export const setTrayIcon = (tray: TrayIcon | undefined) => {
  activeTray = tray;
};

/** Quitter : ferme les fenêtres, ce qui laisse mORTEX finir proprement (comme « Quit » d'origine). */
function quitApplication() {
  // sans ce drapeau, le mode « barre de menus » masquerait la fenêtre au lieu de la fermer
  markQuitting();
  for (const win of BrowserWindow.getAllWindows()) {
    win.close();
  }
}

/**
 * Manages the system tray icon: clicking it toggles the main window
 * visibility and its context menu offers quitting the app.
 *
 * mORTEX (macOS) : le menu de l'icône montre l'activité (téléchargements, installations,
 * déploiement) et lance le jeu sans ouvrir la fenêtre ; le Dock porte une pastille et une barre
 * de progression (setActivity). La présence (Dock, barre de menus, ou les deux) suit le réglage
 * de l'utilisateur (setMode) ; un clic sur l'icône affiche ou masque la fenêtre, un clic droit
 * (ou Ctrl-clic) ouvre le menu juste sous l'icône, jamais par setContextMenu, que macOS place
 * parfois loin de l'icône quand il y a plusieurs écrans (même règle que hERALD et wCLAUDE).
 */
class TrayIcon {
  private mWindow: BrowserWindow | undefined;
  private mLastActivity: string | undefined;
  /** dernière activité reçue : redessine l'icône quand elle est recréée (changement de mode) */
  private mLastActivityValue: MacActivity | undefined;
  /** actions des Raccourcis reçues avant que l'affichage soit prêt (premier setActivity) */
  private mPendingActions: string[] = [];
  private mTrayIcon: Tray | undefined;
  private mImagePath: string;
  private mInitialized: boolean = false;
  private mMode: PresenceMode;
  /** éléments du menu ouvert sous l'icône (macOS) */
  private mMenuItems: MenuItemConstructorOptions[] = [];

  constructor(mode: PresenceMode) {
    this.mMode = mode;
    // macOS: icône de 18 px (tray@2x.png pour Retina) ; vortex.png est trop grand pour la barre de menus
    const trayImage =
      process.platform === "win32"
        ? "vortex.ico"
        : process.platform === "darwin"
          ? "tray.png"
          : "vortex.png";
    this.mImagePath = path.resolve(getVortexPath("assets"), "images", trayImage);
    this.mMenuItems = [{ label: "Quit", click: quitApplication }];
    this.applyDock();
    if (this.wantsTray()) {
      this.installTray();
    }
  }

  public get initialized() {
    return this.mInitialized;
  }

  public close() {
    this.removeTray();
  }

  /**
   * mORTEX (macOS) : change la présence de l'appli (réglage de l'utilisateur) : Dock, icône de la
   * barre de menus, ou les deux. Sans effet ailleurs.
   */
  public setMode(mode: PresenceMode) {
    if (process.platform !== "darwin" || mode === this.mMode) {
      return;
    }
    this.mMode = mode;
    this.applyDock();
    if (this.wantsTray()) {
      this.installTray();
    } else {
      this.removeTray();
    }
  }

  public setMainWindow(window: BrowserWindow) {
    this.mWindow = window;
    if (this.mTrayIcon === undefined || this.mTrayIcon.isDestroyed()) {
      return;
    }
    // macOS : le clic est branché à la création de l'icône (toggleWindow)
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

  /** action venue des Raccourcis (mortex://) : exécutée par l'affichage, sans montrer la fenêtre */
  public runAction(action: string) {
    if (action === "show") {
      this.showWindow();
    } else if (this.mLastActivity === undefined || this.mWindow === undefined) {
      this.mPendingActions.push(action);
    } else {
      this.mWindow.webContents.send("activity:action", action);
    }
  }

  public setActivity(activity: MacActivity) {
    if (this.mPendingActions.length > 0 && this.mWindow !== undefined) {
      const window = this.mWindow;
      // l'affichage vient de publier son activité : ses écouteurs sont en place
      setTimeout(() => {
        for (const action of this.mPendingActions.splice(0)) {
          window.webContents.send("activity:action", action);
        }
      }, 0);
    }
    const key = JSON.stringify(activity);
    if (key === this.mLastActivity) return;
    this.mLastActivity = key;
    this.mLastActivityValue = activity;

    app.dock?.setBadge(activity.badge);
    if (this.mWindow !== undefined && !this.mWindow.isDestroyed()) {
      this.mWindow.setProgressBar(activity.progress);
    }
    this.renderActivity(activity);
  }

  /** titre et menu de l'icône, d'après la dernière activité */
  private renderActivity(activity: MacActivity) {
    this.mMenuItems = this.activityItems(activity);
    if (this.mTrayIcon === undefined || this.mTrayIcon.isDestroyed()) return;
    this.mTrayIcon.setTitle(activity.title);
  }

  private activityItems(activity: MacActivity): MenuItemConstructorOptions[] {
    const items: MenuItemConstructorOptions[] = activity.lines.map((line) => ({
      label: line,
      enabled: false,
    }));
    if (items.length > 0) items.push({ type: "separator" });
    if (activity.launchLabel !== undefined) {
      items.push({
        label: activity.launchLabel,
        click: () => this.mWindow?.webContents.send("activity:action", "launch"),
      });
    }
    items.push(
      { label: activity.showLabel, click: () => this.showWindow() },
      { type: "separator" },
      { label: activity.quitLabel, click: quitApplication },
    );
    return items;
  }

  /** Dock : visible sauf en mode « barre de menus » (macOS) */
  private applyDock() {
    if (process.platform !== "darwin" || app.dock === undefined) {
      return;
    }
    if (showsDock(this.mMode)) {
      app.dock.show().catch((err: unknown) => log("warn", "failed to show the Dock icon", err));
    } else {
      app.dock.hide();
    }
  }

  private wantsTray(): boolean {
    return process.platform !== "darwin" || showsMenuBar(this.mMode);
  }

  /** menu ouvert sous l'icône, comme NSMenu.popUp(positioning:at:in:) de hERALD */
  private popMenu() {
    if (this.mTrayIcon === undefined || this.mTrayIcon.isDestroyed()) {
      return;
    }
    this.mTrayIcon.popUpContextMenu(Menu.buildFromTemplate(this.mMenuItems));
  }

  /** Fenêtre devant (visible, active, non réduite) : on la masque ; sinon on l'amène devant. */
  private toggleWindow() {
    const window = this.mWindow;
    if (window === undefined || window.isDestroyed()) {
      return;
    }
    if (process.env.VORTEX_E2E_HEADLESS === "1") {
      return;
    }
    if (shouldHideOnToggle(window)) {
      window.hide();
    } else {
      this.showWindow();
    }
  }

  private showWindow() {
    const window = this.mWindow;
    if (window === undefined || window.isDestroyed()) {
      return;
    }
    if (window.isMinimized()) {
      window.restore();
    }
    window.show();
    window.focus();
    // sans Dock, l'appli ne passe pas devant d'elle-même
    app.focus({ steal: true });
  }

  private installTray() {
    if (this.mTrayIcon !== undefined && !this.mTrayIcon.isDestroyed()) {
      return;
    }
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

  private removeTray() {
    if (this.mTrayIcon !== undefined && !this.mTrayIcon.isDestroyed()) {
      this.mTrayIcon.destroy();
    }
    this.mTrayIcon = undefined;
    this.mInitialized = false;
  }

  private initTrayIcon() {
    this.mTrayIcon = new Tray(this.mImagePath);

    if (process.platform === "darwin") {
      this.mTrayIcon.setToolTip("mORTEX");
      this.mTrayIcon.setIgnoreDoubleClickEvents(true);
      this.mTrayIcon.on("click", (event) => (event.ctrlKey ? this.popMenu() : this.toggleWindow()));
      this.mTrayIcon.on("right-click", () => this.popMenu());
      if (this.mLastActivityValue !== undefined) {
        this.renderActivity(this.mLastActivityValue);
      }
    } else {
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
    }

    this.mInitialized = true;
  }
}

export default TrayIcon;
