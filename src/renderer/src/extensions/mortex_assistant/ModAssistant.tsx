import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { ExtensionContext } from "@/ExtensionProvider";
import type { IState } from "@/types/IState";

import type { IStateWithGamebryo } from "../gamebryo_plugin_management/types/IStateWithGamebryo";
import { modRequirementsCheckResult } from "../health_check/selectors";
import type { IMod } from "../mod_management/types/IMod";
import { userInfo } from "../nexus_integration/selectors";
import { activeGameId } from "../profile_management/selectors";
import { AssistantPanel } from "./AssistantPanel";
import { explainMod, type IModConflict } from "./explain/mod";
import type { ExistingActionId } from "./explain/types";
import { useOpenUrl } from "./useOpenUrl";

/**
 * mORTEX : section « Conflits et dépendances » de la fiche d'un mod. Ne lit que l'état déjà
 * calculé : jamais de recalcul de conflits ni de tri LOOT lancé d'ici.
 */
export const ModAssistant = ({
  mod,
  onOpenConflicts,
}: {
  mod: IMod;
  onOpenConflicts?: () => void;
}) => {
  const { t } = useTranslation(["common"]);
  const extensions = React.useContext(ExtensionContext);
  const gameId = useSelector(activeGameId);
  const mods = useSelector((s: IState) => s.persistent.mods?.[gameId]);
  const conflicts = useSelector(
    (s: IState) =>
      (s.session as { dependencies?: { conflicts?: { [id: string]: IModConflict[] } } })
        .dependencies?.conflicts,
  );
  const loggedIn = useSelector((s: IState) => userInfo(s) !== undefined);
  const requirements = useSelector((s: IState) => modRequirementsCheckResult(s));
  const pluginInfo = useSelector(
    (s: IState) => (s as IStateWithGamebryo).session.plugins?.pluginInfo,
  );
  const openUrl = useOpenUrl();

  const items = useMemo(
    () =>
      explainMod(mod, {
        conflicts,
        mods: mods ?? {},
        nexus: {
          loggedIn,
          checked: requirements !== undefined,
          requirements: requirements?.[mod.id],
        },
        plugins: Object.values(pluginInfo ?? {}).filter((p) => p.modId === mod.id),
      }),
    [mod, conflicts, mods, loggedIn, requirements, pluginInfo],
  );

  const onAction = (id: ExistingActionId) => {
    if (id === "open-conflict-editor") {
      onOpenConflicts?.();
    } else {
      extensions?.getApi().events.emit("show-main-page", "gamebryo-plugins");
    }
  };

  return (
    <AssistantPanel
      title={t("Conflicts and dependencies")}
      items={items}
      onAction={onAction}
      onOpenUrl={openUrl}
    />
  );
};
