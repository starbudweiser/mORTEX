import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";

import type { IMod } from "../mod_management/types/IMod";
import { formatCrashTime } from "./CrashParts";
import { useCrashes } from "./crashStore";
import { modAppearance } from "./linking";

/**
 * mORTEX : section « Plantages » de la fiche d'un mod. Dit si sKYCRASH a désigné ce mod dans les
 * derniers plantages, avec son rang, ses raisons et sa récurrence. Lecture seule ; le bouton
 * ouvre l'éditeur de conflits existant.
 */
export const ModCrashes = ({
  mod,
  onOpenConflicts,
}: {
  mod: IMod;
  onOpenConflicts?: () => void;
}) => {
  const { t } = useTranslation(["common"]);
  const { events } = useCrashes();
  if (events.length === 0) {
    return null;
  }
  const seen = modAppearance(mod.id, events);
  const latest = seen.latest;

  return (
    <section className="mortex-inspector-crashes">
      <h6>{t("Crashes")}</h6>
      {latest === undefined ? (
        <p>{t("Not a suspect in the last {{count}} crashes.", { count: seen.total })}</p>
      ) : (
        <>
          <p>
            {t("Suspect no. {{rank}} of {{total}} in the last crash where it appears ({{date}}).", {
              rank: latest.rank,
              total: latest.linked.suspects.length,
              date: formatCrashTime(latest.linked.event.crash_time),
            })}
          </p>
          <p className="mortex-suspect-where">
            {t("In {{count}} of the last {{total}} crashes", {
              count: seen.count,
              total: seen.total,
            })}
          </p>
          <ul className="mortex-suspect-reasons">
            <li>
              {latest.suspect.suspect.name} · {latest.suspect.suspect.score}
            </li>
            {latest.suspect.suspect.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          {onOpenConflicts !== undefined && (
            <Button appearance="moderate" brand="neutral" size="sm" onClick={onOpenConflicts}>
              {t("Manage file conflicts")}
            </Button>
          )}
        </>
      )}
    </section>
  );
};
