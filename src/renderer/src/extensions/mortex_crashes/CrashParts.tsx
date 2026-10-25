import path from "path";

import React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { ExtensionContext } from "@/ExtensionProvider";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { getCurrentLanguage } from "@/util/i18n";

import { installPathForGame } from "../mod_management/selectors";
import type { IMod } from "../mod_management/types/IMod";
import { activeGameId } from "../profile_management/selectors";
import type { ILinkedSuspect } from "./linking";

const KIND_LABEL = {
  dll: "SKSE plugin (DLL)",
  plugin: "Plugin",
  object: "Game object",
  mod: "Mod",
  env: "Environment",
} as const;

/** Noms stables des constats d'environnement de sKYCRASH. */
const ENV_LABEL: Record<string, string> = {
  wine_layer: "Wine / CrossOver layer",
  "renderer:D3DMetal": "Renderer: D3DMetal",
  "renderer:DXVK": "Renderer: DXVK",
  "renderer:DXMT": "Renderer: DXMT",
  dlss_unavailable: "DLSS unavailable under Wine",
  unified_memory: "Unified memory",
  memory_pressure: "Memory pressure",
  game_skse_mismatch: "Game / SKSE version mismatch",
  address_library_missing: "Address Library missing",
  plugin_limit: "Plugin limit",
  graphics_proxy: "Graphics proxy DLL",
};

export const formatCrashTime = (time: string): string => {
  const date = new Date(time);
  return Number.isNaN(date.getTime())
    ? time
    : date.toLocaleString(getCurrentLanguage(), { dateStyle: "medium", timeStyle: "short" });
};

/** Actions existantes de mORTEX sur un mod : Finder et page Nexus. Rien n'est appliqué seul. */
export function useModLinks(): {
  mods: { [id: string]: IMod };
  showInFinder: (mod: IMod) => void;
  openNexus: (mod: IMod) => void;
} {
  const extensions = React.useContext(ExtensionContext);
  const gameId = useSelector(activeGameId);
  const mods = useSelector((state: IState) => state.persistent.mods?.[gameId]) ?? {};
  const staging = useSelector((state: IState) => installPathForGame(state, gameId));
  return {
    mods,
    showInFinder: (mod) => {
      if (mod.installationPath !== undefined) {
        window.api.shell.showItemInFolder(path.join(staging, mod.installationPath));
      }
    },
    openNexus: (mod) => {
      const attributes = mod.attributes ?? {};
      extensions
        ?.getApi()
        .events.emit("open-mod-page", attributes.downloadGame ?? gameId, attributes.modId, "nexus");
    },
  };
}

export const hasNexusPage = (mod: IMod | undefined): boolean =>
  mod?.attributes?.source === "nexus" && mod.attributes.modId !== undefined;

/** Un suspect : nom, nature, score, mods trouvés (ou « hors mORTEX »), raisons de sKYCRASH telles quelles. */
export const SuspectRow = ({
  linked,
  rank,
  children,
}: {
  linked: ILinkedSuspect;
  rank: number;
  children?: React.ReactNode;
}) => {
  const { t } = useTranslation(["common"]);
  const { mods, showInFinder, openNexus } = useModLinks();
  const { suspect, status, candidates } = linked;
  const modIds = [...new Set(candidates.map((c) => c.modId))];

  return (
    <li className="mortex-suspect">
      <div className="mortex-suspect-head">
        <span className="mortex-suspect-rank">{rank}</span>
        <strong>{ENV_LABEL[suspect.name] ? t(ENV_LABEL[suspect.name]) : suspect.name}</strong>
        <span className="mortex-badge">{t(KIND_LABEL[suspect.kind])}</span>
        <span className="mortex-suspect-score">{suspect.score}</span>
      </div>

      {status === "external" && <p className="mortex-suspect-where">{t("Outside mORTEX")}</p>}
      {status === "object" && (
        <p className="mortex-suspect-where">{t("Game object, not tied to a file")}</p>
      )}
      {modIds.length > 1 && (
        <p className="mortex-suspect-where">
          {t("{{count}} mods provide this file", { count: modIds.length })}
        </p>
      )}

      {modIds.map((modId) => {
        const mod = mods[modId];
        return (
          <div key={modId} className="mortex-suspect-mod">
            <span>{mod?.attributes?.modName || modId}</span>
            <span className="mortex-suspect-actions">
              {mod !== undefined && hasNexusPage(mod) && (
                <Button appearance="weak" size="sm" onClick={() => openNexus(mod)}>
                  {t("Open on Nexus Mods")}
                </Button>
              )}
              {mod?.installationPath !== undefined && (
                <Button
                  appearance="weak"
                  brand="neutral"
                  size="sm"
                  onClick={() => showInFinder(mod)}
                >
                  {t("Show in Finder")}
                </Button>
              )}
            </span>
          </div>
        );
      })}

      {suspect.reasons.length > 0 && (
        <ul className="mortex-suspect-reasons">
          {suspect.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}
      {children}
    </li>
  );
};
