/**
 * mORTEX (macOS) : présentation des raccourcis dans l'Éditeur de réglages. On ne montre que les
 * événements dont le jeu permet de changer la touche clavier (ceux de son propre menu des commandes),
 * rangés en quatre groupes. Seules celles que le fichier binaire sait écrire sont montrées.
 */
import { CONTROL_EVENT_IDS } from "./controlBinary";
import type { IControlEvent, IControlMap } from "./controlMap";
import { macKeyName } from "./dikKeys";

export const eventSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const CONTROL_GROUPS: ReadonlyArray<{ id: string; slugs: readonly string[] }> = [
  {
    id: "movement",
    slugs: [
      "forward",
      "back",
      "strafe_left",
      "strafe_right",
      "jump",
      "sprint",
      "sneak",
      "run",
      "toggle_always_run",
      "auto_move",
      "toggle_pov",
    ],
  },
  {
    id: "combat",
    slugs: ["left_attack_block", "right_attack_block", "ready_weapon", "shout", "activate", "wait"],
  },
  {
    id: "quick",
    slugs: [
      "tween_menu",
      "favorites",
      "journal",
      "quick_inventory",
      "quick_magic",
      "quick_stats",
      "quick_map",
    ],
  },
  { id: "system", slugs: ["pause", "quicksave", "quickload"] },
];

/** événements dont l'écran a un texte (les autres sont affichés avec leur nom du jeu) */
export interface IControlGroup {
  id: string;
  events: IControlEvent[];
}

/** les actions modifiables que le fichier de commandes de Skyrim sait enregistrer, par groupe */
export function remappableGroups(map: IControlMap): IControlGroup[] {
  const events = map.contexts.flatMap((c) => c.events).filter((e) => e.remappable);
  return CONTROL_GROUPS.map((group) => ({
    id: group.id,
    events: group.slugs
      .filter((slug) => CONTROL_EVENT_IDS[slug] !== undefined)
      .map((slug) => events.find((e) => eventSlug(e.name) === slug))
      .filter((e): e is IControlEvent => e !== undefined),
  })).filter((g) => g.events.length > 0);
}

/** « W », « ⌥ Option », « A / B » pour deux touches possibles, « A + B » pour une combinaison */
export function keysText(combos: readonly (readonly number[])[], none: string): string {
  if (combos.length === 0) return none;
  return combos.map((combo) => combo.map(macKeyName).join(" + ")).join(" / ");
}
