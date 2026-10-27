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
import { RECIPES, RENDER_PATH, type IRenderStage } from "./renderPath";

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
      return check.status === "na"
        ? t("Bottled Shaders not installed")
        : check.status === "ok"
          ? t("None")
          : (check.found ?? "");
  }
}

type Translate = (text: string, options?: Record<string, unknown>) => string;

function SectionTitle({ icon, children }: { icon: SymbolName; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-x-2 pt-2">
      <Icon className="text-neutral-subdued" name={icon} size="md" />
      <Typography className="font-semibold" typographyType="body-xl">
        {children}
      </Typography>
    </div>
  );
}

/** une étape du chemin du rendu, colorée d'après le contrôle qui la concerne */
function RenderStage({
  stage,
  status,
  t,
}: {
  stage: IRenderStage;
  status?: IDxmtCheck["status"];
  t: Translate;
}) {
  // absente de la bouteille : en pointillés
  const missing = status === "na";
  const frame =
    status === "error"
      ? "ring-1 ring-danger-moderate"
      : missing
        ? "border border-dashed border-stroke-moderate"
        : status === "ok"
          ? "ring-1 ring-success-moderate"
          : "";
  const iconColor =
    status === "error"
      ? "text-danger-strong"
      : missing
        ? "text-neutral-subdued"
        : status === "ok"
          ? "text-success-strong"
          : "text-warning-strong";
  return (
    <div
      className={`flex min-w-0 flex-1 basis-36 flex-col items-center gap-y-1 rounded-md bg-surface-mid px-3 py-3 text-center ${frame} ${missing ? "opacity-70" : ""}`}
      data-testid={`dxmt-stage-${stage.id}`}
    >
      <Icon className={iconColor} name={stage.icon as SymbolName} size="lg" />
      <Typography className="font-semibold" typographyType="body-md">
        {t(stage.name)}
      </Typography>
      <Typography appearance="moderate" typographyType="body-xs">
        {t(stage.role)}
      </Typography>
      {missing ? (
        <Typography appearance="subdued" typographyType="body-xs">
          {stage.optional === true ? t("Optional, for ENB presets") : t("Not installed")}
        </Typography>
      ) : (
        stage.optional === true &&
        status === "ok" && (
          <Typography brand="success" typographyType="body-xs">
            {t("Installed")}
          </Typography>
        )
      )}
    </div>
  );
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
                  <Typography className="!text-[#f59e0b]" typographyType="body-xs">
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

          <SectionTitle icon="route">{t("How a frame reaches your Mac")}</SectionTitle>
          <div className="flex flex-wrap items-stretch gap-2">
            {RENDER_PATH.map((stage, idx) => (
              <React.Fragment key={stage.id}>
                {idx > 0 && (
                  <Icon
                    className="self-center text-neutral-subdued"
                    name="arrow_forward"
                    size="md"
                  />
                )}
                <RenderStage stage={stage} status={statusOf(stage.check)} t={t} />
              </React.Fragment>
            ))}
          </div>

          <SectionTitle icon="menu_book">{t("Recipes")}</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(24rem,1fr))] gap-4">
            {RECIPES.map((recipe) => (
              <div
                className="flex flex-col gap-y-3 rounded-md bg-surface-mid p-4"
                data-testid={`dxmt-recipe-${recipe.id}`}
                key={recipe.id}
              >
                <div className="flex items-center gap-x-2">
                  <Icon
                    className="text-warning-strong"
                    name={recipe.icon as SymbolName}
                    size="md"
                  />
                  <div>
                    <Typography className="font-semibold" typographyType="body-lg">
                      {t(recipe.title)}
                    </Typography>
                    <Typography appearance="moderate" typographyType="body-xs">
                      {t(recipe.intro)}
                    </Typography>
                  </div>
                </div>
                <ol className="flex flex-col gap-y-2">
                  {recipe.steps.map((step, idx) => {
                    const status = statusOf(step.check);
                    const done = status === "ok";
                    const wrong = status === "error" || status === "warning";
                    return (
                      <li className="flex items-start gap-x-2" key={step.text}>
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-success-moderate" : wrong ? "bg-danger-moderate" : "bg-surface-high"}`}
                        >
                          {done ? <Icon name="check" size="xs" /> : idx + 1}
                        </span>
                        <Typography typographyType="body-sm">{t(step.text)}</Typography>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>

          <SectionTitle icon="build">{t("Pitfalls we solved")}</SectionTitle>
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
                    <Typography className="font-semibold !text-[#f59e0b]" typographyType="body-lg">
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
