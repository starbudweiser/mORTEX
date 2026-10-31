import { afterEach, describe, expect, it, vi } from "vitest";

const handlers = vi.hoisted(() => new Map<string, () => unknown>());

vi.mock("electron", () => ({ BrowserWindow: { getAllWindows: () => [] } }));
vi.mock("../ipc", () => ({
  betterIpcMain: {
    handle: (channel: string, fn: () => unknown) => handlers.set(channel, fn),
    on: vi.fn(),
    send: vi.fn(),
  },
}));
vi.mock("../logging", () => ({ log: vi.fn() }));

import type { UnleashClient } from "./client";
import { synchronizeFeatureFlags } from "./ipc";

describe("synchronizeFeatureFlags on macOS", () => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
  afterEach(() => Object.defineProperty(process, "platform", platform));

  it("never starts the client and serves an empty flag list", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const start = vi.fn();
    const client = {
      flags: [{ name: "x" }],
      start,
      postMetrics: vi.fn(),
      setContext: vi.fn(),
    } as unknown as UnleashClient;
    synchronizeFeatureFlags(client);
    expect(start).not.toHaveBeenCalled();
    expect(handlers.get("flags:get-current")!()).toEqual([]);
  });
});
