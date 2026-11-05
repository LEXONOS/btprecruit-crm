"""La voix et le son du Studio 3D.

Lit une commande JSON sur l'entrée standard :
  { "langue": "en-us", "voix": "af_heart", "vitesse": 1.0, "segments": ["...", "..."],
    "sortie": "/dossier", "modele": "kokoro-v1.0.onnx", "voix_fichier": "voices-v1.0.bin",
    "debut": 0.25, "ecart": 0.3, "fin": 0.9, "musique": true, "graine": 7 }
Écrit dans le dossier de sortie :
  voix.wav    la voix seule, chaque segment posé à sa place sur la ligne de temps
  son.wav     la voix, la musique d'ambiance et les bruitages, mixés
  temps.json  { "duree": s, "segments": [ { "debut", "fin", "mots": [ { "m", "t0", "t1" } ] } ] }

La voix : Kokoro (82M, licence Apache 2.0), qui tourne sur le processeur, en anglais, français, espagnol, portugais,
italien, hindi, japonais et chinois. La musique et les bruitages sont fabriqués ici (aucun son emprunté).
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


def mots_chronometres(texte, debut, duree):
    mots = [m for m in re.split(r"\s+", texte.strip()) if m]
    if not mots:
        return []
    ps = [poids(m) for m in mots]
    total = sum(p + q for p, q in ps) - ps[-1][1]
    t = debut
    out = []
    for i, (m, (p, q)) in enumerate(zip(mots, ps)):
        d = duree * p / total
        out.append({"m": m, "t0": round(t, 3), "t1": round(t + d, 3)})
        t += d + (duree * q / total if i < len(mots) - 1 else 0)
    return out


def enveloppe(n, attaque, relache):
    e = np.ones(n, dtype=np.float32)
    a = min(n, int(attaque * SR))
    r = min(n, int(relache * SR))
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[-r:] = np.minimum(e[-r:], np.linspace(1, 0, r))
    return e


def musique(n, graine):
    """Une nappe douce, en accords qui changent toutes les 4 secondes environ, très en dessous de la voix."""
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
    duree_accord = 4.2
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
    out /= max(1e-6, np.max(np.abs(out)))
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
    from kokoro_onnx import Kokoro
    k = Kokoro(c.get("modele", "kokoro-v1.0.onnx"), c.get("voix_fichier", "voices-v1.0.bin"))
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
            s, sr = k.create(texte, voice=c.get("voix", "af_heart"), speed=v, lang=c.get("langue", "en-us"))
            if sr != SR:
                raise SystemExit("fréquence inattendue : %s" % sr)
            out.append(rogner(np.asarray(s, dtype=np.float32)))
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
        segments.append({"debut": round(t, 3), "fin": round(t + d, 3), "mots": mots_chronometres(texte or "", t, d)})
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
    if c.get("musique", True):
        son += musique(len(son), int(c.get("graine", 7)))
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
