/**
 * mORTEX (macOS) : page « Machine à remonter le temps ». Frise des instantanés par jour, avec ce
 * qui a changé depuis chacun, et leur restauration.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { log } from "@/util/log";
import { deleteSnapshot, type ISnapshot, listSnapshots } from "@/util/macos/timeMachine";
import MainPage from "@/views/MainPage";

import { activeProfile } from "../profile_management/selectors";
import {
  CHANGED_EVENT,
  isAvailable,
  restoreSnapshot,
  takeSnapshot,
  timeMachineContext,
} from "./timeMachineApi";

interface IProps {
  api: IExtensionApi;
}

const REASONS: Record<ISnapshot["reason"], string> = {
  deploy: "Before deployment",
  manual: "Taken by hand",
  restore: "Before a restore",
};

const DAY_MS = 24 * 3600 * 1000;

/** mods activés, désactivés, ajoutés ou retirés depuis l'instantané */
function changesSince(snapshot: ISnapshot, modState: Record<string, { enabled?: boolean }>) {
  const ids = new Set([...Object.keys(snapshot.modState), ...Object.keys(modState)]);
  return [...ids].filter(
    (id) => (snapshot.modState[id]?.enabled === true) !== (modState[id]?.enabled === true),
  ).length;
}

export default function TimeMachinePage({ api }: IProps) {
  const t = useCallback(
    (text: string, options?: Record<string, unknown>) =>
      api.translate(text, { ns: "common", ...options }),
    [api],
  );
  const language = useSelector((state: IState) => state.settings.interface.language);
  const profile = useSelector((state: IState) => activeProfile(state));
  const [snapshots, setSnapshots] = useState<ISnapshot[]>([]);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState<string | undefined>(undefined);

  const refresh = useCallback(() => {
    const context = timeMachineContext(api);
    if (context === undefined) return;
    isAvailable(context)
      .then(setAvailable)
      .catch(() => setAvailable(false));
    listSnapshots(context.root)
      .then(setSnapshots)
      .catch((err) => log("warn", "failed to list snapshots", { error: (err as Error).message }));
  }, [api]);

  useEffect(() => {
    refresh();
    api.events.on(CHANGED_EVENT, refresh);
    return () => {
      api.events.removeListener(CHANGED_EVENT, refresh);
    };
  }, [api, refresh]);

  const run = (id: string, work: () => Promise<unknown>, failure: string) => {
    setBusy(id);
    work()
      .catch((err) => api.showErrorNotification?.(failure, err, { allowReport: false }))
      .finally(() => {
        setBusy(undefined);
        refresh();
      });
  };

  const take = () => run("take", () => takeSnapshot(api, "manual"), "Failed to take a snapshot");

  const restore = (snapshot: ISnapshot) => {
    api
      .showDialog?.(
        "question",
        "Go back to this snapshot?",
        {
          text: t(
            "Data, your mods, the load order and the INI files go back to {{date}}. mORTEX takes a snapshot of the current state first, so you can come back to it.",
            { replace: { date: new Date(snapshot.created).toLocaleString(language) } },
          ),
        },
        [{ label: "Cancel" }, { label: "Go back" }],
      )
      .then((result) => {
        if (result.action !== "Go back") return;
        run(
          snapshot.id,
          () =>
            restoreSnapshot(api, snapshot).then(() =>
              api.sendNotification?.({
                type: "success",
                message: "Back to the snapshot",
                displayMS: 5000,
              }),
            ),
          "Failed to restore the snapshot",
        );
      });
  };

  const remove = (snapshot: ISnapshot) => {
    const context = timeMachineContext(api);
    if (context === undefined) return;
    run(snapshot.id, () => deleteSnapshot(context.root, snapshot.id), "Failed to delete");
  };

  const dayLabel = (time: number) => {
    const today = new Date().toDateString();
    const day = new Date(time).toDateString();
    if (day === today) return t("Today");
    if (day === new Date(Date.now() - DAY_MS).toDateString()) return t("Yesterday");
    return new Date(time).toLocaleDateString(language, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const days: Array<[string, ISnapshot[]]> = [];
  for (const snapshot of snapshots) {
    const label = dayLabel(snapshot.created);
    if (days.at(-1)?.[0] !== label) days.push([label, []]);
    days.at(-1)[1].push(snapshot);
  }

  return (
    <MainPage id="time-machine-page">
      <MainPage.Body className="h-full overflow-y-auto">
        <div className="flex flex-col gap-y-5 p-6">
          <div className="flex items-center gap-x-3">
            <Icon className="text-warning-strong" name="history" size="lg" />
            <Typography className="font-semibold" typographyType="heading-sm">
              {t("Time Machine")}
            </Typography>
            <Typography
              brand="warning"
              className="rounded-sm bg-warning-weak px-2"
              typographyType="body-xs"
            >
              {t("Mac exclusive")}
            </Typography>
            <Button
              className="ml-auto"
              disabled={!available || busy !== undefined}
              isLoading={busy === "take"}
              leftIcon="add_a_photo"
              size="sm"
              onClick={take}
            >
              {t("Take a snapshot")}
            </Button>
          </div>

          <Typography appearance="moderate" typographyType="body-md">
            {t(
              "Before each deployment, mORTEX takes a snapshot of Data, your mods, the load order and the INI files. APFS clones share their content with the originals, so a snapshot takes almost no space. All snapshots from the last 24 hours are kept, then one per day for two weeks.",
            )}
          </Typography>

          {!available && (
            <Typography brand="warning" typographyType="body-sm">
              {t("Snapshots need the game, its mods folder and the bottle on the same APFS disk.")}
            </Typography>
          )}

          {available && snapshots.length === 0 && (
            <Typography appearance="subdued" typographyType="body-md">
              {t("No snapshot yet: the first one is taken at the next deployment.")}
            </Typography>
          )}

          {days.map(([label, entries]) => (
            <div className="flex flex-col gap-y-2" key={label}>
              <Typography className="font-semibold capitalize" typographyType="body-lg">
                {label}
              </Typography>
              <div className="ml-2 flex flex-col border-l border-stroke-moderate">
                {entries.map((snapshot) => {
                  const changes = changesSince(snapshot, profile?.modState ?? {});
                  const otherProfile = profile?.id !== snapshot.profileId;
                  return (
                    <div
                      className="relative mb-2 ml-4 flex items-center gap-x-4 rounded-md bg-surface-mid px-4 py-3"
                      data-testid={`time-machine-${snapshot.id}`}
                      key={snapshot.id}
                    >
                      <span className="absolute top-1/2 -left-[1.3rem] size-2.5 -translate-y-1/2 rounded-full bg-warning-strong" />
                      <Typography
                        className="w-14 font-semibold tabular-nums"
                        typographyType="body-lg"
                      >
                        {new Date(snapshot.created).toLocaleTimeString(language, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Typography>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Typography typographyType="body-md">
                          {t(REASONS[snapshot.reason])}
                          <span className="text-neutral-subdued">
                            {" · "}
                            {t("Profile {{name}}", { replace: { name: snapshot.profileName } })}
                          </span>
                        </Typography>
                        <Typography appearance="moderate" typographyType="body-xs">
                          {t("Mods enabled: {{enabled}} of {{count}}", {
                            replace: { enabled: snapshot.enabledCount, count: snapshot.modCount },
                          })}
                          {" · "}
                          {changes === 0
                            ? t("Same mods as now")
                            : t("{{count}} mods changed since", { count: changes })}
                        </Typography>
                      </div>
                      <Button
                        appearance="moderate"
                        brand="neutral"
                        disabled={busy !== undefined}
                        leftIcon="delete"
                        size="sm"
                        title={t("Delete")}
                        onClick={() => remove(snapshot)}
                      />
                      <Button
                        disabled={busy !== undefined || otherProfile}
                        isLoading={busy === snapshot.id}
                        leftIcon="history"
                        size="sm"
                        title={
                          otherProfile ? t("Switch to the snapshot's profile first") : undefined
                        }
                        onClick={() => restore(snapshot)}
                      >
                        {t("Go back")}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </MainPage.Body>
    </MainPage>
  );
}
