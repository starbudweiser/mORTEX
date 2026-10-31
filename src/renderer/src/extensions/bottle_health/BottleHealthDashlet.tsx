/**
 * mORTEX (macOS) : carte « Santé de la bouteille » du tableau de bord. Une ligne par contrôle
 * (util/macos/bottleHealth), avec « Corriger » quand mORTEX sait le faire.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import Dashlet from "@/controls/Dashlet";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { log } from "@/util/log";
import {
  checkBottleHealth,
  enableMsync,
  type HealthCheckId,
  type IHealthCheck,
} from "@/util/macos/bottleHealth";
import { bottleForPath } from "@/util/macos/bottles";
import { syncDllOverrides } from "@/util/macos/dllOverrides";

import { discoveryByGame } from "../gamemode_management/selectors";
import { activeGameId } from "../profile_management/selectors";
import { DuplicatesRow } from "./DuplicatesRow";

const LABELS: Record<HealthCheckId, string> = {
  runtime: "Wine layer",
  engine: "Graphics backend",
  msync: "MSync",
  rosetta: "Rosetta 2",
  filesystem: "Game disk",
  space: "Free space",
  overrides: "DLL overrides",
};

// couleur posée sur l'icône elle-même : le style des cartes mORTEX l'écraserait sinon
const LOOK = {
  ok: { icon: "check_circle", color: "!text-success-strong" },
  warning: { icon: "warning", color: "!text-warning-strong" },
  error: { icon: "error", color: "!text-danger-strong" },
  info: { icon: "info", color: "!text-neutral-subdued" },
} as const;

function BottleHealthDashlet({ api }: { api: IExtensionApi }) {
  const { t } = useTranslation(["common"]);
  const gamePath = useSelector(
    (state: IState) => discoveryByGame(state, activeGameId(state))?.path,
  );
  const bottle = gamePath !== undefined ? bottleForPath(gamePath) : undefined;
  const [checks, setChecks] = useState<IHealthCheck[]>([]);
  const [fixing, setFixing] = useState<HealthCheckId | undefined>(undefined);

  const refresh = useCallback(() => {
    if (bottle === undefined || gamePath === undefined) return;
    checkBottleHealth(bottle, gamePath)
      .then(setChecks)
      .catch((err) => log("warn", "bottle health failed", { error: (err as Error).message }));
  }, [bottle?.path, gamePath]);

  useEffect(refresh, [refresh]);

  const text = (check: IHealthCheck): string => {
    switch (check.id) {
      case "msync":
        return check.value === "on" ? t("On") : t("Off: slower game in CrossOver");
      case "rosetta":
        return check.value === "on" ? t("Installed") : t("Missing: CrossOver needs it");
      case "filesystem":
        return check.value === "APFS"
          ? t("APFS: links and clones")
          : check.value === "HFS"
            ? t("{{fs}}: links, no clones", { fs: "HFS+" })
            : t("{{fs}}: no links, deployment will copy files", { fs: check.value || "?" });
      case "space":
        return t("{{size}} GB", { size: check.value });
      case "overrides":
        return check.status === "ok"
          ? t("Up to date")
          : t("Missing for {{dlls}}", { dlls: check.value });
      default:
        return check.value || t("Unknown");
    }
  };

  const fix = (id: HealthCheckId) => {
    if (bottle === undefined || gamePath === undefined) return;
    setFixing(id);
    const work = id === "msync" ? enableMsync(bottle) : syncDllOverrides(bottle, gamePath);
    Promise.resolve(work)
      .catch((err) => api.showErrorNotification?.("Failed to fix the bottle", err))
      .finally(() => {
        setFixing(undefined);
        refresh();
      });
  };

  if (bottle === undefined) return null;

  return (
    <Dashlet className="mortex-status-dashlet" title="">
      <div className="mortex-card">
        <h5>{t("Bottle {{name}}", { name: bottle.name })}</h5>
        <div className="flex flex-col gap-y-1.5">
          {checks.map((check) => {
            const look = LOOK[check.status];
            return (
              <div
                className="flex items-center gap-x-2"
                data-testid={`bottle-health-${check.id}`}
                key={check.id}
              >
                <Icon className={`shrink-0 ${look.color}`} name={look.icon} size="sm" />
                <Typography
                  appearance="moderate"
                  className="w-36 shrink-0"
                  typographyType="body-sm"
                >
                  {t(LABELS[check.id])}
                </Typography>
                <Typography className="min-w-0 truncate" typographyType="body-sm">
                  {text(check)}
                </Typography>
                {check.fixable === true && (
                  <Button
                    isLoading={fixing === check.id}
                    leftIcon="build"
                    size="sm"
                    onClick={() => fix(check.id)}
                  >
                    {t("Fix it")}
                  </Button>
                )}
              </div>
            );
          })}
          <DuplicatesRow api={api} />
        </div>
      </div>
    </Dashlet>
  );
}

export default BottleHealthDashlet;
