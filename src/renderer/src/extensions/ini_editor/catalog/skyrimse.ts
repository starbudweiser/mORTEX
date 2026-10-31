/**
 * Catalogue mORTEX des réglages courants de Skyrim SE / AE, rédigé à la main (étape 2 de l'Éditeur de
 * réglages). Il décrit chaque réglage : onglet, fichier de section, type, bornes, dépendances. Les textes
 * d'aide et les notes Mac sont dans le fichier de traduction `ini_editor` (clés `help.<id>` et
 * `macNote.<id>`). Les bornes sont celles que l'interface propose, pas des limites du jeu.
 */
import type { ICatalogSetting, ISettingOption, SettingType, TabId } from "./types";

type Extra = Partial<
  Pick<
    ICatalogSetting,
    "min" | "max" | "step" | "unit" | "options" | "dependsOn" | "macNote" | "outsideExe"
  >
>;

const def =
  (type: SettingType) =>
  (tab: TabId, id: string, section: string, key: string, extra: Extra = {}): ICatalogSetting => ({
    id,
    tab,
    section,
    key,
    type,
    ...extra,
  });

const bool = def("bool");
const int = def("int");
const float = def("float");
const choice = def("choice");
const text = def("text");

const numbers = (...values: number[]): ISettingOption[] =>
  values.map((value) => ({ value: String(value), label: String(value) }));
const states = (...values: string[]): ISettingOption[] => values.map((value) => ({ value }));

export const SKYRIMSE_CATALOG: readonly ICatalogSetting[] = [
  // --- Affichage -------------------------------------------------------------------------------
  bool("display", "fullScreen", "Display", "bFull Screen", { macNote: true }),
  bool("display", "borderless", "Display", "bBorderless", { macNote: true }),
  int("display", "resolutionWidth", "Display", "iSize W", {
    min: 640,
    max: 7680,
    step: 1,
    unit: "px",
    macNote: true,
  }),
  int("display", "resolutionHeight", "Display", "iSize H", {
    min: 480,
    max: 4320,
    step: 1,
    unit: "px",
    macNote: true,
  }),
  choice("display", "vsync", "Display", "iPresentInterval", {
    options: states("0", "1"),
    macNote: true,
    outsideExe: true,
  }),
  choice("display", "multisample", "Display", "iMultiSample", {
    options: states("0", "2", "4", "8"),
    macNote: true,
    outsideExe: true,
  }),
  bool("display", "transparencyMultisample", "Display", "bTransparencyMultisampling", {
    dependsOn: { on: "multisample", not: "0" },
    outsideExe: true,
  }),
  bool("display", "fxaa", "Display", "bFXAAEnabled"),
  bool("display", "taa", "Display", "bUseTAA"),
  float("display", "taaSharpen", "Display", "fTAASharpen", {
    min: 0,
    max: 1,
    step: 0.05,
    dependsOn: { on: "taa" },
  }),
  choice("display", "anisotropy", "Display", "iMaxAnisotropy", {
    options: states("0", "2", "4", "8", "16"),
    outsideExe: true,
  }),
  float("display", "gamma", "Display", "fGamma", { min: 0.5, max: 2, step: 0.05 }),
  bool("display", "screenSpaceReflections", "Display", "bScreenSpaceReflectionEnabled", {
    macNote: true,
  }),
  bool("display", "ambientOcclusion", "Display", "bSAOEnable", { macNote: true }),
  bool("display", "hdr64", "Display", "bUse64bitsHDRRenderTarget", { macNote: true }),
  bool("display", "projectedUV", "Display", "bEnableProjecteUVDiffuseNormals"),
  bool("display", "parallaxOcclusion", "Display", "bEnableParallaxOcclusion"),
  bool("display", "precipitationOcclusion", "Display", "bUsePrecipitationOcclusion"),
  bool("display", "lockFramerate", "Display", "bLockFramerate", { macNote: true }),
  int("display", "fpsClamp", "General", "iFPSClamp", { min: 0, max: 360, step: 1, unit: "fps" }),
  float("display", "worldFov", "Display", "fDefaultWorldFOV", {
    min: 50,
    max: 120,
    step: 1,
    unit: "°",
  }),

  // --- Ombres ----------------------------------------------------------------------------------
  choice("shadows", "shadowResolution", "Display", "iShadowMapResolution", {
    options: numbers(512, 1024, 2048, 4096, 8192),
    macNote: true,
  }),
  float("shadows", "shadowDistance", "Display", "fShadowDistance", {
    min: 1000,
    max: 20000,
    step: 500,
    macNote: true,
  }),
  float("shadows", "interiorShadowDistance", "Display", "fInteriorShadowDistance", {
    min: 500,
    max: 10000,
    step: 250,
  }),
  int("shadows", "focusShadows", "Display", "iNumFocusShadow", {
    min: 0,
    max: 8,
    step: 1,
  }),
  int("shadows", "shadowMaskQuarter", "Display", "iShadowMaskQuarter", {
    min: 1,
    max: 8,
    step: 1,
  }),
  bool("shadows", "actorSelfShadowing", "Display", "bActorSelfShadowing"),
  bool("shadows", "treeShadows", "Display", "bTreesReceiveShadows"),
  bool("shadows", "landShadows", "Display", "bDrawLandShadows"),
  bool("shadows", "grassShadows", "Display", "bShadowsOnGrass"),
  float("shadows", "sunShadowUpdate", "Display", "fSunShadowUpdateTime", {
    min: 0,
    max: 5,
    step: 0.1,
    unit: "s",
  }),

  // --- Distance d'affichage --------------------------------------------------------------------
  float("distance", "objectFade", "LOD", "fLODFadeOutMultObjects", {
    min: 1,
    max: 100,
    step: 1,
    macNote: true,
  }),
  float("distance", "itemFade", "LOD", "fLODFadeOutMultItems", { min: 1, max: 100, step: 1 }),
  float("distance", "actorFade", "LOD", "fLODFadeOutMultActors", { min: 1, max: 100, step: 1 }),
  float("distance", "skyCellFade", "LOD", "fLODFadeOutMultSkyCell", {
    min: 0.5,
    max: 10,
    step: 0.5,
  }),
  float("distance", "treeLodSwitch", "Display", "fTreesMidLODSwitchDist", {
    min: 0,
    max: 9999999,
    step: 1000,
  }),
  float("distance", "meshLod1", "Display", "fMeshLODLevel1FadeDist", {
    min: 0,
    max: 9999999,
    step: 1000,
  }),
  float("distance", "meshLod2", "Display", "fMeshLODLevel2FadeDist", {
    min: 0,
    max: 9999999,
    step: 1000,
  }),
  float("distance", "meshLod1Tree", "Display", "fMeshLODLevel1FadeTreeDistance", {
    min: 0,
    max: 9999999,
    step: 100,
  }),
  float("distance", "meshLod2Tree", "Display", "fMeshLODLevel2FadeTreeDistance", {
    min: 0,
    max: 9999999,
    step: 100,
  }),
  float("distance", "meshFadePercent", "Display", "fMeshLODFadePercentDefault", {
    min: 0.5,
    max: 5,
    step: 0.1,
  }),
  float("distance", "lightFade", "Display", "fLightLODStartFade", {
    min: 500,
    max: 20000,
    step: 250,
  }),
  float("distance", "lightFadeRange", "Display", "fLightLODRange", {
    min: 100,
    max: 5000,
    step: 100,
  }),
  bool("distance", "autoViewDistance", "Display", "bAutoViewDistance"),
  int("distance", "autoViewMin", "Display", "iAutoViewMinDistance", {
    min: 0,
    max: 100000,
    step: 500,
    dependsOn: { on: "autoViewDistance" },
  }),

  // --- Herbe et LOD ----------------------------------------------------------------------------
  float("grassLod", "grassFade", "Grass", "fGrassStartFadeDistance", {
    min: 0,
    max: 20000,
    step: 250,
    macNote: true,
  }),
  float("grassLod", "grassFadeMin", "Grass", "fGrassMinStartFadeDistance", {
    min: 0,
    max: 20000,
    step: 250,
  }),
  float("grassLod", "grassFadeMax", "Grass", "fGrassMaxStartFadeDistance", {
    min: 0,
    max: 20000,
    step: 250,
  }),
  int("grassLod", "grassMinSize", "Grass", "iMinGrassSize", { min: 10, max: 200, step: 5 }),
  bool("grassLod", "grassDraw", "Grass", "bDrawShaderGrass"),
  bool("grassLod", "grassPointLighting", "Grass", "bGrassPointLighting"),
  float("grassLod", "terrainBlock0", "TerrainManager", "fBlockLevel0Distance", {
    min: 5000,
    max: 150000,
    step: 1000,
    macNote: true,
  }),
  float("grassLod", "terrainBlock1", "TerrainManager", "fBlockLevel1Distance", {
    min: 10000,
    max: 250000,
    step: 1000,
  }),
  float("grassLod", "terrainMax", "TerrainManager", "fBlockMaximumDistance", {
    min: 50000,
    max: 500000,
    step: 5000,
  }),
  float("grassLod", "terrainSplit", "TerrainManager", "fSplitDistanceMult", {
    min: 0.5,
    max: 5,
    step: 0.1,
  }),
  float("grassLod", "treeLoadDistance", "TerrainManager", "fTreeLoadDistance", {
    min: 10000,
    max: 150000,
    step: 1000,
  }),
  int("grassLod", "largeRefGrid", "General", "uLargeRefLODGridSize", {
    min: 5,
    max: 21,
    step: 2,
    macNote: true,
  }),
  bool("grassLod", "treesEnabled", "Trees", "bEnableTrees"),
  bool("grassLod", "treeAnimations", "Trees", "bEnableTreeAnimations", {
    dependsOn: { on: "treesEnabled" },
  }),
  bool("grassLod", "skinnedTrees", "Trees", "bRenderSkinnedTrees", {
    dependsOn: { on: "treesEnabled" },
  }),
  int("grassLod", "skinnedTreeCount", "Trees", "uiMaxSkinnedTreesToRender", {
    min: 0,
    max: 200,
    step: 5,
    dependsOn: { on: "skinnedTrees" },
    outsideExe: true,
  }),

  // --- Eau et effets ---------------------------------------------------------------------------
  bool("waterFx", "waterReflections", "Water", "bUseWaterReflections", { macNote: true }),
  bool("waterFx", "waterRefractions", "Water", "bUseWaterRefractions"),
  bool("waterFx", "waterDisplacements", "Water", "bUseWaterDisplacements"),
  bool("waterFx", "waterDepth", "Water", "bUseWaterDepth"),
  bool("waterFx", "waterReflectExplosions", "Water", "bReflectExplosions", {
    dependsOn: { on: "waterReflections" },
  }),
  bool("waterFx", "waterSilhouettes", "Water", "bAutoWaterSilhouetteReflections", {
    dependsOn: { on: "waterReflections" },
  }),
  bool("waterFx", "volumetricLighting", "Display", "bVolumetricLightingEnable", {
    macNote: true,
  }),
  choice("waterFx", "volumetricQuality", "Display", "iVolumetricLightingQuality", {
    options: states("0", "1", "2", "3"),
    dependsOn: { on: "volumetricLighting" },
    macNote: true,
  }),
  bool("waterFx", "improvedSnow", "Display", "bEnableImprovedSnow"),
  bool("waterFx", "sparkles", "Display", "bToggleSparkles"),
  bool("waterFx", "sunbeams", "Display", "bUseSunbeams"),
  bool("waterFx", "depthOfField", "Imagespace", "bDoDepthOfField"),
  bool("waterFx", "lensFlare", "ImageSpace", "bLensFlare", { outsideExe: true }),
  bool("waterFx", "radialBlur", "Imagespace", "bDoRadialBlur"),
  bool("waterFx", "precipitation", "Weather", "bPrecipitation"),
  bool("waterFx", "decals", "Decals", "bDecals"),
  bool("waterFx", "skinnedDecals", "Decals", "bSkinnedDecals", { dependsOn: { on: "decals" } }),
  int("waterFx", "maxDecals", "Decals", "uMaxDecals", {
    min: 0,
    max: 5000,
    step: 50,
    dependsOn: { on: "decals" },
  }),
  int("waterFx", "maxSkinDecals", "Decals", "uMaxSkinDecals", {
    min: 0,
    max: 1000,
    step: 10,
    dependsOn: { on: "skinnedDecals" },
  }),
  int("waterFx", "maxDecalsPerFrame", "Decals", "iMaxDecalsPerFrame", {
    min: 0,
    max: 500,
    step: 10,
    dependsOn: { on: "decals" },
    outsideExe: true,
  }),
  int("waterFx", "maxSkinDecalsPerFrame", "Decals", "iMaxSkinDecalsPerFrame", {
    min: 0,
    max: 200,
    step: 5,
    dependsOn: { on: "skinnedDecals" },
    outsideExe: true,
  }),
  int("waterFx", "maxParticles", "Particles", "iMaxDesired", {
    min: 100,
    max: 20000,
    step: 50,
  }),

  // --- Interface -------------------------------------------------------------------------------
  bool("interface", "compass", "Interface", "bShowCompass"),
  bool("interface", "crosshair", "MAIN", "bCrosshairEnabled", { outsideExe: true }),
  float("interface", "hudOpacity", "MAIN", "fHUDOpacity", {
    min: 0,
    max: 1,
    step: 0.05,
    outsideExe: true,
  }),
  bool("interface", "generalSubtitles", "Interface", "bGeneralSubtitles"),
  bool("interface", "dialogueSubtitles", "Interface", "bDialogueSubtitles"),
  bool("interface", "tutorials", "Interface", "bShowTutorials"),
  bool("interface", "hudMessages", "Interface", "bShowHUDMessages"),
  float("interface", "cursorSpeed", "Interface", "fMouseCursorSpeed", {
    min: 0.1,
    max: 3,
    step: 0.1,
  }),
  int("interface", "enemyHealthTime", "Interface", "iEnemyHealthDisplayTime", {
    min: 0,
    max: 30,
    step: 1,
    unit: "s",
  }),
  float("interface", "subtitleDistance", "Interface", "fMaxSubtitleDistance", {
    min: 0,
    max: 5000,
    step: 100,
  }),

  // --- Jeu -------------------------------------------------------------------------------------
  choice("game", "difficulty", "GamePlay", "iDifficulty", {
    options: states("0", "1", "2", "3", "4", "5"),
  }),
  bool("game", "questMarkers", "GamePlay", "bShowQuestMarkers"),
  bool("game", "floatingQuestMarkers", "GamePlay", "bShowFloatingQuestMarkers", {
    dependsOn: { on: "questMarkers" },
  }),
  bool("game", "healthBar", "GamePlay", "bHealthBarShowing"),
  choice("game", "language", "General", "sLanguage", {
    options: [
      { value: "ENGLISH", label: "English" },
      { value: "FRENCH", label: "Français" },
      { value: "GERMAN", label: "Deutsch" },
      { value: "ITALIAN", label: "Italiano" },
      { value: "SPANISH", label: "Español" },
      { value: "POLISH", label: "Polski" },
      { value: "RUSSIAN", label: "Русский" },
      { value: "JAPANESE", label: "日本語" },
      { value: "CZECH", label: "Čeština" },
    ],
  }),
  bool("game", "alwaysRun", "Controls", "bAlwaysRunByDefault"),
  bool("game", "invertY", "Controls", "bInvertYValues"),
  bool("game", "gamepadRumble", "Controls", "bGamePadRumble"),
  float("game", "mouseSensitivity", "Controls", "fMouseHeadingSensitivity", {
    min: 0.001,
    max: 0.05,
    step: 0.0005,
  }),
  float("game", "gamepadSensitivity", "Controls", "fGamepadHeadingSensitivity", {
    min: 0.1,
    max: 3,
    step: 0.05,
  }),
  bool("game", "saveOnPause", "MAIN", "bSaveOnPause", { outsideExe: true }),
  bool("game", "saveOnTravel", "MAIN", "bSaveOnTravel", { outsideExe: true }),
  bool("game", "saveOnWait", "MAIN", "bSaveOnWait", { outsideExe: true }),
  bool("game", "saveOnRest", "MAIN", "bSaveOnRest", { outsideExe: true }),
  float("game", "autosaveMinutes", "SaveGame", "fAutosaveEveryXMins", {
    min: 1,
    max: 120,
    step: 1,
    unit: "min",
  }),
  int("game", "autosaveCount", "SaveGame", "iAutoSaveCount", { min: 1, max: 20, step: 1 }),
  int("game", "saveBackups", "SaveGame", "iSaveGameBackupCount", { min: 0, max: 10, step: 1 }),
  bool("game", "papyrusLogging", "Papyrus", "bEnableLogging"),
  bool("game", "papyrusTrace", "Papyrus", "bEnableTrace", { dependsOn: { on: "papyrusLogging" } }),
  bool("game", "papyrusProfiling", "Papyrus", "bEnableProfiling", {
    dependsOn: { on: "papyrusLogging" },
  }),
  float("game", "papyrusBudget", "Papyrus", "fUpdateBudgetMS", {
    min: 0.5,
    max: 10,
    step: 0.1,
    unit: "ms",
  }),
  float("game", "papyrusTaskletBudget", "Papyrus", "fExtraTaskletBudgetMS", {
    min: 0.5,
    max: 10,
    step: 0.1,
    unit: "ms",
  }),
  int("game", "papyrusMemory", "Papyrus", "iMaxAllocatedMemoryBytes", {
    min: 65536,
    max: 2147483647,
    step: 65536,
    unit: "o",
  }),

  // --- Caméra ----------------------------------------------------------------------------------
  float("camera", "zoomIncrement", "Camera", "fMouseWheelZoomIncrement", {
    min: 0.01,
    max: 0.5,
    step: 0.01,
  }),
  float("camera", "zoomSpeed", "Camera", "fMouseWheelZoomSpeed", { min: 1, max: 30, step: 1 }),
  float("camera", "switchDelay", "Camera", "f1st3rdSwitchDelay", {
    min: 0,
    max: 1,
    step: 0.05,
    unit: "s",
  }),
  float("camera", "shoulderX", "Camera", "fOverShoulderPosX", { min: -60, max: 60, step: 1 }),
  float("camera", "shoulderZ", "Camera", "fOverShoulderPosZ", { min: -30, max: 30, step: 1 }),
  float("camera", "shoulderCombatX", "Camera", "fOverShoulderCombatPosX", {
    min: -60,
    max: 60,
    step: 1,
  }),
  float("camera", "shoulderCombatZ", "Camera", "fOverShoulderCombatPosZ", {
    min: -30,
    max: 30,
    step: 1,
  }),
  float("camera", "shoulderHorseX", "Camera", "fOverShoulderHorsePosX", {
    min: -60,
    max: 60,
    step: 1,
  }),
  float("camera", "shoulderHorseZ", "Camera", "fOverShoulderHorsePosZ", {
    min: -30,
    max: 30,
    step: 1,
  }),
  bool("camera", "disableAutoVanity", "Camera", "bDisableAutoVanityMode"),
  float("camera", "autoVanityDelay", "Camera", "fAutoVanityModeDelay", {
    min: 10,
    max: 600,
    step: 10,
    unit: "s",
    dependsOn: { on: "disableAutoVanity", value: "0" },
  }),
  float("camera", "vanityMaxDist", "Camera", "fVanityModeMaxDist", {
    min: 50,
    max: 2000,
    step: 10,
  }),
  float("camera", "vanityMinDist", "Camera", "fVanityModeMinDist", {
    min: 20,
    max: 500,
    step: 10,
  }),

  // --- Audio -----------------------------------------------------------------------------------
  float("audio", "masterVolume", "AudioMenu", "fAudioMasterVolume", {
    min: 0,
    max: 1,
    step: 0.05,
  }),
  bool("audio", "audioEnabled", "Audio", "bEnableAudio"),
  float("audio", "musicDucking", "Audio", "fMusicDuckingSeconds", {
    min: 0,
    max: 10,
    step: 0.5,
    unit: "s",
  }),
  float("audio", "musicUnducking", "Audio", "fMusicUnDuckingSeconds", {
    min: 0,
    max: 10,
    step: 0.5,
    unit: "s",
  }),
  bool("audio", "audioCache", "Audio", "bEnableAudioCache", {
    dependsOn: { on: "audioEnabled" },
  }),
];

export const settingsOfTab = (tab: TabId): ICatalogSetting[] =>
  SKYRIMSE_CATALOG.filter((setting) => setting.tab === tab);
