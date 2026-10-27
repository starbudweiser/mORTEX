/**
 * mORTEX : ordre des entrées de la barre latérale, choisi par l'utilisateur en les faisant
 * glisser avec la touche Option (comme les icônes de la barre des menus avec Commande).
 * Rangé dans settings.mortex.menuOrder[groupe] = ids dans l'ordre voulu.
 */
import safeCreateAction from "../../actions/safeCreateAction";
import { setSafe } from "../../util/storeHelper";

export const setMenuOrder = safeCreateAction(
  "MORTEX_SET_MENU_ORDER",
  (section: string, ids: string[]) => ({ section, ids }),
);

export const menuOrderReducers = {
  [setMenuOrder as any]: (state, payload: { section: string; ids: string[] }) =>
    setSafe(state, ["menuOrder", payload.section], payload.ids),
};

/** les ids rangés selon `order` ; ceux qu'il ne connaît pas gardent leur place relative, à la fin */
export function sortByOrder<T>(items: T[], idOf: (item: T) => string, order?: string[]): T[] {
  if (order === undefined || order.length === 0) return items;
  const rank = new Map(order.map((id, idx) => [id, idx]));
  return items
    .map((item, idx) => ({ item, idx, rank: rank.get(idOf(item)) }))
    .sort((lhs, rhs) =>
      lhs.rank !== undefined && rhs.rank !== undefined
        ? lhs.rank - rhs.rank
        : lhs.rank !== undefined
          ? -1
          : rhs.rank !== undefined
            ? 1
            : lhs.idx - rhs.idx,
    )
    .map((entry) => entry.item);
}

/** `ids` avec `moved` placé juste avant `target` (ou après, si on descend) */
export function moveBefore(ids: string[], moved: string, target: string): string[] {
  const from = ids.indexOf(moved);
  const to = ids.indexOf(target);
  if (from === -1 || to === -1 || from === to) return ids;
  const result = ids.filter((id) => id !== moved);
  result.splice(result.indexOf(target) + (from < to ? 1 : 0), 0, moved);
  return result;
}
