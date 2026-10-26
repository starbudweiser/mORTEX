import { ipcRenderer } from "electron";

ipcRenderer.on("fade-out", () => {
  document.body.classList.add("leaving");
});

const url = new URL(window.location.href);
if (url.searchParams.get("disableGPU") === "1") {
  // Fenêtre opaque sans GPU : fond uni de la carte plutôt que la transparence
  document.getElementById("bg").style.backgroundColor = "#121317";
}

// Mention « non officiel » dans la langue du système : fr, en, es, it, anglais par repli.
// La fenêtre de lancement s'affiche avant i18next, d'où ce petit dictionnaire local.
const FOOTER: Record<string, string> = {
  fr: "Non officiel · basé sur Vortex",
  en: "Unofficial · based on Vortex",
  es: "No oficial · basado en Vortex",
  it: "Non ufficiale · basato su Vortex",
};
const lang = (navigator.language || "en").slice(0, 2).toLowerCase();
const footer = document.getElementById("footer");
if (footer) {
  footer.textContent = FOOTER[lang] ?? FOOTER.en;
}
