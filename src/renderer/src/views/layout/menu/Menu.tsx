import React, {
  useState,
  useCallback,
  type FC,
  useRef,
  useEffect,
  useMemo,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setOpenMainPage } from "@/actions";
import { usePagesContext, useWindowContext } from "@/contexts";
import {
  MENU_COLORS,
  setMenuColor,
  setMenuOrder,
  sortByOrder,
} from "@/extensions/mortex_dashlet/menuOrder";
import type { IMainPage } from "@/types/IMainPage";
import type { IState } from "@/types/IState";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { joinClasses } from "@/ui/utils/joinClasses";
import { activeGameId as activeGameIdSelector } from "@/util/selectors";
import { getIcon } from "@/views/components/icon_map/iconMap";
import { useSpineContext } from "@/views/components/Spine/SpineContext";

import { GameActions } from "./components/game_actions/GameActions";
import { MenuButton } from "./components/MenuButton";
import { MenuSection } from "./components/MenuSection";
import { ToolsProvider, useToolsContext } from "./context/ToolsContext";

const toolPadding = {
  1: "pb-32",
  2: "pb-42",
  3: "pb-52",
  4: "pb-62",
  5: "pb-72",
};

/** mORTEX : pages rangées sous « Outils » ; les autres pages du jeu vont sous « Jeu » */
const TOOL_PAGE_IDS = new Set(["Browse Nexus Mods", "Tools", "Health check"]);

/** mORTEX : pages exclusives au Mac, en couleur dans la barre latérale */
const MAC_PAGE_IDS = new Set(["DXMT workshop", "Settings editor", "Time Machine"]);
/** pages tournées vers Nexus Mods, en bleu Socle */
const NEXUS_PAGE_IDS = new Set(["Browse Nexus Mods"]);

/** l'entrée Téléchargements, qui n'est pas une page, dans l'ordre de la barre latérale */
const DOWNLOADS_ID = "__downloads";

const NO_ORDER: Record<string, string[]> = {};
const NO_COLORS: Record<string, string> = {};

/** mORTEX : palette ouverte par Option + clic droit sur une entrée de la barre latérale */
const ColorPalette: FC<{
  x: number;
  y: number;
  current?: string;
  onPick: (color: string | undefined) => void;
  onClose: () => void;
}> = ({ x, y, current, onPick, onClose }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);
  return createPortal(
    <div
      className="mortex-menu-palette"
      ref={ref}
      role="dialog"
      aria-label={t("Entry colour")}
      style={{ left: x, top: Math.min(y, window.innerHeight - 96) }}
    >
      <div className="mortex-menu-palette-swatches">
        {MENU_COLORS.map((color) => (
          <button
            aria-label={color}
            className={color === current ? "mortex-menu-swatch is-current" : "mortex-menu-swatch"}
            key={color}
            style={{ backgroundColor: color }}
            type="button"
            onClick={() => onPick(color)}
          />
        ))}
      </div>
      <button
        className="mortex-menu-palette-reset"
        disabled={current === undefined}
        type="button"
        onClick={() => onPick(undefined)}
      >
        {t("Original colour")}
      </button>
    </div>,
    document.body,
  );
};

/** Mods installés et archives téléchargées du jeu actif, pour les compteurs de la barre latérale */
const useMenuCounts = () => {
  const gameId = useSelector(activeGameIdSelector);
  const mods = useSelector((state: IState) =>
    gameId === undefined ? undefined : state.persistent.mods[gameId],
  );
  const downloads = useSelector((state: IState) => state.persistent.downloads?.files);

  return useMemo(() => {
    const installed = Object.values(mods ?? {}).filter((mod) => mod?.state === "installed").length;
    const archives = Object.values(downloads ?? {}).filter(
      (download) => gameId !== undefined && (download?.game ?? []).includes(gameId),
    ).length;
    return { installed, archives, gameId };
  }, [mods, downloads, gameId]);
};

const MenuContent: FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
  const { selection, homePages, gamePages, selectDownloads } = useSpineContext();
  const counts = useMenuCounts();
  const dispatch = useDispatch();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { mainPage } = usePagesContext();
  const { visibleTools } = useToolsContext();
  const toolCount = visibleTools.length;
  const [canScrollUp, setCanScrollUp] = useState(false);

  const menuOrder = useSelector(
    (state: IState) => (state.settings as any).mortex?.menuOrder ?? NO_ORDER,
  );
  const menuColors: Record<string, string> = useSelector(
    (state: IState) => (state.settings as any).mortex?.menuColors ?? NO_COLORS,
  );
  /** palette de couleur ouverte sur une entrée */
  const [palette, setPalette] = useState<{ id: string; x: number; y: number } | undefined>(
    undefined,
  );
  const closePalette = useCallback(() => setPalette(undefined), []);
  /** entrée saisie : son groupe, sa place de départ, la place visée et le déplacement du curseur */
  const [drag, setDrag] = useState<
    | { section: string; id: string; from: number; target: number; delta: number; tops: number[] }
    | undefined
  >(undefined);

  const onScroll = (event: Event) => setCanScrollUp((event.target as HTMLDivElement).scrollTop > 0);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const element = scrollRef.current;
    element.addEventListener("scroll", onScroll);
    return () => element.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  // Déplacement fait maison, à la souris : le glisser-déposer natif d'Electron est annulé par
  // macOS au relâchement (dragend sans drop), l'entrée ne bougeait donc jamais. Pendant le
  // déplacement rien n'est réordonné : l'entrée saisie décolle et suit le curseur, les autres
  // glissent pour lui faire place (translate seulement) ; l'ordre change au relâchement.
  const moving = useRef<
    | {
        section: string;
        id: string;
        ids: string[];
        from: number;
        x: number;
        y: number;
        /** haut de chaque entrée du groupe au moment de la saisie */
        tops: number[];
        height: number;
        target: number;
        lifted: boolean;
        timer?: ReturnType<typeof setTimeout>;
      }
    | undefined
  >(undefined);

  const lift = () => {
    const move = moving.current;
    if (move === undefined || move.lifted) return;
    clearTimeout(move.timer);
    move.lifted = true;
    document.body.classList.add("mortex-menu-moving");
    const { section, id, from, tops } = move;
    setDrag({ section, id, from, target: from, delta: 0, tops });
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const move = moving.current;
      if (move === undefined) return;
      if (!move.lifted) {
        if (Math.hypot(event.clientX - move.x, event.clientY - move.y) < 5) return;
        lift();
      }
      // la place visée : celle dont le milieu est le plus proche du milieu de l'entrée saisie
      const delta = event.clientY - move.y;
      const middle = move.tops[move.from] + delta + move.height / 2;
      let target = 0;
      move.tops.forEach((top, idx) => {
        const best = Math.abs(move.tops[target] + move.height / 2 - middle);
        if (Math.abs(top + move.height / 2 - middle) < best) target = idx;
      });
      move.target = target;
      const { section, id, from, tops } = move;
      setDrag({ section, id, from, target, delta, tops });
    };
    const onUp = () => {
      const move = moving.current;
      moving.current = undefined;
      if (move === undefined) return;
      clearTimeout(move.timer);
      if (!move.lifted) return;
      if (move.target !== move.from) {
        const order = move.ids.filter((id) => id !== move.id);
        order.splice(move.target, 0, move.id);
        dispatch(setMenuOrder(move.section, order));
      }
      // le clic qui suit le relâchement n'ouvre pas la page
      const swallow = (event: MouseEvent) => event.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, true), 0);
      document.body.classList.remove("mortex-menu-moving");
      setDrag(undefined);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dispatch]);

  /** décalage vertical d'une entrée pendant un déplacement dans son groupe */
  const shiftOf = (index: number): number => {
    if (drag === undefined) return 0;
    if (index === drag.from) return drag.delta;
    // place qu'occupera l'entrée une fois la saisie déposée à la place visée
    let slot = index;
    if (drag.from < index && index <= drag.target) slot = index - 1;
    if (drag.target <= index && index < drag.from) slot = index + 1;
    // et un léger écart de part et d'autre de la place libérée
    const spread = slot < drag.target ? -3 : 3;
    return drag.tops[slot] - drag.tops[index] + spread;
  };

  /** propriétés de déplacement d'une entrée : on la saisit et on la dépose dans son groupe */
  const reorderProps = (section: string, ids: string[], id: string) => {
    const index = ids.indexOf(id);
    const inGroup = drag?.section === section;
    return {
      "data-reorder-id": id,
      "data-reorder-section": section,
      lifted: inGroup && drag.id === id,
      sliding: inGroup && drag.id !== id,
      style: inGroup ? { translate: `0 ${shiftOf(index)}px` } : undefined,
      tint: menuColors[id],
      // Option + clic droit : choisir la couleur de l'entrée
      onContextMenu: (event: React.MouseEvent) => {
        if (!event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setPalette({ id, x: rect.right + 6, y: rect.top });
      },
      onPointerDown: (event: React.PointerEvent) => {
        if (event.button !== 0) return;
        const group = event.currentTarget.closest(".mortex-menu-section") ?? document;
        const tops = ids.map(
          (other) =>
            group.querySelector(`[data-reorder-id="${CSS.escape(other)}"]`)?.getBoundingClientRect()
              .top ?? 0,
        );
        moving.current = {
          section,
          id,
          ids,
          from: index,
          x: event.clientX,
          y: event.clientY,
          tops,
          height: event.currentTarget.getBoundingClientRect().height,
          target: index,
          lifted: false,
          timer: setTimeout(lift, 180),
        };
      },
    };
  };

  const renderPage = (page: IMainPage, extra = {}) => (
    <MenuButton
      accent={MAC_PAGE_IDS.has(page.id) ? "mac" : NEXUS_PAGE_IDS.has(page.id) ? "nexus" : undefined}
      data-tour={page.id}
      icon={page.menuIcon ?? getIcon(page.icon)}
      Badge={page.menuBadge}
      count={page.id === "Mods" ? counts.installed : undefined}
      isActive={mainPage === page.id && selection.type !== "downloads"}
      key={page.id}
      onClick={() => {
        if (mainPage === page.id) {
          page.onReset?.();
        } else {
          dispatch(setOpenMainPage(page.id, false));
        }
      }}
      {...extra}
    >
      {t(page.title, { ns: page.namespace })}
    </MenuButton>
  );

  // mORTEX : une seule barre latérale, en trois groupes comme sur les maquettes
  const sections = [
    { title: "Game", pages: gamePages.filter((page) => !TOOL_PAGE_IDS.has(page.id)) },
    { title: "Tools", pages: gamePages.filter((page) => TOOL_PAGE_IDS.has(page.id)) },
    { title: "Application", pages: homePages },
  ];

  // les entrées d'un groupe dans l'ordre choisi par l'utilisateur
  const renderSection = (section: { title: string; pages: IMainPage[] }) => {
    const entries: Array<{ id: string; render: (extra: object) => ReactElement }> =
      section.pages.map((page) => ({ id: page.id, render: (extra) => renderPage(page, extra) }));
    if (section.title === "Game") {
      entries.push({
        id: DOWNLOADS_ID,
        render: (extra) => (
          <MenuButton
            count={counts.archives}
            data-tour={DOWNLOADS_ID}
            icon={getIcon("download")}
            isActive={selection.type === "downloads"}
            key={DOWNLOADS_ID}
            onClick={() => selectDownloads(counts.gameId)}
            {...extra}
          >
            {t("Downloads")}
          </MenuButton>
        ),
      });
    }
    const sorted = sortByOrder(entries, (entry) => entry.id, menuOrder[section.title]);
    const ids = sorted.map((entry) => entry.id);
    return sorted.map((entry) => entry.render(reorderProps(section.title, ids, entry.id)));
  };

  return (
    <TooltipDelayGroup
      as="div"
      className={joinClasses([
        "relative -mt-1 flex shrink-0 flex-col pr-0.5 transition-[width]",
        menuIsCollapsed ? "w-16" : "w-55.5",
      ])}
    >
      {canScrollUp && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-1 h-6 bg-linear-to-b from-surface-base to-transparent" />
      )}

      <div className="mr-1 min-h-0 w-full overflow-y-auto pl-3" ref={scrollRef}>
        <div
          className={joinClasses([
            "flex flex-col gap-y-0.5 pt-1 transition-[width]",
            menuIsCollapsed ? `w-10 ${toolPadding[toolCount]}` : "w-49 pb-34",
          ])}
        >
          {sections.map(
            (section) =>
              section.pages.length > 0 && (
                <MenuSection key={section.title} title={t(section.title)}>
                  {renderSection(section)}
                </MenuSection>
              ),
          )}
        </div>

        {/* hack to hide bottom of scrollbar :( */}
        <div className="pointer-events-none absolute right-0 bottom-0 size-3 bg-surface-base" />
      </div>

      <GameActions />

      {palette !== undefined && (
        <ColorPalette
          current={menuColors[palette.id]}
          x={palette.x}
          y={palette.y}
          onClose={closePalette}
          onPick={(color) => {
            dispatch(setMenuColor(palette.id, color));
            setPalette(undefined);
          }}
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-6 bg-linear-to-t from-surface-base to-transparent" />
    </TooltipDelayGroup>
  );
};

export const Menu: FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <ToolsProvider>
      <MenuContent />
    </ToolsProvider>
  );
};
