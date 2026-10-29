/**
 * mORTEX : le nom des collections installées ressort dans tous les textes, en bleu Socle. Comme le
 * « m » de mORTEX (util/brandHighlight), c'est la CSS Custom Highlight API : aucune modification
 * du DOM. Sur un fond déjà coloré (notifications, bulles d'aide), le bleu serait illisible : le nom
 * y est souligné à la place. Styles : ::highlight(mortex-collection[-on-color]) dans
 * stylesheets/ui/themes/mortex.css.
 *
 *  - matchOffsets(text, name): [start, end][]   chaque occurrence, même coupée par les espaces
 *    invisibles que les notifications insèrent pour mieux passer à la ligne
 *  - collectionRanges(root, names): { plain, onColor }
 *  - startCollectionHighlight(getNames): () => void   suit la page (au plus 4 fois par seconde)
 */
const HIGHLIGHT = "mortex-collection";
const HIGHLIGHT_ON_COLOR = "mortex-collection-on-color";
const REFRESH_MS = 250;
/** un nom plus court se retrouverait au milieu d'autres mots */
const MIN_LENGTH = 3;
const ZERO_WIDTH = new Set(["\u200b", "\u200c", "\u200d", "\u2060"]);
/** éléments dont le fond est déjà de couleur */
const ON_COLOR = ".notification, .nxm-tooltip, .tooltip, .btn-primary, .mortex-apply-wrap";

export function matchOffsets(text: string, name: string): Array<[number, number]> {
  // texte sans espaces invisibles, et pour chaque caractère gardé sa place d'origine
  const kept: number[] = [];
  let stripped = "";
  for (let idx = 0; idx < text.length; ++idx) {
    if (!ZERO_WIDTH.has(text[idx])) {
      kept.push(idx);
      stripped += text[idx];
    }
  }
  const result: Array<[number, number]> = [];
  for (
    let pos = stripped.indexOf(name);
    pos !== -1;
    pos = stripped.indexOf(name, pos + name.length)
  ) {
    result.push([kept[pos], kept[pos + name.length - 1] + 1]);
  }
  return result;
}

export function collectionRanges(
  root: Node,
  names: string[],
): { plain: Range[]; onColor: Range[] } {
  const plain: Range[] = [];
  const onColor: Range[] = [];
  const usable = names.filter((name) => name.length >= MIN_LENGTH);
  if (usable.length === 0) return { plain, onColor };

  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.nodeValue ?? "";
    if (text.length < MIN_LENGTH) continue;
    const target = node.parentElement?.closest(ON_COLOR) ? onColor : plain;
    for (const name of usable) {
      for (const [start, end] of matchOffsets(text, name)) {
        const range = doc.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        target.push(range);
      }
    }
  }
  return { plain, onColor };
}

export function startCollectionHighlight(getNames: () => string[]): () => void {
  if (typeof CSS === "undefined" || !("highlights" in CSS) || typeof Highlight === "undefined") {
    return () => undefined;
  }
  const plain = new Highlight();
  const onColor = new Highlight();
  CSS.highlights.set(HIGHLIGHT, plain);
  CSS.highlights.set(HIGHLIGHT_ON_COLOR, onColor);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    timer = undefined;
    plain.clear();
    onColor.clear();
    const ranges = collectionRanges(document.body, getNames());
    for (const range of ranges.plain) plain.add(range);
    for (const range of ranges.onColor) onColor.add(range);
  };
  const schedule = () => {
    if (timer === undefined) timer = setTimeout(refresh, REFRESH_MS);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  refresh();

  return () => {
    observer.disconnect();
    clearTimeout(timer);
    CSS.highlights.delete(HIGHLIGHT);
    CSS.highlights.delete(HIGHLIGHT_ON_COLOR);
  };
}
