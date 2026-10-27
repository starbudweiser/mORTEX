#!/usr/bin/env python3
"""mORTEX : génère la voix de la visite guidée dans les 4 langues, un fichier assets/tour/tour-<langue>-<empreinte>.m4a
par étape (même méthode qu'HORIZONs et CAREERDeSK).

Le texte énoncé est celui des étapes de src/renderer/src/extensions/mortex_tour/steps.ts, traduit par
locales/<langue>/common.json. L'empreinte (SHA-256 de « langue|titre. texte », 16 caractères) est recalculée par
l'appli (voice.ts, audioName) : une étape dont le texte a changé sans régénération n'a plus de fichier et l'appli
la lit avec la voix système.
Voix neuronales locales Piper (gratuites, hors ligne) :
  python3.12 -m venv /tmp/piper && /tmp/piper/bin/pip install piper-tts
  voix (.onnx et .onnx.json) : https://huggingface.co/rhasspy/piper-voices — fr_FR-siwis-medium,
  en_US-amy-medium, es_ES-sharvard-medium, it_IT-paola-medium, rangées dans un même dossier.
Ponctuation : Piper marque les pauses de façon inégale (surtout en français). Le texte est donc découpé à chaque
signe de ponctuation, chaque morceau est synthétisé à part, débarrassé de ses silences de bord, puis suivi d'une
pause fixe selon le signe (voir PAUSES).
Usage : /tmp/piper/bin/python mac/gen_tour_audio.py /tmp/piper/voices [--force]
  --force régénère toutes les étapes (après un changement de ce script ; sinon seules les nouvelles le sont).
"""
import array
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import piper
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
STEPS = ROOT / "src/renderer/src/extensions/mortex_tour/steps.ts"
LOCALES = ROOT / "locales"
OUT = ROOT / "assets/tour"
ESPEAK = Path(tempfile.gettempdir()) / "mortex-espeak-ng-data"  # espeak-ng ignore un chemin de données trop long
VOICES = {"fr": "fr_FR-siwis-medium", "en": "en_US-amy-medium", "es": "es_ES-sharvard-medium", "it": "it_IT-paola-medium"}
# Pause après chaque signe, en secondes.
PAUSES = {".": 0.55, "!": 0.55, "?": 0.55, ":": 0.4, ";": 0.4, ",": 0.2, "(": 0.15, ")": 0.25}
CHUNK = re.compile(r"[^.!?:;,()]+[.!?:;,()]*")
# Sigles lus lettre à lettre, noms lus comme on les dit
SAY = {
    "mORTEX": "Mortex", "SKSE": "S K S E", "DXMT": "D X M T", "APFS": "A P F S", "DLL": "D L L", "INI": "I N I",
    "DDS": "D D S", "ENB": "E N B", "LOOT": "Loot", "MSync": "M Sync",
}


def steps() -> list[dict]:
    """Étapes lues dans steps.ts (Node exécute le TypeScript d'un .mts)."""
    with tempfile.TemporaryDirectory() as tmp:
        copy = Path(tmp) / "steps.mts"
        shutil.copy(STEPS, copy)
        out = subprocess.run(
            ["node", "--input-type=module", "-e", f"import {{ STEPS }} from {json.dumps(str(copy))}; console.log(JSON.stringify(STEPS));"],
            check=True, capture_output=True, text=True,
        ).stdout
    return json.loads(out)


def translated(lang: str) -> list[tuple[str, str]]:
    table = json.loads((LOCALES / lang / "common.json").read_text(encoding="utf-8"))
    return [(table.get(s["title"], s["title"]), table.get(s["text"], s["text"])) for s in steps()]


def audio_name(lang: str, title: str, text: str) -> str:
    return f"tour-{lang}-" + hashlib.sha256(f"{lang}|{title}. {text}".encode("utf-8")).hexdigest()[:16]


def spoken(title: str, text: str) -> str:
    """Texte prononcé : sigles épelés, symboles lus comme on les dit."""
    s = f"{title}. {text}"
    for word, said in SAY.items():
        s = re.sub(rf"\b{re.escape(word)}\b", said, s)
    # apostrophe typographique et espaces insécables : espeak (phonèmes) les lit mal
    s = s.replace("’", "'").replace(" ", " ").replace(" ", " ").replace("¡", "").replace("¿", "")
    s = re.sub(r"[«»“”]", "", s)
    return re.sub(r"\s+([.!?:;,)])", r"\1", s)


def chunks(text: str) -> list[tuple[str, float]]:
    """Morceaux entre deux signes de ponctuation, avec la pause qui suit chacun."""
    out = []
    for m in CHUNK.finditer(text):
        piece = m.group(0).strip()
        words = piece.strip(".!?:;,() ")
        if not words:
            continue
        marks = piece[len(piece.rstrip(".!?:;,()")):]
        pause = max((PAUSES[c] for c in marks), default=0.2)
        # le morceau se termine par un point pour une intonation nette, sauf virgule (intonation suspendue)
        end = "," if marks[:1] == "," else ("!" if "!" in marks else ".")
        out.append((words.strip() + end, pause))
    return out


def trim(samples: array.array, rate: int, threshold: int = 300) -> array.array:
    """Retire les silences de début et de fin (garde 15 ms)."""
    keep = int(rate * 0.015)
    loud = [i for i, v in enumerate(samples) if abs(v) > threshold]
    if not loud:
        return array.array("h")
    return samples[max(0, loud[0] - keep): loud[-1] + keep]


def synthesize(voice, text: str, config) -> tuple[bytes, int]:
    rate = voice.config.sample_rate
    out = array.array("h")
    for piece, pause in chunks(text):
        audio = array.array("h")
        for chunk in voice.synthesize(piece, syn_config=config):
            audio.frombytes(chunk.audio_int16_bytes)
        out.extend(trim(audio, rate))
        out.extend([0] * int(rate * pause))
    return out.tobytes(), rate


def main() -> None:
    voices_dir = Path(sys.argv[1])
    force = "--force" in sys.argv[2:]
    if not ESPEAK.exists():
        ESPEAK.symlink_to(Path(piper.__file__).parent / "espeak-ng-data")
    config = SynthesisConfig(length_scale=1.05, noise_scale=0.6, noise_w_scale=0.8)
    OUT.mkdir(parents=True, exist_ok=True)
    texts = {lang: translated(lang) for lang in VOICES}
    wanted = {audio_name(lang, *s) + ".m4a" for lang in VOICES for s in texts[lang]}
    for old in OUT.glob("*.m4a"):
        if old.name not in wanted:
            old.unlink()
    for lang, model in VOICES.items():
        voice = None
        for title, text in texts[lang]:
            target = OUT / (audio_name(lang, title, text) + ".m4a")
            if target.exists() and not force:
                continue
            voice = voice or PiperVoice.load(str(voices_dir / f"{model}.onnx"), espeak_data_dir=ESPEAK)
            with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
                pcm, rate = synthesize(voice, spoken(title, text), config)
                with wave.open(tmp.name, "wb") as wav:
                    wav.setnchannels(1)
                    wav.setsampwidth(2)
                    wav.setframerate(rate)
                    wav.writeframes(pcm)
                target.unlink(missing_ok=True)
                subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", tmp.name, str(target)], check=True)
            print(f"{target.name}  {title}")
    print(f"{len(wanted)} fichiers dans {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
