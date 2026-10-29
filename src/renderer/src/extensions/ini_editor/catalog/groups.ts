/**
 * Regroupement des réglages d'un onglet en cartes thématiques (page de l'Éditeur de réglages). Le titre
 * d'une carte est la clé de texte `group.<id>`.
 */
import type { TabId } from "./types";

export interface ISettingGroup {
  id: string;
  /** identifiants des réglages du catalogue, dans l'ordre d'affichage */
  ids: readonly string[];
}

export const TAB_GROUPS: Record<TabId, readonly ISettingGroup[]> = {
  display: [
    {
      id: "window",
      ids: [
        "fullScreen",
        "borderless",
        "resolutionWidth",
        "resolutionHeight",
        "vsync",
        "lockFramerate",
        "fpsClamp",
        "worldFov",
      ],
    },
    {
      id: "aa",
      ids: ["multisample", "transparencyMultisample", "fxaa", "taa", "taaSharpen", "anisotropy"],
    },
    {
      id: "image",
      ids: [
        "gamma",
        "screenSpaceReflections",
        "ambientOcclusion",
        "hdr64",
        "projectedUV",
        "parallaxOcclusion",
        "precipitationOcclusion",
      ],
    },
  ],
  shadows: [
    {
      id: "quality",
      ids: [
        "shadowResolution",
        "shadowDistance",
        "interiorShadowDistance",
        "focusShadows",
        "shadowMaskQuarter",
        "sunShadowUpdate",
      ],
    },
    {
      id: "receivers",
      ids: ["actorSelfShadowing", "treeShadows", "landShadows", "grassShadows"],
    },
  ],
  distance: [
    {
      id: "fades",
      ids: [
        "objectFade",
        "itemFade",
        "actorFade",
        "skyCellFade",
        "autoViewDistance",
        "autoViewMin",
      ],
    },
    {
      id: "lod",
      ids: [
        "treeLodSwitch",
        "meshLod1",
        "meshLod2",
        "meshLod1Tree",
        "meshLod2Tree",
        "meshFadePercent",
      ],
    },
    { id: "lights", ids: ["lightFade", "lightFadeRange"] },
  ],
  grassLod: [
    {
      id: "grass",
      ids: [
        "grassFade",
        "grassFadeMin",
        "grassFadeMax",
        "grassMinSize",
        "grassDraw",
        "grassPointLighting",
      ],
    },
    {
      id: "terrain",
      ids: ["terrainBlock0", "terrainBlock1", "terrainMax", "terrainSplit", "largeRefGrid"],
    },
    {
      id: "trees",
      ids: [
        "treesEnabled",
        "treeAnimations",
        "skinnedTrees",
        "skinnedTreeCount",
        "treeLoadDistance",
      ],
    },
  ],
  waterFx: [
    {
      id: "water",
      ids: [
        "waterReflections",
        "waterRefractions",
        "waterDisplacements",
        "waterDepth",
        "waterReflectExplosions",
        "waterSilhouettes",
      ],
    },
    {
      id: "lightWeather",
      ids: [
        "volumetricLighting",
        "volumetricQuality",
        "sunbeams",
        "improvedSnow",
        "sparkles",
        "precipitation",
      ],
    },
    { id: "post", ids: ["depthOfField", "lensFlare", "radialBlur"] },
    {
      id: "decals",
      ids: [
        "decals",
        "skinnedDecals",
        "maxDecals",
        "maxSkinDecals",
        "maxDecalsPerFrame",
        "maxSkinDecalsPerFrame",
        "maxParticles",
      ],
    },
  ],
  interface: [
    {
      id: "hud",
      ids: [
        "compass",
        "crosshair",
        "hudOpacity",
        "hudMessages",
        "tutorials",
        "enemyHealthTime",
        "cursorSpeed",
      ],
    },
    { id: "subtitles", ids: ["generalSubtitles", "dialogueSubtitles", "subtitleDistance"] },
  ],
  game: [
    {
      id: "play",
      ids: ["difficulty", "language", "questMarkers", "floatingQuestMarkers", "healthBar"],
    },
    {
      id: "controls",
      ids: ["alwaysRun", "invertY", "gamepadRumble", "mouseSensitivity", "gamepadSensitivity"],
    },
    {
      id: "saves",
      ids: [
        "saveOnPause",
        "saveOnTravel",
        "saveOnWait",
        "saveOnRest",
        "autosaveMinutes",
        "autosaveCount",
        "saveBackups",
      ],
    },
    {
      id: "papyrus",
      ids: [
        "papyrusLogging",
        "papyrusTrace",
        "papyrusProfiling",
        "papyrusBudget",
        "papyrusTaskletBudget",
        "papyrusMemory",
      ],
    },
  ],
  camera: [
    { id: "zoom", ids: ["zoomIncrement", "zoomSpeed", "switchDelay"] },
    {
      id: "shoulder",
      ids: [
        "shoulderX",
        "shoulderZ",
        "shoulderCombatX",
        "shoulderCombatZ",
        "shoulderHorseX",
        "shoulderHorseZ",
      ],
    },
    {
      id: "idle",
      ids: ["disableAutoVanity", "autoVanityDelay", "vanityMaxDist", "vanityMinDist"],
    },
  ],
  audio: [
    { id: "volume", ids: ["masterVolume", "audioEnabled", "audioCache"] },
    { id: "music", ids: ["musicDucking", "musicUnducking"] },
  ],
};
