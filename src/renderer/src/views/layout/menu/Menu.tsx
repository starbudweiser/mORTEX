import React, { useState, type FC, useRef, useEffect, useMemo, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setOpenMainPage } from "@/actions";
import { usePagesContext, useWindowContext } from "@/contexts";
import { moveBefore, setMenuOrder, sortByOrder } from "@/extensions/mortex_dashlet/menuOrder";
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

/** mORTEX : la touche Option est-elle enfoncée ? (fenêtre active seulement) */
const useOptionKey = () => {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const track = (event: KeyboardEvent) => setHeld(event.altKey);
    const release = () => setHeld(false);
    window.addEventListener("keydown", track);
    window.addEventListener("keyup", track);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", track);
      window.removeEventListener("keyup", track);
      window.removeEventListener("blur", release);
    };
  }, []);
  return held;
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

  const optionHeld = useOptionKey();
  const menuOrder = useSelector(
    (state: IState) => (state.settings as any).mortex?.menuOrder ?? NO_ORDER,
  );
  const [dragged, setDragged] = useState<{ section: string; id: string } | undefined>(undefined);
  const [dropTarget, setDropTarget] = useState<string | undefined>(undefined);

  const onScroll = (event: Event) => setCanScrollUp((event.target as HTMLDivElement).scrollTop > 0);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const element = scrollRef.current;
    element.addEventListener("scroll", onScroll);
    return () => element.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  /** propriétés de glisser-déposer d'une entrée, quand Option est enfoncée */
  const reorderProps = (section: string, ids: string[], id: string) => ({
    reorderable: optionHeld || dragged !== undefined,
    dropHint: dragged?.section === section && dropTarget === id && dragged.id !== id,
    onDragStart: (event: React.DragEvent) => {
      if (!event.altKey && !optionHeld) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      setDragged({ section, id });
    },
    onDragOver: (event: React.DragEvent) => {
      if (dragged?.section !== section) return;
      event.preventDefault();
      setDropTarget(id);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      if (dragged?.section === section && dragged.id !== id) {
        dispatch(setMenuOrder(section, moveBefore(ids, dragged.id, id)));
      }
      setDragged(undefined);
      setDropTarget(undefined);
    },
    onDragEnd: () => {
      setDragged(undefined);
      setDropTarget(undefined);
    },
  });

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
