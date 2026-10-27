/**
 * mORTEX (macOS) : l'Atelier DXMT. Bilan de la bouteille du jeu (moteur, pont ENB, SSE Display
 * Tweaks, doublons de Bottled Shaders) et cartes des pièges rencontrés avec leurs solutions.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { discoveryByGame } from "@/extensions/gamemode_management/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Icon, type SymbolName } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { log } from "@/util/log";
import { bottleForPath } from "@/util/macos/bottles";
import {
  type DxmtCheckId,
  type IDxmtCheck,
  fixDisplayTweaks,
  runDxmtChecks,
} from "@/util/macos/dxmtChecks";
import { activeGameId } from "@/util/selectors";
import MainPage from "@/views/MainPage";

import { PITFALLS } from "./pitfalls";

interface IProps {
  api: IExtensionApi;
}

const CHECK_LABELS: Record<DxmtCheckId, string> = {
  engine: "Graphics backend",
  bridge: "mDLSS ENB bridge",
  displayTweaks: "SSE Display Tweaks",
  bottledDuplicates: "Bottled Shaders duplicates",
};

const STATUS_LOOK = {
  ok: { icon: "check_circle", brand: "success" },
  warning: { icon: "warning", brand: "warning" },
  error: { icon: "error", brand: "danger" },
  na: { icon: "do_not_disturb_on", brand: "neutral" },
} as const;

function statusText(check: IDxmtCheck, t: IProps["api"]["translate"]): string {
  switch (check.id) {
    case "engine":
      return check.found ? check.found.toUpperCase() : t("Unknown");
    case "bridge":
      return check.status === "ok" ? t("Installed") : t("Not installed (optional)");
    case "displayTweaks":
      return check.status === "na"
        ? t("Not installed")
        : check.status === "ok"
          ? t("Optimized for DXMT")
          : (check.found ?? "");
    case "bottledDuplicates":
      return check.status === "ok" ? t("None") : (check.found ?? "");
  }
}

export default function DxmtWorkshopPage({ api }: IProps) {
  const t = useCallback(
    (text: string, options?: Record<string, unknown>) =>
      api.translate(text, { ns: "common", ...options }),
    [api],
  );
  const gamePath = useSelector(
    (state: IState) => discoveryByGame(state, activeGameId(state))?.path,
  );
  const bottle = gamePath !== undefined ? bottleForPath(gamePath) : undefined;
  const [checks, setChecks] = useState<IDxmtCheck[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (bottle === undefined || gamePath === undefined) return;
    runDxmtChecks(bottle.path, gamePath)
      .then(setChecks)
      .catch((err) => log("warn", "DXMT checks failed", { error: (err as Error).message }));
  }, [bottle?.path, gamePath]);

  useEffect(refresh, [refresh]);

  const fixTweaks = () => {
    if (gamePath === undefined) return;
    setBusy(true);
    fixDisplayTweaks(gamePath)
      .then(() =>
        api.sendNotification?.({
          type: "success",
          message: "SSE Display Tweaks optimized for DXMT",
          displayMS: 4000,
        }),
      )
      .catch((err) => api.showErrorNotification?.("Failed to change SSE Display Tweaks", err))
      .finally(() => {
        setBusy(false);
        refresh();
      });
  };

  const statusOf = (id?: DxmtCheckId) => checks.find((check) => check.id === id)?.status;

  return (
    <MainPage id="dxmt-workshop-page">
      <MainPage.Body className="h-full overflow-y-auto">
        <div className="flex flex-col gap-y-5 p-6">
          <div className="flex items-center gap-x-3">
            <Icon className="text-warning-strong" name="memory" size="lg" />
            <Typography className="font-semibold" typographyType="heading-sm">
              {t("DXMT workshop")}
            </Typography>
            <Typography
              brand="warning"
              className="rounded-sm bg-warning-weak px-2"
              typographyType="body-xs"
            >
              {t("Mac exclusive")}
            </Typography>
            <Typography appearance="moderate" className="ml-auto" typographyType="body-sm">
              {bottle !== undefined
                ? t("Bottle {{name}}", { replace: { name: bottle.name } })
                : t("No bottle")}
            </Typography>
            <Button
              appearance="moderate"
              brand="neutral"
              leftIcon="refresh"
              title={t("Refresh")}
              onClick={refresh}
            />
          </div>

          <Typography appearance="moderate" typographyType="body-md">
            {t(
              "Modern rendering for Skyrim SE on a Mac: Community Shaders and ENB presets run under CrossOver with DXMT. This page checks your bottle and explains the pitfalls we solved.",
            )}
          </Typography>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
            {checks.map((check) => {
              const look = STATUS_LOOK[check.status];
              return (
                <div
                  className="rounded-md bg-surface-mid px-3 py-2.5"
                  data-testid={`dxmt-check-${check.id}`}
                  key={check.id}
                >
                  <Typography appearance="moderate" typographyType="body-xs">
                    {t(CHECK_LABELS[check.id])}
                  </Typography>
                  <Typography
                    brand={look.brand}
                    className="flex items-center gap-x-1 font-semibold"
                    typographyType="body-md"
                  >
                    <Icon name={look.icon} size="sm" />
                    {statusText(check, api.translate)}
                  </Typography>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(24rem,1fr))] gap-4">
            {PITFALLS.map((pitfall) => {
              const status = statusOf(pitfall.check);
              const detected = status === "error" || status === "warning";
              return (
                <div
                  className={`flex flex-col gap-y-2 rounded-md bg-surface-mid p-4 ${detected ? "ring-1 ring-danger-moderate" : ""}`}
                  data-testid={`dxmt-pitfall-${pitfall.id}`}
                  key={pitfall.id}
                >
                  <div className="flex items-center gap-x-2">
                    <Icon
                      className={detected ? "text-danger-strong" : "text-neutral-subdued"}
                      name={pitfall.icon as SymbolName}
                      size="md"
                    />
                    <Typography className="font-semibold" typographyType="body-lg">
                      {t(pitfall.title)}
                    </Typography>
                    {detected && (
                      <Typography brand="danger" className="ml-auto" typographyType="body-xs">
                        {t("Detected in your bottle")}
                      </Typography>
                    )}
                  </div>
                  {(
                    [
                      ["Symptom", pitfall.symptom],
                      ["Cause", pitfall.cause],
                      ["Solution", pitfall.fix],
                    ] as const
                  ).map(([label, text]) => (
                    <div key={label}>
                      <Typography appearance="moderate" typographyType="body-xs">
                        {t(label)}
                      </Typography>
                      <Typography typographyType="body-sm">{t(text)}</Typography>
                    </div>
                  ))}
                  {pitfall.id === "swap-effect" && detected && (
                    <Button
                      className="self-start"
                      isLoading={busy}
                      leftIcon="build"
                      size="sm"
                      onClick={fixTweaks}
                    >
                      {t("Fix it")}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}
