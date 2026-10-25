import { render, screen } from "@testing-library/react";
import type { CrashEvent } from "@vortex/shared/ipc";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { IMod } from "../mod_management/types/IMod";
import type { ICrashSnapshot } from "./crashStore";
import { buildFileIndex, linkEvent } from "./linking";

const snapshot = vi.hoisted(() => ({ current: undefined as unknown as ICrashSnapshot }));
vi.mock("./crashStore", () => ({ useCrashes: () => snapshot.current }));

import { ModCrashes } from "./ModCrashes";

const mod = { id: "engine-fixes-1" } as IMod;
const files = buildFileIndex([
  { relPath: "SKSE/Plugins/EngineFixes.dll", source: "engine-fixes-1" },
]);
const event = (time: string, names: string[]): CrashEvent => ({
  schema: 1,
  crash_time: time,
  log_name: `${time}.log`,
  game_runtime: null,
  skse_runtime: null,
  verdict: null,
  plugins_hash: null,
  bottle: null,
  suspects: names.map((name, i) => ({
    name,
    kind: "dll",
    score: 0.9 - i / 10,
    reasons: [`raison ${name}`],
  })),
});
const set = (events: CrashEvent[]) => {
  snapshot.current = {
    available: true,
    skipped: 0,
    files,
    events: events.map((e) => linkEvent(e, files, [])),
  };
};

describe("ModCrashes", () => {
  it("n'affiche rien sans plantage analysé", () => {
    set([]);
    const { container } = render(<ModCrashes mod={mod} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("montre le rang, les raisons de sKYCRASH et la récurrence, et le bouton des conflits", () => {
    set([event("2026-10-02", ["EngineFixes.dll", "x.dll"]), event("2026-10-01", ["x.dll"])]);
    const onOpenConflicts = vi.fn();
    render(<ModCrashes mod={mod} onOpenConflicts={onOpenConflicts} />);
    expect(screen.getByText(/raison EngineFixes\.dll/)).toBeTruthy();
    expect(screen.getByText(/of the last/)).toBeTruthy();
    screen.getByRole("button").click();
    expect(onOpenConflicts).toHaveBeenCalledOnce();
  });

  it("dit que le mod n'est pas suspect quand il n'apparaît pas", () => {
    set([event("2026-10-01", ["x.dll"])]);
    render(<ModCrashes mod={mod} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Not a suspect/)).toBeTruthy();
  });
});
