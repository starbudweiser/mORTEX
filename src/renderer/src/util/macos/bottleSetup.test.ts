import { describe, expect, it, vi } from "vitest";

import type { ISetupCommand, ISetupContext } from "./bottleSetup";
import { runBottleSetup, setupSteps, stepCommands, stepDownloads } from "./bottleSetup";

vi.mock("./bottles", () => ({
  crossoverBinDir: () => "/cx/bin",
  crossoverBottleDir: () => "/nonexistent-bottles",
}));

const context: ISetupContext = { bin: "/cx/bin", bottleDir: "/bottles", downloads: "/dl" };

describe("setupSteps", () => {
  it("keeps .NET Framework 4.8 optional, and Steam last", () => {
    expect(setupSteps({ netfx48: false })).toEqual(["bottle", "vcredist", "dotnet8", "steam"]);
    expect(setupSteps({ netfx48: true })).toEqual([
      "bottle",
      "vcredist",
      "dotnet8",
      "netfx48",
      "steam",
    ]);
  });
});

describe("stepCommands", () => {
  it("creates a 64-bit Windows 10 bottle in CrossOver's own folder", () => {
    const [create, retina] = stepCommands("bottle", context);
    expect(create.executable).toBe("/cx/bin/cxbottle");
    expect(create.args).toEqual(expect.arrayContaining(["--create", "win10_64"]));
    expect(create.args).toContain("EnvironmentVariables:CX_GRAPHICS_BACKEND=d3dmetal");
    expect(create.env.CX_BOTTLE_PATH).toBe("/bottles");
    expect(retina.args).toContain("RetinaMode");
  });

  it("runs the installers from the Mac, without --cx-app", () => {
    const [steam] = stepCommands("steam", context);
    expect(steam.args).toEqual(["--bottle", "Skyrim-mORTEX", "/dl/SteamSetup.exe", "/S"]);
  });

  it("installs .NET 4.8 as Windows 7 and goes back to Windows 10", () => {
    const args = stepCommands("netfx48", context).map((c: ISetupCommand) =>
      c.args.slice(2).join(" "),
    );
    const win7 = args.indexOf("winecfg /v win7");
    const install = args.findIndex((a: string) => a.includes("ndp48.exe"));
    const win10 = args.indexOf("winecfg /v win10");
    expect(win7).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(win7);
    expect(win10).toBeGreaterThan(install);
    expect(args[0]).toContain("mscoree");
  });

  it("downloads only from Valve and Microsoft", () => {
    const hosts = setupSteps({ netfx48: true }).flatMap((step) =>
      stepDownloads(step).map((file) => new URL(file.url).hostname),
    );
    expect(new Set(hosts)).toEqual(
      new Set(["aka.ms", "go.microsoft.com", "cdn.cloudflare.steamstatic.com"]),
    );
  });
});

describe("runBottleSetup", () => {
  it("reports each step and stops at the first failure", async () => {
    const onStep = vi.fn();
    const run = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    run.mockRejectedValueOnce(new Error("no network"));
    const download = vi.fn().mockResolvedValue(undefined);

    await expect(runBottleSetup({ netfx48: false }, onStep, { run, download })).rejects.toThrow(
      "no network",
    );

    expect(onStep.mock.calls).toEqual([
      ["bottle", "running"],
      ["bottle", "done"],
      ["vcredist", "running"],
    ]);
  });
});
