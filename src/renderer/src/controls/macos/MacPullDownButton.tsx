import type { SerializableMenuItem } from "@vortex/shared/preload";
/**
 * mORTEX (macOS) : bouton à menu comme ceux d'AppKit (NSButton + menu déroulant d'un seul tenant).
 * À gauche, l'action par défaut ; à droite, un chevron qui ouvre un vrai menu natif (NSMenu, par
 * window.api.menu.popup) sous le bouton, avec les autres actions et leurs sous-menus.
 *
 * Remplace sur Mac le bouton Bootstrap et sa flèche séparée (ActionDropdown).
 * Les actions à composant personnalisé ne vont pas dans un menu natif : canPullDown() dit si
 * toutes les actions s'y prêtent, sinon l'appelant garde son menu HTML.
 */
import * as React from "react";

import type { IActionDefinition } from "../../types/IActionDefinition";
import type { TFunction } from "../../util/i18n";
import type { IActionDefinitionEx } from "../ActionControl";
import Icon from "../Icon";

export function canPullDown(actions: IActionDefinitionEx[]): boolean {
  return actions.every((action) => action.component === undefined);
}

interface IProps {
  t: TFunction;
  instanceIds: string[];
  /** l'action du bouton */
  primary: IActionDefinitionEx;
  /** les actions du menu */
  rest: IActionDefinitionEx[];
}

const isHeader = (action: IActionDefinition) =>
  action.icon === null && action.component === undefined && action.action === undefined;

function subMenusOf(action: IActionDefinition, instanceIds: string[]): IActionDefinition[] {
  if (action.subMenus === undefined) return [];
  return Array.isArray(action.subMenus) ? action.subMenus : action.subMenus(instanceIds);
}

/** le menu natif, et pour chaque identifiant l'action qu'il déclenche */
export function buildMenu(
  t: TFunction,
  actions: IActionDefinitionEx[],
  instanceIds: string[],
): { items: SerializableMenuItem[]; byId: Map<string, IActionDefinition> } {
  const byId = new Map<string, IActionDefinition>();
  // les sous-menus n'ont pas toujours d'état « show » : affichés actifs
  const toItems = (
    list: Array<IActionDefinition & { show?: boolean | string }>,
    prefix: string,
  ): SerializableMenuItem[] =>
    list.flatMap((action, idx): SerializableMenuItem[] => {
      const label = t(action.title, { ns: action.options?.namespace });
      if (isHeader(action)) {
        return [{ type: "separator" }, { label, enabled: false }];
      }
      const id = `${prefix}${idx}`;
      const sub = subMenusOf(action, instanceIds);
      if (sub.length > 0) {
        return [{ label, enabled: action.show !== false, submenu: toItems(sub, `${id}.`) }];
      }
      byId.set(id, action);
      return [
        {
          id,
          label,
          enabled: action.show === undefined || action.show === true,
          toolTip: typeof action.show === "string" ? action.show : undefined,
        },
      ];
    });
  return { items: toItems(actions, ""), byId };
}

function Chevron() {
  return (
    <svg aria-hidden className="mac-pulldown-chevron" viewBox="0 0 9 6">
      <path d="M1 1.25 4.5 4.75 8 1.25" />
    </svg>
  );
}

export function MacPullDownButton(props: IProps): JSX.Element {
  const { t, instanceIds, primary, rest } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  const enabled = primary.show === true;

  const openMenu = React.useCallback(async () => {
    const box = ref.current?.getBoundingClientRect();
    if (box === undefined) return;
    const { items, byId } = buildMenu(t, rest, instanceIds);
    setOpen(true);
    try {
      // sous le bouton, aligné sur son bord gauche, comme un menu AppKit
      const chosen = await window.api.menu.popup(items, box.left, box.bottom + 4);
      const action = chosen !== undefined ? byId.get(chosen) : undefined;
      action?.action?.(instanceIds, action.data);
    } finally {
      setOpen(false);
    }
  }, [t, rest, instanceIds]);

  return (
    <div className={`mac-pulldown${open ? " mac-pulldown-open" : ""}`} ref={ref}>
      <button
        className="mac-pulldown-main"
        data-value={primary.title}
        disabled={!enabled}
        title={typeof primary.show === "string" ? primary.show : undefined}
        type="button"
        onClick={() => primary.action?.(instanceIds, primary.data)}
      >
        {primary.icon ? <Icon name={primary.icon} /> : null}
        {t(primary.title, { ns: primary.options?.namespace })}
      </button>
      {rest.length > 0 ? (
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t("More actions")}
          className="mac-pulldown-menu"
          type="button"
          onClick={() => void openMenu()}
        >
          <Chevron />
        </button>
      ) : null}
    </div>
  );
}
