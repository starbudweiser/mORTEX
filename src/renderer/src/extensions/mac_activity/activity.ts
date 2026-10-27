/**
 * mORTEX (macOS) : ce que montrent la barre des menus et le Dock, calculé depuis l'état.
 * Fonction pure : la traduction est injectée.
 */
import type { MacActivity } from "@vortex/shared/ipc";

import type { INotification } from "../../types/INotification";
import type { IDownload } from "../download_management/types/IDownload";

export interface IActivityInput {
  downloads: Record<string, IDownload>;
  notifications: INotification[];
  gameName?: string;
  canLaunch: boolean;
}

type Translate = (text: string, options?: { replace?: Record<string, unknown> }) => string;

const percent = (value: number) => Math.round(value * 100);

export function buildActivity(input: IActivityInput, t: Translate): MacActivity {
  const started = Object.values(input.downloads).filter((dl) => dl?.state === "started");
  const size = started.reduce((sum, dl) => sum + (dl.size ?? 0), 0);
  const received = started.reduce((sum, dl) => sum + (dl.received ?? 0), 0);
  const downloadProgress = size > 0 ? Math.min(1, received / size) : undefined;

  // installations, déploiement et autres tâches longues : notifications « activity »
  const tasks = input.notifications.filter((noti) => noti.type === "activity");
  const taskProgress = tasks.find((noti) => typeof noti.progress === "number")?.progress;

  const lines: string[] = [];
  if (started.length > 0) {
    lines.push(
      downloadProgress !== undefined
        ? t("Downloads: {{count}} in progress ({{percent}} %)", {
            replace: { count: started.length, percent: percent(downloadProgress) },
          })
        : t("Downloads: {{count}} in progress", { replace: { count: started.length } }),
    );
  }
  for (const task of tasks) {
    const text = t(task.message ?? task.title ?? "", { replace: task.replace });
    lines.push(
      typeof task.progress === "number" ? `${text} (${Math.round(task.progress)} %)` : text,
    );
  }
  if (lines.length === 0) lines.push(t("No activity"));

  const progress =
    downloadProgress ?? (taskProgress !== undefined ? Math.min(1, taskProgress / 100) : -1);
  const count = started.length + tasks.length;
  return {
    badge: count > 0 ? String(count) : "",
    progress,
    title:
      downloadProgress !== undefined
        ? `↓ ${percent(downloadProgress)} %`
        : progress >= 0
          ? `${percent(progress)} %`
          : "",
    lines,
    launchLabel:
      input.canLaunch && input.gameName !== undefined
        ? t("Launch {{game}}", { replace: { game: input.gameName } })
        : undefined,
    showLabel: t("Show mORTEX"),
    quitLabel: t("Quit mORTEX"),
  };
}
