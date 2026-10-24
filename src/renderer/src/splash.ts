import { ipcRenderer } from "electron";

ipcRenderer.on("fade-out", () => {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.style.transition = "opacity 500ms ease-in-out";
    splash.style.opacity = "0";
  }
});

const url = new URL(window.location.href);
if (url.searchParams.get("disableGPU") === "1") {
  document.getElementById("bg").style.backgroundColor = "#d78f46";
}

// Variante localisée (mention « non officiel ») : fr par défaut (splash.png), sinon en/es/it, anglais par repli.
const lang = (navigator.language || "en").slice(0, 2).toLowerCase();
const variant =
  lang === "fr" ? "splash" : ["es", "it"].includes(lang) ? `splash_${lang}` : "splash_en";
const img = document.getElementById("splash") as HTMLImageElement | null;
if (img) {
  img.src = `assets/images/${variant}.png`;
}
