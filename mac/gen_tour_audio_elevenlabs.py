#!/usr/bin/env python3
"""mORTEX : voix ElevenLabs de la visite guidée (français et anglais), un fichier assets/tour/tour-<langue>-<empreinte>.m4a
par étape, au même nom que ceux de Piper (mac/gen_tour_audio.py, qui garde l'espagnol et l'italien).

Les textes, les sigles épelés et l'empreinte viennent de gen_tour_audio.py : une étape dont le texte a changé n'a plus de
fichier, ce script la régénère. Coût mesuré : 0,4 crédit par caractère avec eleven_multilingual_v2 (environ 1 650 crédits pour
tout). Le son brut est gardé dans ~/.cache/mortex/tour-voice : retoucher le traitement audio (MASTER) ne recoûte aucun crédit.
Clé : variable d'environnement ELEVENLABS_API_KEY, ou ligne ELEVENLABS_API_KEY=… du fichier .env à la racine (ignoré par git).
Python 3 standard et ffmpeg (traitement du son).
Usage :
  python3 mac/gen_tour_audio_elevenlabs.py --list-voices fr        voix proposées pour une langue
  python3 mac/gen_tour_audio_elevenlabs.py --quota                 crédits restants
  python3 mac/gen_tour_audio_elevenlabs.py --voice fr=ID --voice en=ID [--only fr] [--step N] [--force]
  --step N : seulement l'étape N (1 à 13), pour essayer une voix ; --force refait aussi les fichiers existants.
Les voix choisies sont rappelées dans mac/tour_voices.json (identifiants seulement), relu aux lancements suivants.
"""
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_tour_audio as base  # noqa: E402

API = "https://api.elevenlabs.io/v1"
MODEL = "eleven_multilingual_v2"
OUTPUT = "mp3_44100_128"
# Ton « jeune gamer » : plus de variation et d'expressivité qu'une voix de narrateur posé. Le français monte encore l'expressivité
# (intonation) et ralentit un peu : la voix retenue parle vite, la diction y gagne.
SETTINGS = {
    "fr": {"stability": 0.3, "similarity_boost": 0.8, "style": 0.6, "speed": 1.0, "use_speaker_boost": True},
    "en": {"stability": 0.4, "similarity_boost": 0.8, "style": 0.5, "speed": 1.05, "use_speaker_boost": True},
}
RAW = Path.home() / ".cache/mortex/tour-voice"
# Traitement du son. Les « p » et « b » arrivent en coups de graves de -2 dB sur une voix à -15 LUFS : les graves sous 180 Hz sont
# compressés à part, très vite (le timbre du reste de la voix n'est pas touché), le bas inutile est coupé. Puis un peu moins de
# bouche (280 Hz), un peu plus de netteté (3,5 kHz), sifflantes calmées, crêtes limitées à -3 dB.
MASTER = (
    "acrossover=split=180:order=4th[lo][hi];"
    "[lo]highpass=f=70:poles=2,acompressor=threshold=-16dB:ratio=4:attack=0.3:release=50:knee=3[low];"
    "[low][hi]amix=inputs=2:normalize=0,"
    "equalizer=f=280:t=q:w=1:g=-1.5,equalizer=f=3500:t=q:w=1.2:g=2,deesser=i=0.3,"
    f"{base.LIMIT}"
)
VOICES_FILE = Path(__file__).resolve().parent / "tour_voices.json"


def api_key() -> str | None:
    """Variable d'environnement, sinon ligne ELEVENLABS_API_KEY=… de .env (racine du dépôt, ignoré par git) ou de
    ~/.config/elevenlabs/.env (clé commune à tous les développements)."""
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"]
    for env in (base.ROOT / ".env", Path.home() / ".config/elevenlabs/.env"):
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                name, _, value = line.partition("=")
                if name.strip() == "ELEVENLABS_API_KEY" and value.strip():
                    return value.strip().strip("\"'")
    return None


def call(path: str, body: dict | None = None) -> bytes:
    key = api_key()
    if not key:
        sys.exit("ELEVENLABS_API_KEY absente (environnement ou fichier .env à la racine du dépôt).")
    request = urllib.request.Request(
        API + path,
        data=None if body is None else json.dumps(body).encode("utf-8"),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "*/*"},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.read()
    except urllib.error.HTTPError as err:
        sys.exit(f"ElevenLabs {err.code} : {err.read().decode('utf-8', 'replace')[:300]}")


def quota() -> tuple[int, int]:
    info = json.loads(call("/user/subscription"))
    return info["character_count"], info["character_limit"]


def list_voices(lang: str) -> None:
    voices = json.loads(call("/voices"))["voices"]
    for v in voices:
        labels = v.get("labels", {})
        verified = [x.get("language") for x in v.get("verified_languages") or []]
        if lang in verified or labels.get("language") == lang or not verified and lang in (v.get("description") or ""):
            print(f"{v['voice_id']}  {v['name']:<14} {v.get('category', '')}  {labels.get('gender', '')} {labels.get('age', '')}"
                  f" {labels.get('use_case', '')} {labels.get('accent', '')}")
    print("(toutes les voix du compte : sans filtre de langue avec --list-voices all)" if lang != "all" else "")


def raw_path(voice_id: str, lang: str, text: str) -> Path:
    """Son brut d'ElevenLabs, nommé d'après tout ce qui le détermine."""
    key = json.dumps([MODEL, OUTPUT, voice_id, SETTINGS[lang], text], sort_keys=True)
    return RAW / (hashlib.sha256(key.encode("utf-8")).hexdigest()[:24] + ".mp3")


def speak(voice_id: str, lang: str, text: str, target: Path) -> None:
    raw = raw_path(voice_id, lang, text)
    if not raw.exists():
        RAW.mkdir(parents=True, exist_ok=True)
        raw.write_bytes(call(f"/text-to-speech/{voice_id}?output_format={OUTPUT}",
                             {"text": text, "model_id": MODEL, "voice_settings": SETTINGS[lang]}))
    base.finish(raw, target, MASTER)


def main() -> None:
    args = sys.argv[1:]
    if "--quota" in args:
        used, limit = quota()
        print(f"{limit - used} crédits restants sur {limit}")
        return
    if "--list-voices" in args:
        list_voices(args[args.index("--list-voices") + 1])
        return
    voices = json.loads(VOICES_FILE.read_text()) if VOICES_FILE.exists() else {}
    for i, a in enumerate(args):
        if a == "--voice":
            lang, _, voice_id = args[i + 1].partition("=")
            voices[lang] = voice_id
    VOICES_FILE.write_text(json.dumps(voices, indent=2) + "\n")
    only = args[args.index("--only") + 1] if "--only" in args else None
    step = int(args[args.index("--step") + 1]) if "--step" in args else None
    force = "--force" in args

    jobs = []
    for lang in sorted(base.ELEVENLABS):
        if only and lang != only:
            continue
        if lang not in voices:
            sys.exit(f"Pas de voix pour « {lang} » : --voice {lang}=ID")
        for n, (title, text) in enumerate(base.translated(lang), start=1):
            target = base.OUT / (base.audio_name(lang, title, text) + ".m4a")
            if (step and n != step) or (target.exists() and not force):
                continue
            jobs.append((lang, n, title, base.spoken(title, text), target))
    needed = sum(len(j[3]) for j in jobs if not raw_path(voices[j[0]], j[0], j[3]).exists())
    used, limit = quota()
    print(f"{len(jobs)} fichiers, {needed} caractères à générer ; {limit - used} crédits restants")
    if needed > limit - used:
        sys.exit("Crédits insuffisants.")
    for lang, n, title, spoken, target in jobs:
        speak(voices[lang], lang, spoken, target)
        print(f"{target.name}  {lang} {n} {title}")


if __name__ == "__main__":
    main()
