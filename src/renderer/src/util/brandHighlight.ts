/**
 * mORTEX : le « m » du nom de l'appli s'affiche en orange Vortex partout où « mORTEX » est écrit
 * (textes traduits, notifications, fenêtres…). La CSS Custom Highlight API colore une plage du
 * texte sans modifier le DOM : React garde ses nœuds intacts. Style : ::highlight(mortex-m) dans
 * stylesheets/ui/themes/mortex.css.
 *
 *  - brandRanges(root): Range[]       une plage sur chaque « m » de « mORTEX »
 *  - startBrandHighlight(): () => void   suit les changements de la page (au plus 4 fois par seconde)
 */
const NAME = "mORTEX";
const HIGHLIGHT = "mortex-m";
const REFRESH_MS = 250;

export function brandRanges(root: Node): Range[] {
  const ranges: Range[] = [];
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.nodeValue?.includes(NAME) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  });
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.nodeValue ?? "";
    for (let idx = text.indexOf(NAME); idx !== -1; idx = text.indexOf(NAME, idx + NAME.length)) {
      const range = root.ownerDocument!.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + 1);
      ranges.push(range);
    }
  }
  return ranges;
}

export function startBrandHighlight(): () => void {
  if (typeof CSS === "undefined" || !("highlights" in CSS) || typeof Highlight === "undefined") {
    return () => undefined;
  }
  const highlight = new Highlight();
  CSS.highlights.set(HIGHLIGHT, highlight);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    timer = undefined;
    highlight.clear();
    for (const range of brandRanges(document.body)) highlight.add(range);
  };
  const observer = new MutationObserver(() => {
    if (timer === undefined) timer = setTimeout(refresh, REFRESH_MS);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  refresh();

  return () => {
    observer.disconnect();
    clearTimeout(timer);
    CSS.highlights.delete(HIGHLIGHT);
  };
}
