/**
 * mORTEX (macOS) : lecture et modification de la table des commandes de Skyrim (`controlmap.txt`).
 * Une ligne par événement, champs séparés par des tabulations : nom, clavier, souris, manette, trois
 * drapeaux « remappable » (clavier, souris, manette) et un drapeau de groupe facultatif. Des lignes vides
 * séparent les contextes (jeu, menus, console…), dont le titre est le commentaire `// …` juste avant.
 *
 * On ne change que le champ clavier d'une ligne : tout le reste du fichier (commentaires, ordre,
 * tabulations, fins de ligne) reste identique octet pour octet.
 */

export interface IControlEvent {
  /** numéro du contexte (ordre dans le fichier) */
  context: number;
  name: string;
  /** champ clavier tel qu'écrit dans le fichier : `0x11`, `0x02,0x4f`, `0x1d+0xb7`, `0xff`, `!0,Activate` */
  keyboard: string;
  /** champ souris tel qu'écrit dans le fichier (`0xff` : pas de bouton) */
  mouse: string;
  /** vrai si le jeu permet de changer la touche clavier de cet événement */
  remappable: boolean;
  /** numéro de la ligne dans le fichier */
  line: number;
}

export interface IControlContext {
  index: number;
  title: string;
  events: IControlEvent[];
}

export interface IControlMap {
  eol: string;
  lines: string[];
  contexts: IControlContext[];
}

/** touches d'un événement : aucune, un renvoi vers un autre événement, ou des combinaisons de codes DIK */
export type KeySlot =
  | { kind: "unmapped" }
  | { kind: "alias"; text: string }
  | { kind: "keys"; combos: number[][] };

export const eventId = (context: number, name: string): string =>
  `${context}\u0000${name.toLowerCase()}`;

const isBlank = (line: string) => line.trim() === "";

export function parseControlMap(text: string): IControlMap {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const contexts: IControlContext[] = [];
  let current: IControlContext | undefined;
  let title = "";
  lines.forEach((line, i) => {
    if (isBlank(line)) {
      current = undefined;
      return;
    }
    if (line.trimStart().startsWith("//")) {
      title = line
        .trim()
        .replace(/^\/\/\s*/, "")
        .trim();
      return;
    }
    const fields = line.trimEnd().split(/\t+/);
    if (fields.length < 4) return;
    if (current === undefined) {
      current = { index: contexts.length, title, events: [] };
      contexts.push(current);
    }
    current.events.push({
      context: current.index,
      name: fields[0],
      keyboard: fields[1],
      mouse: fields[2] ?? "0xff",
      remappable: fields[4] === "1",
      line: i,
    });
  });
  return { eol, lines, contexts };
}

export const serializeControlMap = (map: IControlMap): string => map.lines.join(map.eol);

export function parseKeySlot(field: string): KeySlot {
  const text = field.trim();
  if (/^0xff$/i.test(text)) return { kind: "unmapped" };
  if (text.startsWith("!")) return { kind: "alias", text };
  const combos = text.split(",").map((combo) => combo.split("+").map((k) => parseInt(k, 16)));
  if (combos.some((combo) => combo.some((k) => Number.isNaN(k)))) return { kind: "alias", text };
  return { kind: "keys", combos };
}

const hex = (code: number) => `0x${code.toString(16).padStart(2, "0")}`;

/** champ clavier à écrire : `0xff` quand il n'y a plus de touche */
export function formatKeySlot(combos: readonly (readonly number[])[]): string {
  if (combos.length === 0) return "0xff";
  return combos.map((combo) => combo.map(hex).join("+")).join(",");
}

const comboKey = (combo: readonly number[]) => combo.join("+");

export function findEvent(
  map: IControlMap,
  context: number,
  name: string,
): IControlEvent | undefined {
  const id = eventId(context, name);
  return map.contexts[context]?.events.find((e) => eventId(e.context, e.name) === id);
}

/** nouvelle table où le champ clavier de l'événement est remplacé ; le reste du texte est inchangé */
export function withKeyboard(
  map: IControlMap,
  context: number,
  name: string,
  combos: readonly (readonly number[])[],
): IControlMap {
  const event = findEvent(map, context, name);
  if (event === undefined) throw new Error(`Événement inconnu : ${name}`);
  const match = /^([^\t]+)(\t+)([^\t]+)([\s\S]*)$/.exec(map.lines[event.line]);
  if (match === null) throw new Error(`Ligne illisible : ${map.lines[event.line]}`);
  const lines = [...map.lines];
  lines[event.line] = `${match[1]}${match[2]}${formatKeySlot(combos)}${match[4]}`;
  return parseControlMap(lines.join(map.eol));
}

/** les combinaisons de touches d'un événement (vide s'il n'a pas de touche ou renvoie à un autre événement) */
export function keyCombos(event: IControlEvent): number[][] {
  const slot = parseKeySlot(event.keyboard);
  return slot.kind === "keys" ? slot.combos : [];
}

export interface IKeyConflict {
  context: number;
  /** combinaison partagée, codes DIK */
  combo: number[];
  /** noms des événements qui l'utilisent (au moins deux) */
  events: string[];
}

/** touches utilisées par plusieurs événements d'un même contexte (deux contextes différents ne sont jamais actifs ensemble) */
export function findConflicts(map: IControlMap): IKeyConflict[] {
  const result: IKeyConflict[] = [];
  for (const context of map.contexts) {
    const byCombo = new Map<string, { combo: number[]; events: string[] }>();
    for (const event of context.events) {
      for (const combo of keyCombos(event)) {
        const key = comboKey(combo);
        const entry = byCombo.get(key) ?? { combo, events: [] };
        if (!entry.events.includes(event.name)) entry.events.push(event.name);
        byCombo.set(key, entry);
      }
    }
    for (const { combo, events } of byCombo.values())
      if (events.length > 1) result.push({ context: context.index, combo, events });
  }
  return result;
}

export interface IKeyUse {
  context: number;
  name: string;
  combo: number[];
}

/** « trouver par touche » : les événements dont une combinaison contient cette touche */
export function eventsUsingKey(map: IControlMap, code: number): IKeyUse[] {
  const result: IKeyUse[] = [];
  for (const context of map.contexts)
    for (const event of context.events) {
      const combo = keyCombos(event).find((c) => c.includes(code));
      if (combo !== undefined) result.push({ context: context.index, name: event.name, combo });
    }
  return result;
}

export interface IControlChange {
  context: number;
  name: string;
  before: string;
  after: string;
}

/** événements dont le champ clavier diffère entre deux tables (même mise en page) */
export function changedEvents(before: IControlMap, after: IControlMap): IControlChange[] {
  const result: IControlChange[] = [];
  for (const context of after.contexts)
    for (const event of context.events) {
      const old = findEvent(before, context.index, event.name);
      if (old === undefined) continue;
      const a = parseKeySlot(old.keyboard);
      const b = parseKeySlot(event.keyboard);
      const same =
        a.kind === b.kind &&
        (a.kind === "unmapped" ||
          (a.kind === "alias" && b.kind === "alias" && a.text === b.text) ||
          (a.kind === "keys" &&
            b.kind === "keys" &&
            a.combos.map(comboKey).join(",") === b.combos.map(comboKey).join(",")));
      if (!same)
        result.push({
          context: context.index,
          name: event.name,
          before: old.keyboard,
          after: event.keyboard,
        });
    }
  return result;
}

/**
 * Table effective quand un `ControlMap_Custom.txt` existe : la table de base avec les touches du fichier
 * personnel par-dessus. Marche pour une copie complète (la nôtre) comme pour un fichier partiel (celui que
 * le jeu écrit) : les événements sont appariés par contexte (titre, sinon numéro) puis par nom.
 */
export function mergeCustom(base: IControlMap, custom: IControlMap): IControlMap {
  let result = base;
  for (const context of custom.contexts) {
    const target =
      base.contexts.find((c) => c.title.toLowerCase() === context.title.toLowerCase()) ??
      base.contexts[context.index];
    if (target === undefined) continue;
    for (const event of context.events) {
      const original = findEvent(base, target.index, event.name);
      if (original === undefined || original.keyboard.trim() === event.keyboard.trim()) continue;
      const slot = parseKeySlot(event.keyboard);
      if (slot.kind === "alias") continue;
      result = withKeyboard(
        result,
        target.index,
        event.name,
        slot.kind === "keys" ? slot.combos : [],
      );
    }
  }
  return result;
}
