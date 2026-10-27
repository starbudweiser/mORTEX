/**
 * mORTEX : visite guidée. Voile percé sur l'élément commenté, bulle d'explication au style Socle
 * (fond bleu, texte foncé, coins arrondis) dont la pointe dépasse du bord vers l'élément ; elle
 * apparaît et disparaît en rebond rapide. Chaque étape est lue à voix haute (voice.ts).
 * Clavier : → ou Entrée suivant, ← précédent, Échap pour quitter.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Icon } from "@/ui/components/icon/Icon";

import { type IBubblePlacement, type IRect, placeBubble } from "./placement";
import { type ITourStep, STEPS } from "./steps";
import { TourVoice } from "./voice";

export const START_EVENT = "mortex-start-tour";

const steps: ITourStep[] = STEPS;
const BUBBLE_WIDTH = 380;
const OUT_MS = 200;
const LANGUAGES = ["fr", "en", "es", "it"];

function rectOf(selector?: string): IRect | undefined {
  if (selector === undefined) return undefined;
  const element = document.querySelector(selector);
  if (element === null) return undefined;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    : undefined;
}

export default function TourOverlay({ api }: { api: IExtensionApi }) {
  const t = useCallback(
    (text: string, options?: Record<string, unknown>) =>
      api.translate(text, { ns: "common", ...options }),
    [api],
  );
  const voice = useMemo(() => new TourVoice(), []);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [voiceOn, setVoiceOn] = useState(voice.enabled);
  const [target, setTarget] = useState<IRect | undefined>(undefined);
  const [placement, setPlacement] = useState<IBubblePlacement | undefined>(undefined);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const step = steps[index];

  const language = () => {
    const lang = (api.getState().settings.interface.language ?? "en").slice(0, 2);
    return LANGUAGES.includes(lang) ? lang : "en";
  };

  useEffect(() => {
    const start = () => {
      setIndex(0);
      setPhase("in");
      setOpen(true);
    };
    api.events.on(START_EVENT, start);
    return () => {
      api.events.removeListener(START_EVENT, start);
    };
  }, [api]);

  // à chaque étape : page à montrer, voix, puis position de l'élément une fois la page affichée
  useEffect(() => {
    if (!open) return;
    if (step.page !== undefined) api.events.emit("show-main-page", step.page);
    voice.speak(language(), t(step.title), t(step.text));
    const measure = () => setTarget(rectOf(step.anchor));
    measure();
    const timer = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [open, index]);

  useLayoutEffect(() => {
    if (!open || bubbleRef.current === null) return;
    const { offsetWidth, offsetHeight } = bubbleRef.current;
    setPlacement(
      placeBubble(
        target,
        { width: offsetWidth, height: offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [open, index, target]);

  const close = () => {
    voice.stop();
    setPhase("out");
    setTimeout(() => setOpen(false), OUT_MS);
  };

  // rebond de sortie, puis l'étape suivante entre en rebond
  const goTo = (next: number) => {
    if (next < 0) return;
    if (next >= steps.length) {
      close();
      return;
    }
    setPhase("out");
    setTimeout(() => {
      setIndex(next);
      setPlacement(undefined);
      setPhase("in");
    }, OUT_MS);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight" || event.key === "Enter") goTo(index + 1);
      else if (event.key === "ArrowLeft") goTo(index - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, index]);

  useEffect(() => () => voice.stop(), [voice]);

  if (!open) return null;

  const toggleVoice = () => {
    voice.enabled = !voiceOn;
    setVoiceOn(!voiceOn);
    if (!voiceOn) voice.speak(language(), t(step.title), t(step.text));
  };

  const last = index === steps.length - 1;
  const hole: React.CSSProperties | undefined = target && {
    left: target.left - 6,
    top: target.top - 6,
    width: target.width + 12,
    height: target.height + 12,
  };
  const side = placement?.side ?? "center";
  const arrowStyle: React.CSSProperties =
    side === "right" || side === "left" ? { top: placement?.arrow } : { left: placement?.arrow };

  return (
    <div
      className="mortex-tour"
      role="dialog"
      aria-modal="true"
      aria-label={t("mORTEX guided tour")}
    >
      {target !== undefined ? (
        <>
          <div className="mortex-tour-spot" style={hole} />
          <div className="mortex-tour-ring" style={hole} />
        </>
      ) : (
        <div className="mortex-tour-scrim" />
      )}

      <div
        className={`mortex-tour-bubble mortex-tour-${side} mortex-tour-${phase}`}
        key={`${index}-${phase}`}
        ref={bubbleRef}
        style={{
          width: BUBBLE_WIDTH,
          left: placement?.left ?? -9999,
          top: placement?.top ?? -9999,
          transformOrigin:
            side === "right"
              ? `0 ${placement?.arrow}px`
              : side === "left"
                ? `100% ${placement?.arrow}px`
                : side === "bottom"
                  ? `${placement?.arrow}px 0`
                  : side === "top"
                    ? `${placement?.arrow}px 100%`
                    : "50% 50%",
        }}
      >
        {side !== "center" && <span className="mortex-tour-arrow" style={arrowStyle} />}

        <div className="mortex-tour-head">
          <span className="mortex-tour-icon">i</span>
          <span className="mortex-tour-title">{t(step.title)}</span>
          {step.exclusive === true && (
            <span className="mortex-tour-badge">{t("Mac exclusive")}</span>
          )}
        </div>
        <p className="mortex-tour-text">{t(step.text)}</p>

        <div className="mortex-tour-foot">
          <button
            className="mortex-tour-voice"
            title={voiceOn ? t("Voice on") : t("Voice off")}
            onClick={toggleVoice}
          >
            <Icon name={voiceOn ? "volume_up" : "volume_off"} size="sm" />
          </button>
          <span className="mortex-tour-count">
            {t("{{n}} of {{count}}", { replace: { n: index + 1, count: steps.length } })}
          </span>
          {!last && (
            <button className="mortex-tour-link" onClick={close}>
              {t("Skip the tour")}
            </button>
          )}
          {index > 0 && (
            <button className="mortex-tour-button" onClick={() => goTo(index - 1)}>
              {t("Previous")}
            </button>
          )}
          <button
            className="mortex-tour-button mortex-tour-primary"
            onClick={() => goTo(index + 1)}
          >
            {last ? t("Finish") : t("Next")}
          </button>
        </div>
      </div>
    </div>
  );
}
