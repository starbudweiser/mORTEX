import { describe, expect, it } from "vitest";

import { buildActivity } from "./activity";

const t = (text: string, options?: { replace?: Record<string, unknown> }) =>
  text.replace(/\{\{(\w+)\}\}/g, (_all, key) =>
    String((options?.replace?.[key] as string | number | undefined) ?? ""),
  );

describe("menu bar activity", () => {
  it("shows downloads and tasks, with a badge and the progress", () => {
    const activity = buildActivity(
      {
        downloads: {
          a: { state: "started", size: 100, received: 50 } as never,
          b: { state: "started", size: 300, received: 50 } as never,
          c: { state: "finished", size: 10, received: 10 } as never,
        },
        notifications: [
          {
            id: "install",
            type: "activity",
            message: "Installing {{name}}",
            replace: { name: "SkyUI" },
            progress: 40,
          } as never,
          { id: "info", type: "info", message: "Hello" } as never,
        ],
        gameName: "Skyrim Special Edition",
        canLaunch: true,
      },
      t,
    );
    expect(activity).toEqual({
      badge: "3",
      progress: 0.25,
      title: "↓ 25 %",
      lines: ["Downloads: 2 in progress (25 %)", "Installing SkyUI (40 %)"],
      launchLabel: "Launch Skyrim Special Edition",
      showLabel: "Show mORTEX",
      quitLabel: "Quit mORTEX",
    });
  });

  it("is quiet when nothing runs, and can't launch a running game", () => {
    const activity = buildActivity(
      { downloads: {}, notifications: [], gameName: "Skyrim", canLaunch: false },
      t,
    );
    expect(activity).toMatchObject({ badge: "", progress: -1, title: "", lines: ["No activity"] });
    expect(activity.launchLabel).toBeUndefined();
  });
});
