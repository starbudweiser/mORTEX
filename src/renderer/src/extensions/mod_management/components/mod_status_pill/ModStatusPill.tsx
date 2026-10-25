import React from "react";
import { useTranslation } from "react-i18next";

import { joinClasses } from "@/ui/utils/joinClasses";

import type { IModWithState } from "../../types/IModProps";
import { modHasUpdate } from "../../util/mod_has_update/modHasUpdate";

export type ModStatusKind = "ok" | "update" | "absent" | "busy";

/** mORTEX : l'état d'un mod en un mot, pour la pastille de la liste. */
export const modStatusKind = (mod: IModWithState): ModStatusKind => {
  if (mod.state === "downloaded") {
    return "absent";
  }
  if (mod.state === "installing") {
    return "busy";
  }
  return modHasUpdate(mod) ? "update" : "ok";
};

const LABELS: Record<ModStatusKind, string> = {
  ok: "Up-to-date",
  update: "Update available",
  absent: "Not installed",
  busy: "Installing",
};

/** Une pastille colorée, toujours accompagnée de son mot (jamais la couleur seule). */
export const ModStatusPill = ({ mod }: { mod: IModWithState }) => {
  const { t } = useTranslation(["common"]);
  const kind = modStatusKind(mod);

  return (
    <span className={joinClasses(["mortex-pill", `mortex-pill-${kind}`])}>{t(LABELS[kind])}</span>
  );
};
