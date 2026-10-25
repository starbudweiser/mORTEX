import React, { type FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";

import {
  discovered as discoveredGamesSelector,
  knownGames as knownGamesSelector,
  profiles as profilesSelector,
} from "../../../util/selectors";
import { useSpineContext } from "../Spine/SpineContext";
import { formatGameDisplayName } from "../Spine/utils";

/**
 * mORTEX : le nom du jeu dans la barre de titre ouvre la liste des jeux gérés, pour en changer
 * sans la colonne d'icônes d'origine.
 */
export const GameSwitcher: FC<{ title: string }> = ({ title }) => {
  const { t } = useTranslation();
  const { selection, selectGame, selectGlobalPage } = useSpineContext();
  const knownGames = useSelector(knownGamesSelector);
  const discoveredGames = useSelector(discoveredGamesSelector);
  const profiles = useSelector(profilesSelector);

  const sections = useMemo<IMenuAction[][]>(() => {
    const withProfile = new Set(Object.values(profiles).map((profile) => profile.gameId));
    const games = knownGames
      .filter((game) => {
        const discovery = discoveredGames[game.id];
        return (
          withProfile.has(game.id) && discovery?.path !== undefined && discovery?.hidden !== true
        );
      })
      .map(
        (game): IMenuAction => ({
          label: formatGameDisplayName(game.name),
          icon: selection.type === "game" && selection.gameId === game.id ? "check" : undefined,
          onClick: () => selectGame(game.id),
        }),
      );

    const manage: IMenuAction = {
      label: t("Manage games"),
      icon: "add",
      onClick: () => selectGlobalPage("Games"),
    };

    return games.length > 0 ? [games, [manage]] : [[manage]];
  }, [profiles, knownGames, discoveredGames, selection, selectGame, selectGlobalPage, t]);

  return (
    <Popover>
      <PopoverButton
        appearance="weak"
        aria-haspopup="menu"
        brand="neutral"
        data-testid="game-switcher"
        rightIcon="keyboard_arrow_down"
      >
        {title}
      </PopoverButton>

      <PopoverPanel className="nxm-popover-panel-dropdown">
        {({ close }) => <PopoverMenu actions={sections} label={t("Games")} onSelect={close} />}
      </PopoverPanel>
    </Popover>
  );
};
