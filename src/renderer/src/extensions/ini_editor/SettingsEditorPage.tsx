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
import AdvancedView from "./AdvancedView";
import { type IBackup, listBackups, restoreBackup, restoreBackupSafely } from "./backup";
import BackupsView from "./BackupsView";
import {
  BETHESDA_PRESET_IDS,
  type BethesdaPresetId,
  type IBethesdaValues,
  readBethesdaValues,
} from "./bethesdaPresets";
import { EXE_SETTINGS } from "./catalog/exeSettings";
import { TAB_GROUPS } from "./catalog/groups";
import { SKYRIMSE_CATALOG, settingsOfTab } from "./catalog/skyrimse";
import type { TabId } from "./catalog/types";
import {
  type IValueContext,
  type Pending,
  isEnabled,
  pendingChanges,
  pendingFromPreset,
  withEntryValue,
  withValue,
} from "./model";
import { SettingsSaveError, commitSave, formatSummary, previewSave, summarizePlan } from "./save";
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
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"main" | "advanced" | "backups">("main");
  const [backups, setBackups] = useState<IBackup[]>([]);
  // le jeu ou un outil tourne : le jeu réécrit ses INI en quittant, on n'écrit pas par-dessus
  const toolRunning = useSelector(
    (state: IState) => Object.keys(state.session.base.toolsRunning ?? {}).length > 0,
  );

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

  const iniDir = files?.[0] !== undefined ? files[0].path.replace(/[\\/][^\\/]*$/, "") : undefined;
  const loadBackups = useCallback(() => {
    if (iniDir === undefined) return;
    listBackups(iniDir)
      .then(setBackups)
      .catch(() => setBackups([]));
  }, [iniDir]);
  useEffect(loadBackups, [loadBackups, view]);

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

  const save = async () => {
    if (files === undefined || changeCount === 0) return;
    if (toolRunning) {
      api.sendNotification?.({
        id: "settings-editor-game-running",
        type: "warning",
        message: tt("ui.gameRunning"),
        displayMS: 8000,
      });
      return;
    }
    setSaving(true);
    try {
      const plan = previewSave(files, pendingChanges(SKYRIMSE_CATALOG, pending));
      if (plan.changes.length === 0) {
        revert();
        return;
      }
      const answer = await api.showDialog?.(
        "question",
        tt("ui.confirmTitle"),
        {
          text: tt("ui.confirmIntro"),
          message: formatSummary(summarizePlan(plan), {
            unset: tt("ui.confirmUnset"),
            newSection: tt("ui.confirmNewSection"),
          }),
          options: { translated: true, wrap: false },
        },
        [{ label: tt("ui.back") }, { label: tt("ui.save"), default: true }],
      );
      if (answer?.action !== tt("ui.save")) return;

      const { backup } = await commitSave(plan);
      revert();
      load();
      loadBackups();
      api.sendNotification?.({
        id: "settings-editor-saved",
        type: "success",
        message: tt("ui.saved", { count: plan.changes.length, backup: backup.name }),
        // annulable : la notification reste jusqu'à ce qu'on la ferme
        actions: [
          {
            title: tt("ui.undo"),
            action: (dismiss) => {
              restoreBackup(backup.dir)
                .then(() => {
                  load();
                  loadBackups();
                  api.sendNotification?.({
                    id: "settings-editor-undone",
                    type: "info",
                    message: tt("ui.undone"),
                    displayMS: 5000,
                  });
                })
                .catch((err) => api.showErrorNotification?.(tt("ui.undoFailed"), err))
                .finally(dismiss);
            },
          },
        ],
      });
    } catch (err) {
      if (err instanceof SettingsSaveError) {
        api.sendNotification?.({
          id: "settings-editor-read-only",
          type: "error",
          message: tt("ui.readOnly", { file: err.file.split(/[\\/]/).pop() }),
        });
      } else {
        api.showErrorNotification?.(tt("ui.saveFailed"), err);
      }
    } finally {
      setSaving(false);
    }
  };

  const restore = async (backup: IBackup) => {
    if (toolRunning) {
      api.sendNotification?.({
        id: "settings-editor-game-running",
        type: "warning",
        message: tt("ui.gameRunning"),
        displayMS: 8000,
      });
      return;
    }
    const answer = await api.showDialog?.(
      "question",
      tt("ui.bkRestoreTitle"),
      {
        text: tt("ui.bkRestoreBody", { name: backup.name, files: backup.files.join(", ") }),
        options: { translated: true },
      },
      [{ label: tt("ui.back") }, { label: tt("ui.bkRestore"), default: true }],
    );
    if (answer?.action !== tt("ui.bkRestore")) return;
    try {
      const safety = await restoreBackupSafely(backup.dir);
      revert();
      load();
      loadBackups();
      api.sendNotification?.({
        id: "settings-editor-restored",
        type: "success",
        message: tt("ui.bkRestored", { name: backup.name }),
        actions: [
          {
            title: tt("ui.undo"),
            action: (dismiss) => {
              restoreBackup(safety.dir)
                .then(() => {
                  load();
                  loadBackups();
                  api.sendNotification?.({
                    id: "settings-editor-undone",
                    type: "info",
                    message: tt("ui.undone"),
                    displayMS: 5000,
                  });
                })
                .catch((err) => api.showErrorNotification?.(tt("ui.undoFailed"), err))
                .finally(dismiss);
            },
          },
        ],
      });
    } catch (err) {
      api.showErrorNotification?.(tt("ui.saveFailed"), err);
    }
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
            <Button
              disabled={changeCount === 0}
              isLoading={saving}
              leftIcon="save"
              size="sm"
              onClick={() => void save()}
            >
              {tt("ui.save")}
            </Button>
          </div>

          <Typography appearance="moderate" typographyType="body-md">
            {tt("ui.intro")}
          </Typography>

          <div className="flex gap-x-2">
            {(["main", "advanced", "backups"] as const).map((id) => (
              <Button
                appearance={view === id ? undefined : "moderate"}
                brand={view === id ? undefined : "neutral"}
                key={id}
                size="sm"
                onClick={() => setView(id)}
              >
                {tt(`ui.view.${id}`)}
              </Button>
            ))}
          </div>

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
                {view === "main" && (
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
                                      onChange={(value) =>
                                        setPending(withValue(ctx, setting, value))
                                      }
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
                )}
                {view === "advanced" && (
                  <AdvancedView
                    catalog={SKYRIMSE_CATALOG}
                    ctx={ctx}
                    exe={EXE_SETTINGS}
                    tt={tt}
                    onChange={(section, key, value) =>
                      setPending(withEntryValue(ctx, SKYRIMSE_CATALOG, section, key, value))
                    }
                  />
                )}
                {view === "backups" && (
                  <BackupsView
                    backups={backups}
                    tt={tt}
                    onReveal={(backup) => window.api.shell.showItemInFolder(backup.dir)}
                    onRestore={(backup) => void restore(backup)}
                  />
                )}
              </>
            )
          )}
        </div>
      </MainPage.Body>
    </MainPage>
  );
}
