/**
 * mORTEX (macOS) : ligne « Doublons » de la carte de santé. Analyse le dossier de préparation à la
 * demande, puis remplace les doublons par des clones APFS (util/macos/dedupe). Les mods sont
 * retirés du jeu le temps de l'opération puis redéployés : les liens de Data suivent ainsi les
 * nouveaux fichiers.
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { cloneDuplicates, findDuplicates, type IDuplicates } from "@/util/macos/dedupe";

import { installPathForGame } from "../mod_management/selectors";
import { activeGameId } from "../profile_management/selectors";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

export function formatSize(bytes: number, t: (key: string, options?: object) => string): string {
  return bytes >= GB
    ? t("{{size}} GB", { size: (bytes / GB).toFixed(1) })
    : t("{{size}} MB", { size: Math.max(1, Math.round(bytes / MB)) });
}

type Callback = (err: Error | null) => void;
const asPromise = (start: (callback: Callback) => void) =>
  new Promise<void>((resolve, reject) => start((err) => (err ? reject(err) : resolve())));

export function DuplicatesRow({ api }: { api: IExtensionApi }) {
  const { t } = useTranslation(["common"]);
  const staging = useSelector((state: IState) => installPathForGame(state, activeGameId(state)));
  const [found, setFound] = useState<IDuplicates | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const analyze = () => {
    if (staging === undefined) return;
    setBusy(true);
    findDuplicates(staging)
      .then(setFound)
      .catch((err) => api.showErrorNotification?.("Failed to look for duplicates", err))
      .finally(() => setBusy(false));
  };

  const reclaim = () => {
    if (found === undefined) return;
    api
      .showDialog?.(
        "question",
        "Turn duplicates into clones?",
        {
          text: t(
            "{{count}} identical files become APFS clones of a single copy: same content, stored once. Your mods are removed from the game during the operation, then deployed again.",
            { count: found.files },
          ),
        },
        [{ label: "Cancel" }, { label: "Reclaim" }],
      )
      .then(async (result) => {
        if (result.action !== "Reclaim") return;
        setBusy(true);
        try {
          await asPromise((callback) => api.events.emit("purge-mods", false, callback));
          const saved = await cloneDuplicates(found.groups);
          await asPromise((callback) =>
            api.events.emit("deploy-mods", callback, undefined, undefined, { manual: true }),
          );
          api.sendNotification?.({
            type: "success",
            message: "Reclaimed {{size}} with APFS clones",
            replace: { size: formatSize(saved, t) },
            displayMS: 6000,
          });
          setFound({ groups: [], savings: 0, files: 0 });
        } catch (err) {
          api.showErrorNotification?.("Failed to turn duplicates into clones", err);
        } finally {
          setBusy(false);
        }
      });
  };

  if (staging === undefined) return null;

  const recoverable = found !== undefined && found.savings > 0;
  return (
    <div className="flex items-center gap-x-2" data-testid="bottle-health-duplicates">
      <Icon
        className={`shrink-0 ${recoverable ? "!text-warning-strong" : "!text-neutral-subdued"}`}
        name={recoverable ? "content_copy" : "info"}
        size="sm"
      />
      <Typography appearance="moderate" className="w-36 shrink-0" typographyType="body-sm">
        {t("Duplicate files")}
      </Typography>
      <Typography className="min-w-0 flex-1 truncate" typographyType="body-sm">
        {found === undefined
          ? t("Not analyzed")
          : recoverable
            ? t("{{size}} to reclaim ({{count}} files)", {
                size: formatSize(found.savings, t),
                count: found.files,
              })
            : t("None")}
      </Typography>
      {recoverable ? (
        <Button isLoading={busy} leftIcon="compress" size="sm" onClick={reclaim}>
          {t("Reclaim")}
        </Button>
      ) : (
        <Button
          appearance="moderate"
          brand="neutral"
          isLoading={busy}
          leftIcon="search"
          size="sm"
          onClick={analyze}
        >
          {t("Analyze")}
        </Button>
      )}
    </div>
  );
}
