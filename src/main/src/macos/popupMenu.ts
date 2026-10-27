import type { SerializableMenuItem } from "@vortex/shared/preload";
/**
 * mORTEX (macOS) : menu natif (NSMenu) ouvert à la demande du moteur de rendu, par exemple sous
 * un bouton à menu. Renvoie l'identifiant de l'élément choisi, ou undefined si le menu est fermé
 * sans choix.
 *
 * Interface :
 *  - popupMenu(window, items, x, y): Promise<string | undefined>
 */
import type { BrowserWindow, MenuItemConstructorOptions } from "electron";
import { Menu } from "electron";

export function popupMenu(
  window: BrowserWindow,
  items: SerializableMenuItem[],
  x: number,
  y: number,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const toTemplate = (list: SerializableMenuItem[]): MenuItemConstructorOptions[] =>
      list.map(
        (item): MenuItemConstructorOptions => ({
          ...(item as MenuItemConstructorOptions),
          click: item.id !== undefined ? () => resolve(item.id) : undefined,
          submenu: Array.isArray(item.submenu) ? toTemplate(item.submenu) : undefined,
        }),
      );

    Menu.buildFromTemplate(toTemplate(items)).popup({
      window,
      x: Math.round(x),
      y: Math.round(y),
      // la fermeture précède parfois le clic : laisser le clic passer d'abord
      callback: () => setTimeout(() => resolve(undefined), 50),
    });
  });
}
