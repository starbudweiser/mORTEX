/**
 * mORTEX (macOS) : la vue « Raccourcis » de l'Éditeur de réglages. Les actions de Skyrim dont la touche
 * clavier peut changer, par groupes ; on clique sur une touche puis on appuie sur la nouvelle. Une touche
 * déjà prise est signalée et bloque l'enregistrement ; « Trouver par touche » dit quelle action utilise
 * une touche. L'enregistrement écrit le fichier ControlMap_Custom.txt du dossier du jeu après une copie de sécurité.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { log } from "@/util/log";

import { type IBackup, restoreBackup } from "./backup";
import { eventSlug, keysText, remappableGroups } from "./controlGroups";
import {
  type IControlEvent,
  type IControlMap,
  changedEvents,
  eventId,
  eventsUsingKey,
  findConflicts,
  findEvent,
  keyCombos,
  parseKeySlot,
  withKeyboard,
} from "./controlMap";
import {
  type ILoadedControls,
  commitControlsSave,
  loadControls,
  planControlsSave,
} from "./controls";
import { dikFromEventCode, macKeyName } from "./dikKeys";
import { SettingsSaveError } from "./save";
import type { SettingsTranslate } from "./SettingRow";

interface IProps {
  api: IExtensionApi;
  tt: SettingsTranslate;
  gamePath: string;
  iniDir: string;
  /** le jeu ou un outil tourne : on n'écrit pas pendant ce temps */
  toolRunning: boolean;
  /** appelé après un enregistrement ou une annulation, pour rafraîchir la liste des sauvegardes */
  onSaved: () => void;
}

export default function ControlsView({ api, tt, gamePath, iniDir, toolRunning, onSaved }: IProps) {
  const [loaded, setLoaded] = useState<ILoadedControls | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [edited, setEdited] = useState<IControlMap | undefined>(undefined);
  const [capture, setCapture] = useState<{ context: number; name: string } | undefined>(undefined);
  const [findMode, setFindMode] = useState(false);
  const [findKey, setFindKey] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    loadControls(gamePath, iniDir)
      .then((result) => {
        setLoaded(result);
        setEdited(result.current);
        setError(undefined);
      })
      .catch((err) => {
        log("warn", "settings editor: cannot read the control table", {
          error: (err as Error).message,
        });
        setError((err as Error).message);
      });
  }, [gamePath, iniDir]);
  useEffect(reload, [reload]);

  // on écoute le clavier tant qu'une touche attend d'être choisie ou cherchée
  useEffect(() => {
    if (capture === undefined && !findMode) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (event.code === "Escape") {
        setCapture(undefined);
        setFindMode(false);
        return;
      }
      const code = dikFromEventCode(event.code);
      if (code === undefined) return;
      if (findMode) {
        setFindKey(code);
        setFindMode(false);
      } else if (capture !== undefined) {
        setEdited((map) =>
          map === undefined ? map : withKeyboard(map, capture.context, capture.name, [[code]]),
        );
        setCapture(undefined);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capture, findMode]);

  const label = (event: IControlEvent) => tt(`ui.ctl.${eventSlug(event.name)}`);
  const none = tt("ui.ctlNoKey");
  const fieldText = (field: string) => {
    const slot = parseKeySlot(field);
    return slot.kind === "keys" ? keysText(slot.combos, none) : none;
  };

  const pending = useMemo(
    () =>
      loaded !== undefined && edited !== undefined ? changedEvents(loaded.current, edited) : [],
    [loaded, edited],
  );
  const pendingIds = new Set(pending.map((c) => eventId(c.context, c.name)));
  const conflicts = useMemo(() => (edited === undefined ? [] : findConflicts(edited)), [edited]);
  const conflictOthers = (event: IControlEvent): string[] => {
    const others = new Set<string>();
    for (const conflict of conflicts) {
      if (conflict.context === event.context && conflict.events.includes(event.name))
        conflict.events.filter((n) => n !== event.name).forEach((n) => others.add(n));
    }
    return [...others];
  };

  const findUses = useMemo(
    () => (edited !== undefined && findKey !== undefined ? eventsUsingKey(edited, findKey) : []),
    [edited, findKey],
  );
  const findIds = new Set(findUses.map((u) => eventId(u.context, u.name)));

  const warnGameRunning = () =>
    api.sendNotification?.({
      id: "settings-editor-game-running",
      type: "warning",
      message: tt("ui.gameRunning"),
      displayMS: 8000,
    });

  const save = async () => {
    if (loaded === undefined || edited === undefined || pending.length === 0) return;
    if (toolRunning) {
      warnGameRunning();
      return;
    }
    setSaving(true);
    try {
      const plan = planControlsSave(loaded, edited);
      const lines = pending.map((change) => {
        const event = findEvent(edited, change.context, change.name);
        const name = event !== undefined ? label(event) : change.name;
        return `${name} : ${fieldText(change.before)} → ${fieldText(change.after)}`;
      });
      const answer = await api.showDialog?.(
        "question",
        tt("ui.confirmTitle"),
        {
          text: tt("ui.ctlConfirmIntro"),
          message: `${plan.path.split(/[\\/]/).pop()}\n  ${lines.join("\n  ")}`,
          options: { translated: true, wrap: false },
        },
        [{ label: tt("ui.back") }, { label: tt("ui.save"), default: true }],
      );
      if (answer?.action !== tt("ui.save")) return;

      const backup: IBackup = await commitControlsSave(plan);
      reload();
      onSaved();
      api.sendNotification?.({
        id: "settings-editor-saved",
        type: "success",
        message: tt("ui.ctlSaved", { count: pending.length, backup: backup.name }),
        actions: [
          {
            title: tt("ui.undo"),
            action: (dismiss) => {
              restoreBackup(backup.dir)
                .then(() => {
                  reload();
                  onSaved();
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

  if (error !== undefined)
    return (
      <Typography brand="danger" typographyType="body-md">
        {tt("ui.ctlLoadError", { error })}
      </Typography>
    );
  if (loaded === undefined || edited === undefined) return null;

  const groups = remappableGroups(edited);
  const blocked = conflicts.length > 0;

  return (
    <div className="flex flex-col gap-y-3" data-testid="settings-controls">
      <Typography appearance="moderate" typographyType="body-md">
        {tt("ui.ctlIntro")}
      </Typography>
      <Typography appearance="subdued" typographyType="body-xs">
        {tt("ui.ctlSource", { source: loaded.source })}{" "}
        {tt(loaded.customExists ? "ui.ctlCustomExists" : "ui.ctlCustomNew")}
      </Typography>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <Button
          appearance={findMode ? undefined : "moderate"}
          brand={findMode ? undefined : "neutral"}
          leftIcon="search"
          size="sm"
          onClick={() => {
            setCapture(undefined);
            setFindKey(undefined);
            setFindMode((on) => !on);
          }}
        >
          {findMode ? tt("ui.ctlFindPress") : tt("ui.ctlFind")}
        </Button>
        {findKey !== undefined && (
          <Typography appearance="moderate" typographyType="body-sm">
            {findUses.length === 0
              ? tt("ui.ctlFindNone", { key: macKeyName(findKey) })
              : tt("ui.ctlFindResult", {
                  key: macKeyName(findKey),
                  actions: findUses
                    .map((u) => {
                      const event = findEvent(edited, u.context, u.name);
                      return event !== undefined ? label(event) : u.name;
                    })
                    .join(", "),
                })}
          </Typography>
        )}
        <Typography appearance="moderate" className="ml-auto" typographyType="body-sm">
          {tt("ui.pending", { count: pending.length })}
        </Typography>
        <Button
          disabled={pending.length === 0}
          leftIcon="undo"
          size="sm"
          onClick={() => {
            setEdited(loaded.current);
            setCapture(undefined);
          }}
        >
          {tt("ui.revert")}
        </Button>
        <Button
          disabled={pending.length === 0 || blocked}
          isLoading={saving}
          leftIcon="save"
          size="sm"
          onClick={() => void save()}
        >
          {tt("ui.save")}
        </Button>
      </div>
      {blocked && (
        <Typography brand="warning" typographyType="body-sm">
          {tt("ui.ctlBlocked")}
        </Typography>
      )}

      <div className="columns-[26rem] gap-4">
        {groups.map((group) => (
          <section
            className="mb-4 break-inside-avoid rounded-md bg-surface-mid p-3"
            data-testid={`controls-group-${group.id}`}
            key={group.id}
          >
            <Typography
              className="mb-1 px-2 font-semibold !text-[#f59e0b]"
              typographyType="body-md"
            >
              {tt(`ui.ctlgroup.${group.id}`)}
            </Typography>
            {group.events.map((event) => {
              const id = eventId(event.context, event.name);
              const others = conflictOthers(event);
              const original = findEvent(loaded.base, event.context, event.name);
              const changedFromGame =
                original !== undefined &&
                keysText(keyCombos(original), none) !== keysText(keyCombos(event), none);
              const capturing =
                capture !== undefined && eventId(capture.context, capture.name) === id;
              const tint = pendingIds.has(id)
                ? "bg-success-weak/40"
                : findIds.has(id)
                  ? "bg-warning-weak/40"
                  : "hover:bg-surface-high";
              return (
                <div
                  className={`flex min-h-9 items-center gap-x-3 rounded-sm px-2 py-1 ${tint}`}
                  data-testid={`controls-row-${eventSlug(event.name)}`}
                  key={id}
                >
                  <div className="min-w-0 flex-1">
                    <Typography className="leading-tight" typographyType="body-sm">
                      {label(event)}
                    </Typography>
                    {others.length > 0 && (
                      <Typography brand="warning" typographyType="body-xs">
                        {tt("ui.ctlConflict", { others: others.join(", ") })}
                      </Typography>
                    )}
                    {changedFromGame && original !== undefined && (
                      <Typography appearance="subdued" typographyType="body-xs">
                        {tt("ui.ctlDefault", { key: keysText(keyCombos(original), none) })}
                      </Typography>
                    )}
                  </div>
                  <div className="flex w-40 shrink-0 items-center justify-start">
                    <Button
                      appearance={capturing ? undefined : "moderate"}
                      brand={capturing ? undefined : "neutral"}
                      className="w-full"
                      size="sm"
                      onClick={() => {
                        setFindMode(false);
                        setCapture(
                          capturing ? undefined : { context: event.context, name: event.name },
                        );
                      }}
                    >
                      {capturing ? tt("ui.ctlPress") : keysText(keyCombos(event), none)}
                    </Button>
                  </div>
                  <div className="w-6 shrink-0">
                    {pendingIds.has(id) && (
                      <Button
                        appearance="moderate"
                        brand="neutral"
                        leftIcon="undo"
                        size="sm"
                        title={tt("ui.resetOne")}
                        onClick={() => {
                          const before = findEvent(loaded.current, event.context, event.name);
                          if (before !== undefined)
                            setEdited(
                              withKeyboard(edited, event.context, event.name, keyCombos(before)),
                            );
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
