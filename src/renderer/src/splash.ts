import { ipcRenderer } from "electron";

ipcRenderer.on("fade-out", () => {
  document.body.classList.add("leaving");
});

const url = new URL(window.location.href);
if (url.searchParams.get("disableGPU") === "1") {
  // Fenêtre opaque sans GPU : fond uni de la carte plutôt que la transparence
  document.getElementById("bg").style.backgroundColor = "#121317";
}

// Textes du splash dans la langue du système : fr, en, es, it, anglais par repli.
// La fenêtre de lancement s'affiche avant i18next, d'où ce petit dictionnaire local.
const TEXTS: Record<string, { subtitle: string; footer: string }> = {
  fr: { subtitle: "GESTIONNAIRE DE MODS", footer: "Non officiel · basé sur Vortex" },
  en: { subtitle: "MODS MANAGER", footer: "Unofficial · based on Vortex" },
  es: { subtitle: "GESTOR DE MODS", footer: "No oficial · basado en Vortex" },
  it: { subtitle: "GESTORE DI MOD", footer: "Non ufficiale · basato su Vortex" },
};
const lang = (navigator.language || "en").slice(0, 2).toLowerCase();
const texts = TEXTS[lang] ?? TEXTS.en;
document.documentElement.lang = TEXTS[lang] !== undefined ? lang : "en";
const subtitle = document.getElementById("subtitle");
const footer = document.getElementById("footer");
if (subtitle) {
  subtitle.textContent = texts.subtitle;
}
if (footer) {
  footer.textContent = texts.footer;
}

// Largeur du bloc titre mesurée sans animation (le sous-titre arrive très espacé) ;
// le nom garde sa taille fixe, seul un sous-titre trop long est réduit
const fit = () => {
  const card = document.querySelector<HTMLElement>(".card");
  const text = document.querySelector<HTMLElement>(".text");
  const title = document.querySelector<HTMLElement>(".title");
  if (!card || !text || !title || !subtitle) return;
  document.body.classList.add("measure");
  const room = card.clientWidth - 48 - 108 - 22;
  let size = parseFloat(getComputedStyle(subtitle).fontSize);
  while (subtitle.scrollWidth > room && size > 8) {
    subtitle.style.fontSize = `${--size}px`;
  }
  text.style.width = `${Math.min(room, Math.max(title.scrollWidth, subtitle.scrollWidth))}px`;
  document.body.classList.remove("measure");
};
fit();
void document.fonts?.ready.then(fit);
