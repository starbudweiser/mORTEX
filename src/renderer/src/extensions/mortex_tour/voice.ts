/**
 * mORTEX : voix de la visite guidée. Lit l'enregistrement de l'étape (assets/tour, produit par
 * mac/gen_tour_audio.py avec les voix Piper, pauses calées sur la ponctuation), ou, si le texte
 * a changé depuis la dernière génération, la meilleure voix système de la langue.
 *
 *  - audioName(lang, title, text)   même calcul que audio_name dans gen_tour_audio.py
 *  - TourVoice.speak / stop, enabled (mémorisé sur ce Mac)
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import getVortexPath from "../../util/getVortexPath";

const STORAGE_KEY = "mortex.tour.voice";
const SPEECH_LANG: Record<string, string> = { fr: "fr-FR", en: "en-US", es: "es-ES", it: "it-IT" };

export function audioName(lang: string, title: string, text: string): string {
  const digest = createHash("sha256").update(`${lang}|${title}. ${text}`, "utf8").digest("hex");
  return `tour-${lang}-${digest.slice(0, 16)}`;
}

export class TourVoice {
  private audio: HTMLAudioElement | undefined;

  public get enabled(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  }

  public set enabled(value: boolean) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
    } catch {
      // réglage non mémorisé : sans conséquence
    }
    if (!value) this.stop();
  }

  public speak(lang: string, title: string, text: string): void {
    this.stop();
    if (!this.enabled) return;
    const file = path.join(getVortexPath("assets"), "tour", `${audioName(lang, title, text)}.m4a`);
    if (existsSync(file)) {
      this.audio = new Audio(pathToFileURL(file).href);
      this.audio.play().catch(() => undefined);
      return;
    }
    if (typeof speechSynthesis === "undefined") return;
    const utterance = new SpeechSynthesisUtterance(`${title}. ${text}`);
    utterance.lang = SPEECH_LANG[lang] ?? "en-US";
    const voice = speechSynthesis
      .getVoices()
      .filter((candidate) => candidate.lang === utterance.lang)
      .sort((lhs, rhs) => Number(rhs.localService) - Number(lhs.localService))[0];
    if (voice !== undefined) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  }

  public stop(): void {
    this.audio?.pause();
    this.audio = undefined;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }
}
