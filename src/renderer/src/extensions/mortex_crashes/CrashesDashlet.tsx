import React from "react";
import { useTranslation } from "react-i18next";

import Dashlet from "../../controls/Dashlet";
import { formatCrashTime, SuspectRow } from "./CrashParts";
import { useCrashes } from "./crashStore";
import { EnvSection } from "./EnvSection";
import { modAppearance, RECURRENCE_WINDOW } from "./linking";

const MAX_SUSPECTS = 5;

/**
 * mORTEX : carte « Plantages » de l'Accueil. Dernier plantage analysé par sKYCRASH, ses suspects
 * classés avec les raisons de sKYCRASH telles quelles, et le mod de mORTEX concerné quand il y en
 * a un. Lecture seule : rien n'est modifié.
 */
function CrashesDashlet() {
  const { t } = useTranslation(["common"]);
  const { available, events, skipped, files } = useCrashes();
  const last = events[0];

  return (
    <Dashlet className="mortex-status-dashlet mortex-crashes" title="">
      <div className="mortex-card mortex-card-crashes">
        <h5>{t("Crashes")}</h5>

        {!available && (
          <>
            <div className="mortex-card-big mortex-card-mid">{t("No sKYCRASH export found")}</div>
            <p>{t("Analyse a crash log with sKYCRASH and its result appears here.")}</p>
          </>
        )}
        {available && last === undefined && (
          <div className="mortex-card-big mortex-card-mid">{t("No crash analysed")}</div>
        )}

        {last !== undefined && (
          <>
            <div className="mortex-card-big mortex-card-mid">
              {formatCrashTime(last.event.crash_time)}
            </div>
            <p className="mortex-crash-meta">
              {[
                last.event.log_name,
                t("{{count}} crashes analysed", { count: events.length }),
              ].join(" · ")}
            </p>
            {!!last.event.verdict && <p className="mortex-crash-verdict">{last.event.verdict}</p>}

            <ul className="mortex-suspects">
              {last.suspects
                .filter((s) => s.status !== "env")
                .slice(0, MAX_SUSPECTS)
                .map((linked, i) => {
                  const modId = linked.candidates[0]?.modId;
                  const seen = modId === undefined ? undefined : modAppearance(modId, events);
                  return (
                    <SuspectRow key={linked.suspect.name} linked={linked} rank={i + 1}>
                      {seen !== undefined && seen.count > 0 && (
                        <p className="mortex-suspect-where">
                          {t("In {{count}} of the last {{total}} crashes", {
                            count: seen.count,
                            total: Math.min(seen.total, RECURRENCE_WINDOW),
                          })}
                        </p>
                      )}
                    </SuspectRow>
                  );
                })}
            </ul>

            <EnvSection entry={last} files={files} />
          </>
        )}

        {skipped > 0 && (
          <p className="mortex-crash-meta">
            {t("{{count}} unreadable lines ignored", { count: skipped })}
          </p>
        )}
      </div>
    </Dashlet>
  );
}

export default CrashesDashlet;
