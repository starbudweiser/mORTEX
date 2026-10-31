import React, { type FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useDeployMods } from "@/extensions/mod_management/hooks/useDeployMods.hook";
import {
  isLoggedIn as isLoggedInSelector,
  isPremium as isPremiumSelector,
} from "@/extensions/nexus_integration/selectors";
import { activeGameId, activeProfile } from "@/extensions/profile_management/selectors";
import type { IState } from "@/types/IState";

const NO_MODS = {};

/**
 * mORTEX : la barre d'état au pied de la fenêtre (mods, déploiement, compte Nexus), comme dans
 * la maquette. Lecture seule : elle ne fait que résumer l'état.
 */
export const StatusBar: FC = () => {
  const { t } = useTranslation(["common"]);
  const gameId = useSelector(activeGameId);
  const profile = useSelector(activeProfile);
  const mods = useSelector((state: IState) => state.persistent.mods?.[gameId] ?? NO_MODS);
  const loggedIn = useSelector(isLoggedInSelector);
  const premium = useSelector(isPremiumSelector);
  const { needToDeploy, isDeploying } = useDeployMods();

  const { installed, enabled } = useMemo(() => {
    const ids = Object.keys(mods).filter((id) => mods[id]?.state === "installed");
    const on = ids.filter((id) => profile?.modState?.[id]?.enabled === true).length;
    return { installed: ids.length, enabled: on };
  }, [mods, profile]);

  if (gameId === undefined) {
    return null;
  }

  let deployment = t("Deployment: up to date");
  if (isDeploying) {
    deployment = t("Deployment: in progress");
  } else if (needToDeploy) {
    deployment = t("Deployment: changes pending");
  }

  let nexus = t("Nexus: not connected");
  if (loggedIn) {
    nexus = premium ? t("Nexus: connected (Premium)") : t("Nexus: connected");
  }

  return (
    <div className="mortex-statusbar" data-testid="mortex-statusbar" role="status">
      <span>{t("{{count}} mods installed", { count: installed })}</span>
      <span>{t("{{count}} enabled", { count: enabled })}</span>
      <span className={needToDeploy ? "mortex-statusbar-warn" : undefined}>{deployment}</span>
      <span
        className={`mortex-statusbar-end ${loggedIn && premium ? "mortex-statusbar-ok" : "mortex-statusbar-warn"}`}
      >
        {nexus}
      </span>
    </div>
  );
};
