"""La voix et le son du Studio 3D et du studio des créatrices.

Lit une commande JSON sur l'entrée standard :
  { "langue": "en-us", "voix": "af_heart", "vitesse": 1.0, "segments": ["...", "..."],
    "sortie": "/dossier", "modele": "kokoro-v1.0.onnx", "voix_fichier": "voices-v1.0.bin",
    "debut": 0.25, "ecart": 0.3, "fin": 0.9, "musique": true, "ambiance": "calme", "graine": 7,
    "moteur": "kokoro", "piper": "de_DE-thorsten-medium", "piper_dir": "/dossier/des/voix" }
  ambiance : calme (par défaut), energie, mystere ou aucune
  moteur : kokoro (par défaut) ou piper (la voix « piper », téléchargée dans piper_dir si elle n'y est pas)
Écrit dans le dossier de sortie :
  voix.wav    la voix seule, chaque segment posé à sa place sur la ligne de temps
  son.wav     la voix, la musique d'ambiance et les bruitages, mixés
  temps.json  { "duree": s, "segments": [ { "debut", "fin", "mots": [ { "m", "t0", "t1", "o" } ] } ] }
              (o : la position du mot dans la phrase, en caractères ; pour le chinois et le japonais, écrits sans espaces)

Les voix, gratuites et sur le processeur :
  Kokoro (82M, licence Apache 2.0) : anglais, français, espagnol, portugais, italien, hindi ; chinois et japonais avec
  la transcription de misaki (pinyin, kana), celle sur laquelle les voix de Kokoro ont appris
  Piper (licence MIT, voix de rhasspy/piper-voices) : une vingtaine d'autres langues
La musique et les bruitages sont fabriqués ici (aucun son emprunté).
"""
import json
import re
import sys
import os

import numpy as np
import soundfile as sf

SR = 24000


def lire():
    return json.loads(sys.stdin.read())


def rogner(x, seuil=0.006):
    """Retire les silences du début et de la fin d'un segment (le rythme reste serré)."""
    a = np.abs(x)
    idx = np.where(a > seuil)[0]
    if len(idx) == 0:
        return x
    d = max(0, idx[0] - int(0.02 * SR))
    f = min(len(x), idx[-1] + int(0.06 * SR))
    return x[d:f]


def poids(mot):
    """Le temps que prend un mot à dire : ses lettres, plus une pause s'il finit une phrase ou une proposition."""
    lettres = len(re.sub(r"[^\w]", "", mot, flags=re.UNICODE)) or 1
    pause = 0
    if re.search(r"[.!?…]$", mot):
        pause = 6
    elif re.search(r"[,;:]$", mot):
        pause = 3.5
    return 1.6 + lettres, pause


CJK = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
PONCT_CJK = "。！？…，、；：,.!?;:）)」』】》〉”’"


def poids_cjk(mot):
    """Chinois et japonais : un caractère, une syllabe (environ) ; les lettres latines comptent moins."""
    n = len(CJK.findall(mot))
    latin = len(re.sub(r"[^\w]", "", CJK.sub("", mot), flags=re.UNICODE))
    pause = 0
    if re.search(r"[。！？!?…]$", mot):
        pause = 3.2
    elif re.search(r"[，、；：,;:]$", mot):
        pause = 1.8
    return 0.4 + n + latin / 3.0, pause


def jetons(texte, langue):
    """Les mots d'une phrase écrite sans espaces, avec leur position (en caractères), pour les sous-titres mot à mot.
    Chinois : jieba ; japonais : fugashi. Les petits mots qui s'appuient sur le précédent (particules, auxiliaires,
    suffixes, ponctuation) lui restent collés : 知ってた？ / タコには / 心臓が, 知道吗？ / 蓝色的。
    Les autres langues : None (les espaces suffisent)."""
    if langue in ("cmn", "zh"):
        import jieba
        import jieba.posseg as pseg
        jieba.setLogLevel(60)
        brut = [(w.word, w.flag in ("y", "uj", "ul", "uz", "ug", "uv", "ud", "u", "e") or w.flag == "x") for w in pseg.cut(texte)]
    elif langue == "ja":
        from fugashi import Tagger
        brut = []
        avant = ""
        for w in Tagger()(texte):
            p = w.feature.pos1 or ""
            collant = p in ("助詞", "助動詞", "接尾辞", "補助記号") or (p == "名詞" and w.feature.pos2 == "数詞" and avant == "数詞")
            avant = w.feature.pos2 if p == "名詞" else ""
            brut.append((w.surface, collant))
    else:
        return None
    out = []
    pos = 0
    for w, collant in brut:
        w = w.strip()
        if not w:
            continue
        i = texte.find(w, pos)
        if i < 0:
            continue
        pos = i + len(w)
        if out and (collant or all(c in PONCT_CJK for c in w)) and i == out[-1]["o"] + len(out[-1]["m"]):
            out[-1]["m"] += w
            continue
        out.append({"m": w, "o": i})
    return out


def mots_chronometres(texte, debut, duree, langue=""):
    js = jetons(texte, langue)
    if js is None:
        mots, pos = [], 0
        for m in re.split(r"\s+", texte.strip()):
            if not m:
                continue
            i = texte.find(m, pos)
            pos = i + len(m)
            mots.append({"m": m, "o": i})
        ps = [poids(x["m"]) for x in mots]
    else:
        mots = js
        ps = [poids_cjk(x["m"]) for x in mots]
    if not mots:
        return []
    total = sum(p + q for p, q in ps) - ps[-1][1]
    t = debut
    out = []
    for i, (x, (p, q)) in enumerate(zip(mots, ps)):
        d = duree * p / total
        out.append({"m": x["m"], "t0": round(t, 3), "t1": round(t + d, 3), "o": x["o"]})
        t += d + (duree * q / total if i < len(mots) - 1 else 0)
    return out


def reechantillonner(x, de, vers):
    """D'une fréquence à l'autre (la voix Piper parle souvent à 22 050 Hz, le reste du son est à 24 000 Hz)."""
    if de == vers or len(x) == 0:
        return x.astype(np.float32)
    n = int(round(len(x) * vers / de))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def moteur_kokoro(c):
    """Kokoro : le texte directement, ou pour le chinois et le japonais la transcription de misaki."""
    from kokoro_onnx import Kokoro
    k = Kokoro(c.get("modele", "kokoro-v1.0.onnx"), c.get("voix_fichier", "voices-v1.0.bin"))
    langue = c.get("langue", "en-us")
    voix = c.get("voix", "af_heart")
    g2p = None
    if langue in ("cmn", "zh"):
        from misaki import zh
        g2p = zh.ZHG2P()
    elif langue == "ja":
        from misaki import ja
        g2p = ja.JAG2P()

    def dire(texte, vitesse):
        if g2p is not None:
            r = g2p(texte)
            ph = r[0] if isinstance(r, tuple) else r
            s, sr = k.create(ph, voice=voix, speed=vitesse, is_phonemes=True)
        else:
            s, sr = k.create(texte, voice=voix, speed=vitesse, lang=langue)
        return reechantillonner(np.asarray(s, dtype=np.float32), sr, SR)
    return dire


def moteur_piper(c):
    """Piper : une voix par langue, téléchargée une fois (environ 60 Mo) dans piper_dir."""
    from pathlib import Path
    from piper import PiperVoice, SynthesisConfig
    nom = str(c["piper"])
    if not re.match(r"^[a-z]{2,3}_[A-Z]{2}-[a-z0-9_]+-(x_low|low|medium|high)$", nom):
        raise SystemExit("voix Piper inattendue : %s" % nom)
    dossier = Path(c.get("piper_dir") or "piper")
    dossier.mkdir(parents=True, exist_ok=True)
    modele = dossier / (nom + ".onnx")
    if not modele.exists() or modele.stat().st_size < 1_000_000 or not (dossier / (nom + ".onnx.json")).exists():
        from piper.download_voices import download_voice
        download_voice(nom, dossier)
    v = PiperVoice.load(str(modele))
    base = float(v.config.length_scale or 1.0)

    def dire(texte, vitesse):
        cfg = SynthesisConfig(length_scale=base / max(0.5, vitesse))
        morceaux = [ch.audio_int16_array for ch in v.synthesize(texte, syn_config=cfg)]
        if not morceaux:
            return np.zeros(int(0.3 * SR), dtype=np.float32)
        x = np.concatenate(morceaux).astype(np.float32) / 32768.0
        return reechantillonner(x, int(v.config.sample_rate), SR)
    return dire


def enveloppe(n, attaque, relache):
    e = np.ones(n, dtype=np.float32)
    a = min(n, int(attaque * SR))
    r = min(n, int(relache * SR))
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[-r:] = np.minimum(e[-r:], np.linspace(1, 0, r))
    return e


def batterie(n, tempo, graine):
    """Une pulsation légère (grosse caisse sur les temps, charleston sur les contretemps), pour l'ambiance « énergie »."""
    rng = np.random.default_rng(graine + 11)
    out = np.zeros(n, dtype=np.float32)
    temps = 60.0 / tempo
    nk = int(0.22 * SR)
    tk = np.arange(nk) / SR
    kick = (np.sin(2 * np.pi * (45 + 75 * np.exp(-tk * 28)) * tk) * np.exp(-tk * 11)).astype(np.float32)
    nh = int(0.05 * SR)
    hat = rng.standard_normal(nh).astype(np.float32)
    hat = np.diff(np.concatenate([[0.0], hat])).astype(np.float32) * np.exp(-np.arange(nh) / SR * 70).astype(np.float32)
    k = 0
    while True:
        i = int(k * temps * SR)
        if i >= n:
            break
        out[i:i + nk] += kick[: max(0, n - i)] * 0.9
        j = int((k + 0.5) * temps * SR)
        if j < n:
            out[j:j + nh] += hat[: max(0, n - j)] * 0.35
        k += 1
    return out


def musique(n, graine, ambiance="calme"):
    """La musique d'ambiance, très en dessous de la voix. calme : une nappe douce en accords qui changent toutes les
    4 secondes environ ; energie : la même nappe plus claire, avec une pulsation ; mystere : des accords mineurs graves
    qui respirent lentement."""
    rng = np.random.default_rng(graine)
    duree = n / SR
    t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float32)
    # quatre accords (en Hz), choisis au hasard parmi des progressions calmes
    progressions = [
        [[220.0, 261.63, 329.63, 392.0], [174.61, 220.0, 261.63, 329.63], [196.0, 246.94, 293.66, 392.0], [164.81, 207.65, 246.94, 329.63]],
        [[146.83, 220.0, 261.63, 349.23], [130.81, 196.0, 246.94, 329.63], [174.61, 220.0, 261.63, 329.63], [164.81, 196.0, 246.94, 293.66]],
        [[196.0, 233.08, 293.66, 349.23], [155.56, 196.0, 233.08, 311.13], [174.61, 220.0, 261.63, 349.23], [146.83, 185.0, 220.0, 293.66]],
    ]
    accords = progressions[int(rng.integers(len(progressions)))]
    if ambiance == "mystere":
        accords = [[110.0, 130.81, 164.81, 220.0], [98.0, 116.54, 146.83, 196.0], [103.83, 123.47, 155.56, 207.65], [92.5, 110.0, 138.59, 185.0]]
    elif ambiance == "energie":
        accords = [[f * 1.5 for f in a] for a in accords]
    duree_accord = 4.2 if ambiance != "energie" else 2.2
    for k in range(int(np.ceil(duree / duree_accord))):
        d0 = int(k * duree_accord * SR)
        d1 = min(n, int((k + 1) * duree_accord * SR) + int(0.8 * SR))
        if d0 >= n:
            break
        tt = t[d0:d1] - t[d0]
        seg = np.zeros(d1 - d0, dtype=np.float32)
        for f in accords[k % len(accords)]:
            for detune in (-0.6, 0.6):
                ff = f * (1 + detune / 1000)
                seg += (np.sin(2 * np.pi * ff * tt) + 0.25 * np.sin(2 * np.pi * 2 * ff * tt)).astype(np.float32)
        seg *= enveloppe(len(seg), 1.2, 1.4)
        out[d0:d1] += seg
    # basse lente et respiration
    out += 0.35 * np.sin(2 * np.pi * 55 * t).astype(np.float32) * (0.6 + 0.4 * np.sin(2 * np.pi * t / 8)).astype(np.float32)
    if ambiance == "mystere":
        out *= (0.75 + 0.25 * np.sin(2 * np.pi * t / 3.1)).astype(np.float32)
    out /= max(1e-6, np.max(np.abs(out)))
    if ambiance == "energie":
        b = batterie(n, 112, graine)
        out = out * 0.75 + b / max(1e-6, np.max(np.abs(b))) * 0.7
        out /= max(1e-6, np.max(np.abs(out)))
        return out * 0.075
    return out * 0.055


def souffle(longueur=0.55, graine=0):
    """Un « whoosh » : du bruit filtré qui monte et redescend, au changement de plan."""
    rng = np.random.default_rng(graine)
    n = int(longueur * SR)
    b = rng.standard_normal(n).astype(np.float32)
    # filtre passe-bas à une pôle dont la fréquence balaye
    out = np.zeros(n, dtype=np.float32)
    y = 0.0
    for i in range(n):
        k = i / n
        alpha = 0.02 + 0.18 * np.sin(np.pi * k)
        y = y + alpha * (b[i] - y)
        out[i] = y
    out *= np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return out / max(1e-6, np.max(np.abs(out))) * 0.11


def pop(graine=0):
    """Un petit « tic » doux quand une étiquette apparaît."""
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    f = 880 * (1 + 0.5 * np.exp(-t * 60))
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 45)).astype(np.float32) * 0.07


def main():
    c = lire()
    sortie = c.get("sortie", ".")
    os.makedirs(sortie, exist_ok=True)
    dire = moteur_piper(c) if c.get("moteur") == "piper" else moteur_kokoro(c)
    langue = "" if c.get("moteur") == "piper" else c.get("langue", "")
    if c.get("cjk"):
        langue = c.get("cjk")
    debut, ecart, fin = float(c.get("debut", 0.25)), float(c.get("ecart", 0.3)), float(c.get("fin", 0.9))
    duree_min = float(c.get("duree_min", 0) or 0)
    vitesse = float(c.get("vitesse", 1.0))

    def synthese(v):
        out = []
        for texte in c["segments"]:
            texte = (texte or "").strip()
            if not texte:
                out.append(np.zeros(int(0.6 * SR), dtype=np.float32))
                continue
            out.append(rogner(dire(texte, v)))
        return out

    morceaux = synthese(vitesse)
    nb = max(1, len(morceaux) - 1)
    parole = sum(len(m) for m in morceaux) / SR
    # TikTok ne paie que les vidéos de plus d'une minute : on respire d'abord un peu plus entre les phrases,
    # puis, s'il le faut encore, la voix ralentit un peu (jamais sous 85 % de sa vitesse)
    if duree_min and debut + parole + nb * ecart + fin < duree_min:
        ecart = min(0.72, (duree_min - debut - parole - fin) / nb)
        if debut + parole + nb * ecart + fin < duree_min:
            manque = duree_min - (debut + nb * ecart + fin)
            v2 = max(vitesse * 0.85, vitesse * parole / max(1.0, manque))
            morceaux = synthese(v2)
            parole = sum(len(m) for m in morceaux) / SR
            ecart = max(ecart, min(0.85, (duree_min - debut - parole - fin) / nb))
    t = debut
    segments = []
    for texte, m in zip(c["segments"], morceaux):
        d = len(m) / SR
        segments.append({"debut": round(t, 3), "fin": round(t + d, 3), "mots": mots_chronometres((texte or "").strip(), t, d, langue)})
        t += d + ecart
    duree = round(t - ecart + fin, 3)
    n = int(duree * SR) + 1
    voix = np.zeros(n, dtype=np.float32)
    for s, m in zip(segments, morceaux):
        i = int(s["debut"] * SR)
        voix[i:i + len(m)] += m[: max(0, n - i)]
    pic = np.max(np.abs(voix)) or 1
    voix = voix / pic * 0.89
    sf.write(os.path.join(sortie, "voix.wav"), voix, SR)
    son = voix.copy()
    ambiance = str(c.get("ambiance", "calme") or "calme")
    if c.get("musique", True) and ambiance != "aucune":
        son += musique(len(son), int(c.get("graine", 7)), ambiance)
        for i, s in enumerate(segments[1:], start=1):
            w = souffle(0.55, i)
            j = max(0, int((s["debut"] - 0.42) * SR))
            son[j:j + len(w)] += w[: max(0, n - j)]
        for s, nb in zip(segments, c.get("etiquettes", [])):
            for e in range(int(nb or 0)):
                j = int((s["debut"] + 0.4 + e * 0.3) * SR)
                p = pop(e)
                son[j:j + len(p)] += p[: max(0, n - j)]
    son = np.clip(son, -1, 1)
    sf.write(os.path.join(sortie, "son.wav"), son, SR)
    with open(os.path.join(sortie, "temps.json"), "w", encoding="utf-8") as f:
        json.dump({"duree": duree, "segments": segments}, f, ensure_ascii=False)
    print(json.dumps({"duree": duree, "segments": len(segments)}))


if __name__ == "__main__":
    main()
