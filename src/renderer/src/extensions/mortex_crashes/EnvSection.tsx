import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { listBottles, readRegString, type IBottle } from "../../util/macos/bottles";
import { SuspectRow } from "./CrashParts";
import { diagnoseEnvironment } from "./envDiagnostics";
import type { FileIndex, ILinkedEvent } from "./linking";

const dllOverride = (bottle: IBottle, dll: string) =>
  readRegString(bottle, "HKEY_CURRENT_USER", "Software\\Wine\\DllOverrides", dll);

/** Diagnostic de l'environnement Mac : constats `env` de sKYCRASH recoupés avec la bouteille de mORTEX. */
export const EnvSection = ({ entry, files }: { entry: ILinkedEvent; files: FileIndex }) => {
  const { t } = useTranslation(["common"]);
  const report = useMemo(
    () =>
      diagnoseEnvironment(
        entry.event,
        entry.suspects.filter((s) => s.status === "env"),
        { bottles: listBottles(), dllOverride, files },
      ),
    [entry, files],
  );
  const { event } = entry;
  const versions = [
    event.game_runtime && t("Game {{version}}", { version: event.game_runtime }),
    event.skse_runtime && `SKSE ${event.skse_runtime}`,
  ].filter(Boolean);

  if (report.findings.length === 0 && report.bottle === undefined && versions.length === 0) {
    return null;
  }
  return (
    <section className="mortex-crash-env">
      <h6>{t("Mac environment")}</h6>
      <p className="mortex-crash-meta">
        {[
          ...versions,
          report.bottle &&
            (report.bottle.known
              ? t("Bottle “{{name}}” ({{kind}})", {
                  name: report.bottle.name,
                  kind: report.bottle.kind,
                })
              : t("Bottle “{{name}}” unknown to mORTEX", { name: report.bottle.name })),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {report.findings.length > 0 && (
        <ul className="mortex-suspects">
          {report.findings.map(({ linked, notes }, i) => (
            <SuspectRow key={linked.suspect.name} linked={linked} rank={i + 1}>
              {notes.length > 0 && (
                <ul className="mortex-suspect-notes">
                  {notes.map((note, j) => (
                    <li key={j}>{t(note.key, note.params)}</li>
                  ))}
                </ul>
              )}
            </SuspectRow>
          ))}
        </ul>
      )}
    </section>
  );
};
