/**
 * mORTEX : les pièges rencontrés en portant Community Shaders, les presets ENB et l'upscaling sur
 * Skyrim SE sous CrossOver (DXMT), et leurs solutions (projet mDLSS). Textes en anglais, traduits
 * dans locales/<langue>/common.json.
 */
import type { DxmtCheckId } from "../../util/macos/dxmtChecks";

export interface IDxmtPitfall {
  id: string;
  icon: string;
  title: string;
  symptom: string;
  cause: string;
  fix: string;
  /** contrôle du bilan qui détecte ce piège, s'il y en a un */
  check?: DxmtCheckId;
}

export const PITFALLS: IDxmtPitfall[] = [
  {
    id: "engine",
    icon: "memory",
    title: "Community Shaders needs DXMT",
    symptom: "The game crashes at launch or Community Shaders stays disabled.",
    cause:
      "Bottled Shaders needs a Direct3D 11 feature level that DXVK (through MoltenVK) and D3DMetal don't provide.",
    fix: "Switch the bottle's graphics backend to DXMT in CrossOver.",
    check: "engine",
  },
  {
    id: "swap-effect",
    icon: "desktop_windows",
    title: "SSE Display Tweaks under DXMT",
    symptom: "Black screen, then the game closes.",
    cause:
      "Under DXMT, D3D11CreateDeviceAndSwapChain fails (0x80070057) with the default swap effect.",
    fix: "Set SwapEffect = flip_discard in SSEDisplayTweaks.ini. mORTEX also sets SwapBufferCount = 3 for smoother frames and declares the video memory (VideoMemorySizeMb), which DXMT reports poorly on Apple Silicon's shared memory.",
    check: "displayTweaks",
  },
  {
    id: "bottled-duplicates",
    icon: "content_copy",
    title: "Terrain Helper and Inverse Square Lighting twice",
    symptom: "Crash at launch, or plugins reported as unknown.",
    cause: "Bottled Shaders already includes Terrain Helper and Inverse Square Lighting.",
    fix: "Disable the standalone Terrain Helper and Inverse Square Lighting mods.",
    check: "bottledDuplicates",
  },
  {
    id: "enb-bridge",
    icon: "hub",
    title: "ENB presets without ENBSeries",
    symptom: "ENBSeries doesn't run under CrossOver, so ENB presets don't load.",
    cause: "ENB presets rely on the ENB SDK, which only ENBSeries provides.",
    fix: "Install the mDLSS ENB bridge (d3d11.dll) next to SkyrimSE.exe: it imitates the ENB SDK for KiLoader, ENB Extender and AELAS, and Bottled Shaders does the rendering.",
    check: "bridge",
  },
  {
    id: "enb-helper",
    icon: "extension",
    title: "ENB Helper for game version 1.6.1170",
    symptom: "ENB Extender fails to load or crashes.",
    cause: "The main variant of ENB Extender 1.6.0 targets Skyrim 1.7.104 and later.",
    fix: "Install the Legacy variant (1.6.629-1.6.1179).",
  },
  {
    id: "fsr-flicker",
    icon: "grass",
    title: "Flickering foliage with FSR 3.1",
    symptom: "Grass and leaves shimmer constantly.",
    cause: "FSR 3.1 upscaling in Bottled Shaders doesn't behave well under DXMT.",
    fix: "Use TAA as the upscaler in Bottled Shaders.",
  },
  {
    id: "no-dx12",
    icon: "block",
    title: "No frame generation",
    symptom: "Enabling FSR frame generation crashes the game.",
    cause: "DXMT has no Direct3D 12, which the frame generation proxy needs.",
    fix: "Leave frame generation off. Skyrim Upscaler (PureDark) also shows a black screen under CrossOver, whatever the backend.",
  },
  {
    id: "plugins-lock",
    icon: "lock",
    title: "The game reorders your plugins",
    symptom: "Your load order changes after each launch.",
    cause: "The game rewrites Plugins.txt when it starts.",
    fix: "Lock Plugins.txt before launching, then unlock it to change the load order.",
  },
];
