/**
 * mORTEX : étapes de la visite guidée (textes anglais, traduits dans locales/<langue>/common.json).
 * Lu aussi par mac/gen_tour_audio.py (voix enregistrées).
 */
export interface ITourStep {
  id: string;
  /** sélecteur de l'élément commenté ; sans lui, la bulle est centrée */
  anchor?: string;
  /** page à montrer pendant l'étape */
  page?: string;
  /** fonction exclusive au Mac */
  exclusive?: boolean;
  title: string;
  text: string;
}

export const STEPS: ITourStep[] = [
  {
    id: "welcome",
    title: "Welcome to mORTEX",
    text: "mORTEX brings the Nexus Mods mod manager to the Mac: your Skyrim mods, in your CrossOver bottle, with tools you won't find anywhere else. This short tour shows you around.",
  },
  {
    id: "game",
    anchor: '[data-tour="game"]',
    title: "Your game and its bottle",
    text: "mORTEX finds Skyrim in your CrossOver or Wine bottles. Switch game or profile here.",
  },
  {
    id: "mods",
    anchor: '[data-tour="Mods"]',
    page: "Mods",
    title: "Your mods",
    text: "Install, enable and update your mods. Drop an archive on the window, or use a download button on Nexus Mods: mORTEX does the rest.",
  },
  {
    id: "plugins",
    anchor: '[data-tour="gamebryo-plugins"]',
    page: "gamebryo-plugins",
    title: "Load order",
    text: "Your plugins are sorted with LOOT, which runs natively on Apple Silicon.",
  },
  {
    id: "nexus",
    anchor: '[data-tour="Browse Nexus Mods"]',
    page: "Browse Nexus Mods",
    title: "Nexus Mods without leaving mORTEX",
    text: "Search collections and mods, then download them in one click.",
  },
  {
    id: "downloads",
    anchor: '[data-tour="__downloads"]',
    title: "Your downloads",
    text: "Every archive you downloaded, ready to install again. Even tens of thousands of them scroll smoothly.",
  },
  {
    id: "dxmt",
    anchor: '[data-tour="DXMT workshop"]',
    page: "DXMT workshop",
    exclusive: true,
    title: "The DXMT workshop",
    text: "Community Shaders and ENB presets on a Mac: this workshop checks your bottle, explains each pitfall we solved, and fixes SSE Display Tweaks in one click.",
  },
  {
    id: "timemachine",
    anchor: '[data-tour="Time Machine"]',
    page: "Time Machine",
    exclusive: true,
    title: "Time Machine for your mods",
    text: "Before each deployment, mORTEX takes an APFS snapshot of Data, your mods, the load order and your INI files. Go back in one click.",
  },
  {
    id: "health",
    anchor: '[data-tour="Dashboard"]',
    page: "Dashboard",
    exclusive: true,
    title: "The health of your bottle",
    text: "On the dashboard, a card checks your bottle: CrossOver, graphics backend, MSync, free space and DLL overrides. Duplicate files become APFS clones, to save space.",
  },
  {
    id: "notifications",
    anchor: 'button[aria-label="Notifications"]',
    exclusive: true,
    title: "Notifications that explain",
    text: "When the game starts, mORTEX reads the SKSE log and tells you which plugins didn't load, and why.",
  },
  {
    id: "launch",
    anchor: '[data-tour="launch"]',
    page: "Mods",
    title: "One click to play",
    text: "Launch Skyrim with SKSE in its bottle. mORTEX also sets the DLL overrides your mods need.",
  },
  {
    id: "outside",
    anchor: '[data-tour="brand"]',
    exclusive: true,
    title: "mORTEX outside its window",
    text: "The menu bar icon shows progress and launches the game. Shortcuts and Siri can deploy or take a snapshot. In the Finder, the space bar previews DDS textures and plugins.",
  },
  {
    id: "end",
    title: "Ready to play!",
    text: "Tip: hold Option to reorder the sidebar. You can replay this tour from the Help menu. Enjoy your adventure in Skyrim!",
  },
];
