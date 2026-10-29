/**
 * mORTEX (macOS) : touches du clavier telles que Skyrim les code (valeurs DIK de DirectInput, ce sont
 * les codes de position des touches : indépendants de la disposition AZERTY ou QWERTY), leurs noms et le
 * passage depuis `KeyboardEvent.code`. Faits publics du format de `controlmap.txt`, pas de texte repris.
 */

/** code DIK → nom anglais de la touche, comme dans `keyboard_english.txt` du jeu */
const DIK_NAMES: Record<number, string> = {
  0x01: "Esc",
  0x0b: "0",
  0x0c: "-",
  0x0d: "=",
  0x0e: "Backspace",
  0x0f: "Tab",
  0x1a: "[",
  0x1b: "]",
  0x1c: "Enter",
  0x1d: "Left Ctrl",
  0x27: ";",
  0x28: "'",
  0x29: "`",
  0x2a: "Left Shift",
  0x2b: "\\",
  0x33: ",",
  0x34: ".",
  0x35: "/",
  0x36: "Right Shift",
  0x37: "Num *",
  0x38: "Left Alt",
  0x39: "Space",
  0x3a: "Caps Lock",
  0x45: "Num Lock",
  0x46: "Scroll Lock",
  0x4a: "Num -",
  0x4e: "Num +",
  0x53: "Num .",
  0x57: "F11",
  0x58: "F12",
  0x9c: "Num Enter",
  0x9d: "Right Ctrl",
  0xb5: "Num /",
  0xb7: "Print Screen",
  0xb8: "Right Alt",
  0xc7: "Home",
  0xc8: "Up",
  0xc9: "Page Up",
  0xcb: "Left",
  0xcd: "Right",
  0xcf: "End",
  0xd0: "Down",
  0xd1: "Page Down",
  0xd2: "Insert",
  0xd3: "Delete",
  0xdb: "Left Win",
  0xdc: "Right Win",
};
"1234567890".split("").forEach((c, i) => (DIK_NAMES[0x02 + i] = c));
"QWERTYUIOP".split("").forEach((c, i) => (DIK_NAMES[0x10 + i] = c));
"ASDFGHJKL".split("").forEach((c, i) => (DIK_NAMES[0x1e + i] = c));
"ZXCVBNM".split("").forEach((c, i) => (DIK_NAMES[0x2c + i] = c));
for (let i = 0; i < 10; i++) DIK_NAMES[0x3b + i] = `F${i + 1}`;
["7", "8", "9"].forEach((c, i) => (DIK_NAMES[0x47 + i] = `Num ${c}`));
["4", "5", "6"].forEach((c, i) => (DIK_NAMES[0x4b + i] = `Num ${c}`));
["1", "2", "3", "0"].forEach((c, i) => (DIK_NAMES[0x4f + i] = `Num ${c}`));

/** noms à la Mac des touches de modification : sur un clavier Mac, ⌘ est la touche « Windows » du jeu */
const MAC_NAMES: Record<number, string> = {
  0x1d: "⌃ Control",
  0x9d: "⌃ Control (droite)",
  0x2a: "⇧ Maj",
  0x36: "⇧ Maj (droite)",
  0x38: "⌥ Option",
  0xb8: "⌥ Option (droite)",
  0xdb: "⌘ Commande",
  0xdc: "⌘ Commande (droite)",
  0x0e: "⌫ Retour arrière",
  0x1c: "↩ Entrée",
  0x0f: "⇥ Tab",
  0x3a: "⇪ Verr. maj",
  0x01: "⎋ Échap",
  0xd3: "⌦ Suppr",
  0xc8: "↑",
  0xd0: "↓",
  0xcb: "←",
  0xcd: "→",
};

export const MODIFIER_CODES: ReadonlySet<number> = new Set([
  0x1d, 0x9d, 0x2a, 0x36, 0x38, 0xb8, 0xdb, 0xdc,
]);

/** nom anglais du jeu (`Left Alt`), ou le code en hexadécimal si la touche est inconnue */
export function dikName(code: number): string {
  return DIK_NAMES[code] ?? `0x${code.toString(16)}`;
}

/** nom pour l'écran : symboles Mac pour les touches de modification, sinon le nom du jeu */
export function macKeyName(code: number): string {
  return MAC_NAMES[code] ?? dikName(code);
}

const CODE_TO_DIK: Record<string, number> = {
  Escape: 0x01,
  Minus: 0x0c,
  Equal: 0x0d,
  Backspace: 0x0e,
  Tab: 0x0f,
  BracketLeft: 0x1a,
  BracketRight: 0x1b,
  Enter: 0x1c,
  ControlLeft: 0x1d,
  Semicolon: 0x27,
  Quote: 0x28,
  Backquote: 0x29,
  ShiftLeft: 0x2a,
  Backslash: 0x2b,
  Comma: 0x33,
  Period: 0x34,
  Slash: 0x35,
  ShiftRight: 0x36,
  NumpadMultiply: 0x37,
  AltLeft: 0x38,
  Space: 0x39,
  CapsLock: 0x3a,
  NumLock: 0x45,
  ScrollLock: 0x46,
  NumpadSubtract: 0x4a,
  NumpadAdd: 0x4e,
  NumpadDecimal: 0x53,
  F11: 0x57,
  F12: 0x58,
  NumpadEnter: 0x9c,
  ControlRight: 0x9d,
  NumpadDivide: 0xb5,
  PrintScreen: 0xb7,
  AltRight: 0xb8,
  Home: 0xc7,
  ArrowUp: 0xc8,
  PageUp: 0xc9,
  ArrowLeft: 0xcb,
  ArrowRight: 0xcd,
  End: 0xcf,
  ArrowDown: 0xd0,
  PageDown: 0xd1,
  Insert: 0xd2,
  Delete: 0xd3,
  MetaLeft: 0xdb,
  MetaRight: 0xdc,
};
"1234567890".split("").forEach((c, i) => (CODE_TO_DIK[`Digit${c}`] = 0x02 + i));
"QWERTYUIOP".split("").forEach((c, i) => (CODE_TO_DIK[`Key${c}`] = 0x10 + i));
"ASDFGHJKL".split("").forEach((c, i) => (CODE_TO_DIK[`Key${c}`] = 0x1e + i));
"ZXCVBNM".split("").forEach((c, i) => (CODE_TO_DIK[`Key${c}`] = 0x2c + i));
for (let i = 0; i < 10; i++) CODE_TO_DIK[`F${i + 1}`] = 0x3b + i;
for (let i = 0; i < 3; i++) CODE_TO_DIK[`Numpad${7 + i}`] = 0x47 + i;
for (let i = 0; i < 3; i++) CODE_TO_DIK[`Numpad${4 + i}`] = 0x4b + i;
for (let i = 0; i < 3; i++) CODE_TO_DIK[`Numpad${1 + i}`] = 0x4f + i;
CODE_TO_DIK.Numpad0 = 0x52;

/** `KeyboardEvent.code` (position physique de la touche) → code DIK, undefined si la touche n'existe pas dans le jeu */
export const dikFromEventCode = (code: string): number | undefined => CODE_TO_DIK[code];
