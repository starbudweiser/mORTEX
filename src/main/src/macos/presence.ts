/**
 * mORTEX (macOS) : présence de l'appli, dans le Dock, dans la barre de menus, ou les deux.
 *
 * Modèle : hERALD (Presence.swift) et wCLAUDE (presence.js). En mode « barre de menus » :
 *   - le Dock est caché ;
 *   - un clic sur l'icône affiche ou masque la fenêtre, un clic droit (ou Ctrl-clic) ouvre le menu ;
 *   - fermer la fenêtre la masque, mORTEX reste actif (téléchargements, déploiement…) ; on quitte
 *     par le menu de l'icône ou par ⌘Q.
 *
 * Le mode est choisi dans les réglages (renderer) et recopié ici par l'IPC « presence:set ». Il est
 * aussi gardé dans `presence.json` (dossier de données) pour que le Dock soit réglé dès le
 * lancement, avant que l'affichage soit prêt. Sans fichier, le mode est « barre de menus ».
 *
 * Interface :
 *  - PresenceMode, DEFAULT_PRESENCE
 *  - normalizePresence(value): PresenceMode        valeur inconnue → DEFAULT_PRESENCE
 *  - showsDock(mode) / showsMenuBar(mode)
 *  - hidesOnClose(mode, platform, quitting)         fermer la fenêtre la masque-t-il ?
 *  - shouldHideOnToggle(window)                     clic sur l'icône : masquer (true) ou afficher (false)
 *  - readPresence(file) / writePresence(file, mode)
 *  - getPresence() / setPresence(mode)              mode courant du processus principal
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";

export type PresenceMode = "dock" | "menubar" | "both";

export const PRESENCE_MODES: readonly PresenceMode[] = ["dock", "menubar", "both"];

/** barre de menus seulement : choix de Stéphan (09/11/2026) */
export const DEFAULT_PRESENCE: PresenceMode = "menubar";

export function normalizePresence(value: unknown): PresenceMode {
  return PRESENCE_MODES.includes(value as PresenceMode)
    ? (value as PresenceMode)
    : DEFAULT_PRESENCE;
}

export const showsDock = (mode: PresenceMode): boolean => mode !== "menubar";

export const showsMenuBar = (mode: PresenceMode): boolean => mode !== "dock";

/**
 * Fermer la fenêtre la masque (au lieu de quitter) quand mORTEX vit dans la barre de menus
 * seulement, sauf si l'appli est déjà en train de quitter.
 */
export function hidesOnClose(
  mode: PresenceMode,
  platform: NodeJS.Platform,
  quitting: boolean,
): boolean {
  return platform === "darwin" && mode === "menubar" && !quitting;
}

interface IToggleWindow {
  isVisible(): boolean;
  isFocused(): boolean;
  isMinimized(): boolean;
}

/** Fenêtre devant (visible, active, non réduite) : on la masque ; sinon on l'amène devant. */
export function shouldHideOnToggle(window: IToggleWindow): boolean {
  return window.isVisible() && window.isFocused() && !window.isMinimized();
}

/** Lit le mode enregistré ; fichier absent ou illisible : mode par défaut. */
export function readPresence(file: string): PresenceMode {
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { mode?: unknown };
    return normalizePresence(data.mode);
  } catch {
    return DEFAULT_PRESENCE;
  }
}

/** Écrit le mode par un fichier temporaire renommé : jamais de fichier à moitié écrit. */
export function writePresence(file: string, mode: PresenceMode): void {
  const temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify({ mode }));
  renameSync(temp, file);
}

let current: PresenceMode = DEFAULT_PRESENCE;

export const getPresence = (): PresenceMode => current;

export function setPresence(mode: PresenceMode): void {
  current = mode;
}
