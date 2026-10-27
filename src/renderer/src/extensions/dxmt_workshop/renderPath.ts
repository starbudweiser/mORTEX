/**
 * mORTEX : le chemin d'une image de Skyrim SE jusqu'au GPU du Mac sous DXMT, et les recettes
 * pas à pas pour Community Shaders et les presets ENB (projet mDLSS). Textes en anglais,
 * traduits dans locales/<langue>/common.json.
 */
import type { DxmtCheckId } from "../../util/macos/dxmtChecks";

export interface IRenderStage {
  id: string;
  icon: string;
  name: string;
  role: string;
  /** étape facultative, dessinée en pointillés quand elle manque */
  optional?: boolean;
  /** contrôle du bilan qui dit si l'étape est en place */
  check?: DxmtCheckId;
}

export const RENDER_PATH: IRenderStage[] = [
  {
    id: "game",
    icon: "stadia_controller",
    name: "Skyrim SE",
    role: "Draws each frame with Direct3D 11",
  },
  {
    id: "shaders",
    icon: "auto_awesome",
    name: "Community Shaders",
    role: "Bottled Shaders adds lighting, shadows and upscaling through SKSE",
    check: "bottledDuplicates",
  },
  {
    id: "bridge",
    icon: "hub",
    name: "mDLSS ENB bridge",
    role: "Imitates the ENB SDK so ENB presets load without ENBSeries",
    optional: true,
    check: "bridge",
  },
  {
    id: "dxmt",
    icon: "memory",
    name: "DXMT",
    role: "Translates Direct3D 11 into Metal inside the CrossOver bottle",
    check: "engine",
  },
  {
    id: "gpu",
    icon: "developer_board",
    name: "Apple GPU",
    role: "Renders the frame with Metal",
  },
];

export interface IRecipeStep {
  text: string;
  /** contrôle du bilan qui coche l'étape quand il est bon */
  check?: DxmtCheckId;
}

export interface IRecipe {
  id: string;
  icon: string;
  title: string;
  intro: string;
  steps: IRecipeStep[];
}

export const RECIPES: IRecipe[] = [
  {
    id: "community-shaders",
    icon: "auto_awesome",
    title: "Community Shaders recipe",
    intro: "The base of modern rendering on a Mac.",
    steps: [
      { text: "Switch the bottle's graphics backend to DXMT in CrossOver.", check: "engine" },
      {
        text: "Install Community Shaders (Bottled). It already includes Terrain Helper and Inverse Square Lighting: don't install them separately.",
        check: "bottledDuplicates",
      },
      {
        text: "Install SSE Display Tweaks and let mORTEX optimize it for DXMT.",
        check: "displayTweaks",
      },
      { text: "In Bottled Shaders, choose TAA as the upscaler and leave frame generation off." },
      { text: "Lock Plugins.txt before launching the game." },
    ],
  },
  {
    id: "enb",
    icon: "hub",
    title: "ENB preset recipe",
    intro: "ENB presets on top of Community Shaders, without ENBSeries.",
    steps: [
      { text: "Follow the Community Shaders recipe first: Bottled Shaders does the rendering." },
      {
        text: "Install the mDLSS ENB bridge (d3d11.dll) next to SkyrimSE.exe, in place of ENBSeries.",
        check: "bridge",
      },
      {
        text: "Install the plugins the preset relies on: KiLoader, ENB Extender (Legacy variant for game version 1.6.1170) and AELAS.",
      },
    ],
  },
];
