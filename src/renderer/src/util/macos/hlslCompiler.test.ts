import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installNativeCompiler, nativeCompilerSource } from "./hlslCompiler";

describe("HLSL compiler of the bottle", () => {
  let bottle: string;
  const sys32 = () => path.join(bottle, "drive_c", "windows", "system32");
  const desktop = (version: string, bytes: number) => {
    const dir = path.join(
      bottle,
      "drive_c",
      "Program Files",
      "dotnet",
      "shared",
      "Microsoft.WindowsDesktop.App",
      version,
    );
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "D3DCompiler_47_cor3.dll"), Buffer.alloc(bytes, 1));
    return path.join(dir, "D3DCompiler_47_cor3.dll");
  };

  beforeEach(() => {
    bottle = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-hlsl-"));
    fs.mkdirSync(sys32(), { recursive: true });
    fs.writeFileSync(path.join(sys32(), "d3dcompiler_47.dll"), Buffer.alloc(179_776, 7));
  });

  afterEach(() => fs.rmSync(bottle, { recursive: true, force: true }));

  it("finds nothing without the .NET desktop runtime", async () => {
    expect(await nativeCompilerSource(bottle)).toBeUndefined();
  });

  it("takes the newest runtime, numerically, and ignores a stub", async () => {
    desktop("8.0.9", 4_741_488);
    const newest = desktop("8.0.10", 4_741_488);
    desktop("9.0.0", 1000);
    expect(await nativeCompilerSource(bottle)).toBe(newest);
  });

  it("swaps Wine's compiler for Microsoft's, and swaps back", async () => {
    const source = desktop("8.0.9", 4_741_488);
    const undo = await installNativeCompiler(bottle, source);

    const dll = path.join(sys32(), "d3dcompiler_47.dll");
    expect(fs.statSync(dll).size).toBe(4_741_488);
    expect(fs.statSync(path.join(sys32(), "d3dcompiler_47.dll.wine")).size).toBe(179_776);

    await undo();
    expect(fs.statSync(dll).size).toBe(179_776);
    expect(fs.existsSync(path.join(sys32(), "d3dcompiler_47.dll.wine"))).toBe(false);
  });

  it("keeps Wine's copy through a second install", async () => {
    const source = desktop("8.0.9", 4_741_488);
    await installNativeCompiler(bottle, source);
    const undo = await installNativeCompiler(bottle, source);
    await undo();
    expect(fs.statSync(path.join(sys32(), "d3dcompiler_47.dll")).size).toBe(4_741_488);
    expect(fs.statSync(path.join(sys32(), "d3dcompiler_47.dll.wine")).size).toBe(179_776);
  });
});
