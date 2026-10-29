/**
 * mORTEX (macOS) : l'Éditeur de réglages de Skyrim SE / AE. Lit les INI de la bouteille (SkyrimCustom >
 * SkyrimPrefs > Skyrim), montre la valeur effective de chaque réglage du catalogue et garde les
 * modifications en attente. Rien n'est écrit ici : l'enregistrement vient avec l'étape suivante.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import { discoveryByGame } from "@/extensions/gamemode_management/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { log } from "@/util/log";
import { activeGameId } from "@/util/selectors";
import MainPage from "@/views/MainPage";

import {
  type IIniFile,
  INI_FILE_NAMES,
  INI_PRIORITY,
  type IniRole,
  loadIniFiles,
  readEffective,
  settingId,
} from "../../util/macos/iniEdit";
import { iniFiles } from "../ini_prep/gameSupport";
import {
  BETHESDA_PRESET_IDS,
  type BethesdaPresetId,
  type IBethesdaValues,
  readBethesdaValues,
} from "./bethesdaPresets";
import { TAB_GROUPS } from "./catalog/groups";
import { SKYRIMSE_CATALOG, settingsOfTab } from "./catalog/skyrimse";
import type { TabId } from "./catalog/types";
import { type IValueContext, type Pending, isEnabled, pendingFromPreset, withValue } from "./model";
import SettingRow from "./SettingRow";

interface IProps {
  api: IExtensionApi;
}

const TABS: readonly TabId[] = [
  "display",
  "shadows",
  "distance",
  "grassLod",
  "waterFx",
  "interface",
  "game",
  "camera",
  "audio",
];

/** chemin de chaque INI du jeu, d'après la liste de ini_prep */
function iniPaths(gameId: string, discovery: Parameters<typeof iniFiles>[1]) {
  const paths: Partial<Record<IniRole, string>> = {};
  for (const file of iniFiles(gameId, discovery)) {
    const name = file.split(/[\\/]/).pop()?.toLowerCase();
    const role = INI_PRIORITY.find((r) => INI_FILE_NAMES[r].toLowerCase() === name);
    if (role !== undefined) paths[role] = file;
  }
  return paths;
}

export default function SettingsEditorPage({ api }: IProps) {
  const tt = useCallback(
    (key: string, replace?: Record<string, unknown>) =>
      api.translate(key, { ns: "settings_editor", replace }),
    [api],
  );
  const gameId = useSelector((state: IState) => activeGameId(state));
  const discovery = useSelector((state: IState) => discoveryByGame(state, activeGameId(state)));

  const [files, setFiles] = useState<IIniFile[] | undefined>(undefined);
  const [bethesda, setBethesda] = useState<IBethesdaValues | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<Pending>({});
  // change à chaque remise à zéro ou préréglage : les champs de saisie repartent de la valeur
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<TabId>("display");

  const gamePath = discovery?.path;
  const load = useCallback(() => {
    if (gamePath === undefined) return;
    setFailed(false);
    Promise.all([
      loadIniFiles(iniPaths(gameId, discovery)),
      readBethesdaValues(gamePath).catch(() => undefined),
    ])
      .then(([loaded, values]) => {
        setFiles(loaded);
        setBethesda(values);
      })
      .catch((err) => {
        log("warn", "settings editor: cannot read INI files", { error: (err as Error).message });
        setFailed(true);
      });
  }, [gameId, gamePath]);

  useEffect(load, [load]);

  const ctx = useMemo<IValueContext>(() => {
    const defaults = new Map<string, string>();
    // Skyrim_Default.ini passe avant le modèle du lanceur
    for (const list of [bethesda?.launcherPrefs, bethesda?.defaults]) {
      for (const c of list ?? []) defaults.set(settingId(c.section, c.key), c.value);
    }
    return { effective: readEffective(files ?? []), defaults, pending };
  }, [files, bethesda, pending]);

  const changeCount = Object.keys(pending).length;
  const countOfTab = (id: TabId) =>
    settingsOfTab(id).filter((s) => pending[s.id] !== undefined).length;

  const applyPreset = (id: BethesdaPresetId) => {
    if (bethesda === undefined) return;
    setPending(pendingFromPreset(SKYRIMSE_CATALOG, bethesda.presets[id], ctx));
    setRevision((r) => r + 1);
  };
  const revert = () => {
    setPending({});
    setRevision((r) => r + 1);
  };

  const presets = BETHESDA_PRESET_IDS.filter((id) => (bethesda?.presets[id].length ?? 0) > 0);

  return (
    <MainPage id="settings-editor-page">
      <MainPage.Body className="h-full overflow-y-auto">
        <div className="flex flex-col gap-y-4 p-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Icon className="text-warning-strong" name="tune" size="lg" />
            <Typography className="font-semibold" typographyType="heading-sm">
              {tt("ui.title")}
            </Typography>
            <Typography
              brand="warning"
              className="rounded-sm bg-warning-weak px-2"
              typographyType="body-xs"
            >
              {tt("ui.macExclusive")}
            </Typography>
            <Typography appearance="moderate" className="ml-auto" typographyType="body-sm">
              {tt("ui.pending", { count: changeCount })}
            </Typography>
            <Button
              appearance="moderate"
              brand="neutral"
              leftIcon="refresh"
              title={tt("ui.refresh")}
              onClick={load}
            />
            <Button disabled={changeCount === 0} leftIcon="undo" size="sm" onClick={revert}>
              {tt("ui.revert")}
            </Button>
            <Tooltip content={tt("ui.saveSoon")}>
              <span>
                <Button disabled={true} leftIcon="save" size="sm">
                  {tt("ui.save")}
                </Button>
              </span>
            </Tooltip>
          </div>

          <Typography appearance="moderate" typographyType="body-md">
            {tt("ui.intro")}
          </Typography>

          {gamePath === undefined ? (
            <Typography brand="warning" typographyType="body-md">
              {tt("ui.noGame")}
            </Typography>
          ) : failed ? (
            <Typography brand="danger" typographyType="body-md">
              {tt("ui.loadError")}
            </Typography>
          ) : (
            files !== undefined && (
              <>
                {presets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Tooltip content={tt("ui.presetHint")}>
                      <Typography className="font-semibold" typographyType="body-md">
                        {tt("ui.presets")}
                      </Typography>
                    </Tooltip>
                    {presets.map((id) => (
                      <Button key={id} size="sm" onClick={() => applyPreset(id)}>
                        {tt(`ui.preset.${id}`)}
                      </Button>
                    ))}
                  </div>
                )}

                <TabProvider
                  tab={tab}
                  tabListId="settings-editor-tabs"
                  onSetSelectedTab={(id) => setTab(id as TabId)}
                >
                  <TabBar>
                    {TABS.map((id) => (
                      <TabButton
                        count={countOfTab(id) || undefined}
                        key={id}
                        name={tt(`tab.${id}`)}
                        panelId={id}
                      />
                    ))}
                  </TabBar>
                  {TABS.map((id) => (
                    <TabPanel id={id} key={id}>
                      <div className="mt-4 columns-[26rem] gap-4">
                        {TAB_GROUPS[id].map((group) => (
                          <section
                            className="mb-4 break-inside-avoid rounded-md bg-surface-mid p-3"
                            data-testid={`settings-group-${group.id}`}
                            key={group.id}
                          >
                            <Typography
                              className="mb-1 px-2 font-semibold !text-[#f59e0b]"
                              typographyType="body-md"
                            >
                              {tt(`group.${group.id}`)}
                            </Typography>
                            {group.ids.map((settingId) => {
                              const setting = SKYRIMSE_CATALOG.find((s) => s.id === settingId);
                              if (setting === undefined) return null;
                              const dep = SKYRIMSE_CATALOG.find(
                                (s) => s.id === setting.dependsOn?.on,
                              );
                              return (
                                <SettingRow
                                  ctx={ctx}
                                  dependsOnLabel={
                                    dep !== undefined ? tt(`label.${dep.id}`) : undefined
                                  }
                                  enabled={isEnabled(ctx, setting, SKYRIMSE_CATALOG)}
                                  key={`${setting.id}-${revision}`}
                                  setting={setting}
                                  tt={tt}
                                  onChange={(value) => setPending(withValue(ctx, setting, value))}
                                  onReset={() => {
                                    const { [setting.id]: _unused, ...rest } = pending;
                                    setPending(rest);
                                    setRevision((r) => r + 1);
                                  }}
                                />
                              );
                            })}
                          </section>
                        ))}
                      </div>
                    </TabPanel>
                  ))}
                </TabProvider>
              </>
            )
          )}
        </div>
      </MainPage.Body>
    </MainPage>
  );
}
