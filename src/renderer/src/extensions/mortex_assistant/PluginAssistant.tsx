import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { getCurrentLanguage } from "@/util/i18n";

import type { IPluginCombined } from "../gamebryo_plugin_management/types/IPlugins";
import type { IStateWithGamebryo } from "../gamebryo_plugin_management/types/IStateWithGamebryo";
import { nativePlugins } from "../gamebryo_plugin_management/util/gameSupport";
import { activeGameId } from "../profile_management/selectors";
import { AssistantPanel } from "./AssistantPanel";
import { explainPlugin } from "./explain/plugin";
import { useOpenUrl } from "./useOpenUrl";

/** mORTEX : attribut de détail de l'inspecteur Plugins. Calcul pour le plugin sélectionné seulement. */
export const PluginAssistant = ({ plugin }: { plugin: IPluginCombined }) => {
  const { t } = useTranslation(["common"]);
  const gameId = useSelector(activeGameId);
  const pluginList = useSelector(
    (s: IState) => (s as IStateWithGamebryo).session.plugins.pluginList,
  );
  const loadOrder = useSelector((s: IState) => (s as IStateWithGamebryo).loadOrder);
  const openUrl = useOpenUrl();
  const items = useMemo(
    () =>
      explainPlugin(plugin, {
        pluginList: pluginList ?? {},
        loadOrder: loadOrder ?? {},
        natives: nativePlugins(gameId),
        language: getCurrentLanguage(),
      }),
    [plugin, pluginList, loadOrder, gameId],
  );
  return <AssistantPanel title={t("Assistant")} items={items} lootSortNote onOpenUrl={openUrl} />;
};
