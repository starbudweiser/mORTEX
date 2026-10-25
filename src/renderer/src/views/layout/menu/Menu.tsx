import React, { useState, type FC, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setOpenMainPage } from "@/actions";
import { usePagesContext, useWindowContext } from "@/contexts";
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

  const onScroll = (event: Event) => setCanScrollUp((event.target as HTMLDivElement).scrollTop > 0);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const element = scrollRef.current;
    element.addEventListener("scroll", onScroll);
    return () => element.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  const renderPage = (page: IMainPage) => (
    <MenuButton
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
                  {section.pages.map(renderPage)}

                  {section.title === "Game" && (
                    <MenuButton
                      count={counts.archives}
                      icon={getIcon("download")}
                      isActive={selection.type === "downloads"}
                      onClick={() => selectDownloads(counts.gameId)}
                    >
                      {t("Downloads")}
                    </MenuButton>
                  )}
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
