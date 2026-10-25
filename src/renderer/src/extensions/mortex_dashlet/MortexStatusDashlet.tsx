import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import Dashlet from "../../controls/Dashlet";
import type { IState } from "../../types/IState";
import type { IDownload } from "../download_management/types/IDownload";
import { useDeployMods } from "../mod_management/hooks/useDeployMods.hook";
import { isLoggedIn, isPremium } from "../nexus_integration/selectors";
import { activeGameId, activeProfile } from "../profile_management/selectors";

const NONE = {};
const NO_DOWNLOADS: { [id: string]: IDownload } = {};

/**
 * mORTEX : l'accueil en trois cartes (mods, téléchargements, compte et déploiement), comme
 * dans la maquette. Lecture seule : un résumé de l'état, sans action cachée.
 */
function MortexStatusDashlet() {
  const { t } = useTranslation(["common"]);
  const gameId = useSelector(activeGameId);
  const profile = useSelector(activeProfile);
  const mods = useSelector((state: IState) => state.persistent.mods?.[gameId] ?? NONE);
  const downloads = useSelector(
    (state: IState) => state.persistent.downloads?.files ?? NO_DOWNLOADS,
  );
  const loggedIn = useSelector(isLoggedIn);
  const premium = useSelector(isPremium);
  const { needToDeploy, isDeploying } = useDeployMods();

  const counts = useMemo(() => {
    const installed = Object.keys(mods).filter((id) => mods[id]?.state === "installed");
    const enabled = installed.filter((id) => profile?.modState?.[id]?.enabled === true).length;
    const dls = Object.values(downloads).filter(
      (dl) => gameId === undefined || (dl?.game ?? []).includes(gameId),
    );
    const active = dls.filter((dl) => dl?.state === "started" || dl?.state === "paused").length;
    return { installed: installed.length, enabled, downloads: dls.length, active };
  }, [mods, downloads, profile, gameId]);

  let deployment = t("Up to date");
  if (isDeploying) {
    deployment = t("In progress");
  } else if (needToDeploy) {
    deployment = t("Changes pending");
  }

  return (
    <Dashlet className="mortex-status-dashlet" title="">
      <div className="mortex-cards">
        <div className="mortex-card">
          <h5>{t("Mods")}</h5>
          <div className="mortex-card-big">
            {counts.enabled} / {counts.installed}
          </div>
          <p>{t("enabled / installed")}</p>
        </div>

        <div className="mortex-card">
          <h5>{t("Downloads")}</h5>
          <div className="mortex-card-big">
            {t("{{count}} in progress", { count: counts.active })}
          </div>
          <p>{t("{{count}} archives", { count: counts.downloads })}</p>
        </div>

        <div className="mortex-card">
          <h5>{t("Deployment")}</h5>
          <div className="mortex-card-big mortex-card-mid">{deployment}</div>
          <p>
            {loggedIn
              ? premium
                ? t("Nexus: connected (Premium)")
                : t("Nexus: connected")
              : t("Nexus: not connected")}
          </p>
        </div>
      </div>
    </Dashlet>
  );
}

export default MortexStatusDashlet;
