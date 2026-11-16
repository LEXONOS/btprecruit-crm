"""Le rythme d'une musique, pour le montage des clips du studio des créatrices (usine/clip.js).

python3 rythme.py musique.wav
  écrit en JSON : { "duree", "tempo", "periode", "beats": [s], "forts": [s], "accents": [s], "drop": s | null }
  beats    les temps (suivi du tempo par programmation dynamique : la méthode d'Ellis, celle de librosa)
  forts    les premiers temps de chaque mesure à quatre temps (la place dans la mesure où l'on frappe le plus fort)
  accents  les temps les plus frappés (le tiers le plus fort)
  drop     l'endroit où l'énergie monte d'un coup (l'arrivée de la basse, du refrain), s'il y en a un
python3 rythme.py son.wav --pic
  le moment le plus frappé d'un son court (le bouchon qui saute, le briquet) : { "pic": s | null, "force": x }

Seulement numpy et soundfile, déjà installés sur l'usine pour la voix.
"""
import json
import sys

import numpy as np
import soundfile as sf

SR = 22050
HOP = 256
NFFT = 1024


def lire(chemin):
    y, sr = sf.read(chemin, dtype="float32", always_2d=True)
    y = y.mean(axis=1)
    if sr != SR and len(y):
        n = int(round(len(y) * SR / sr))
        y = np.interp(np.linspace(0, len(y) - 1, n), np.arange(len(y)), y).astype(np.float32)
    return y


def enveloppe(y):
    """La force des attaques, trame par trame (12 ms, fenêtre de 46 ms) : le flux spectral sur 64 bandes logarithmiques."""
    if len(y) < NFFT:
        y = np.pad(y, (0, NFFT - len(y)))
    y = np.pad(y, (NFFT // 2, NFFT // 2))
    n = 1 + (len(y) - NFFT) // HOP
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    spectre = np.abs(np.fft.rfft(y[idx] * np.hanning(NFFT).astype(np.float32), axis=1))
    f = np.fft.rfftfreq(NFFT, 1.0 / SR)
    bords = np.geomspace(30, min(8000, SR / 2), 65)
    bandes = np.zeros((spectre.shape[0], 64), dtype=np.float32)
    for k in range(64):
        m = (f >= bords[k]) & (f < bords[k + 1])
        if m.any():
            bandes[:, k] = spectre[:, m].mean(axis=1)
    d = np.diff(np.log1p(1000.0 * bandes), axis=0)
    d[d < 0] = 0
    o = np.concatenate([[0.0], d.mean(axis=1)])
    # moins la moyenne locale (0,4 s) : seules les attaques ressortent
    w = max(1, int(0.4 * SR / HOP))
    o = np.maximum(0.0, o - np.convolve(o, np.ones(w) / w, mode="same"))
    return o


def tempo(o, fr, centre=120.0):
    """Le tempo le plus probable : l'autocorrélation des attaques, entre 60 et 200 BPM, autour de 120."""
    x = o - o.mean()
    n = len(x)
    if n < 8 or not np.any(x):
        return centre
    ac = np.correlate(x, x, mode="full")[n - 1:]
    ac = ac / (ac[0] + 1e-9)
    lags = np.arange(len(ac), dtype=float)
    bpm = 60.0 * fr / np.maximum(lags, 1.0)
    ok = (bpm >= 60) & (bpm <= 200) & (lags > 0)
    if not ok.any():
        return centre
    score = np.where(ok, ac * np.exp(-0.5 * np.log2(bpm / centre) ** 2), -np.inf)
    lag = int(np.argmax(score))
    # l'octave : un tempo lent dont la moitié de période frappe presque autant est un tempo double (une basse en
    # demi-temps sur une grosse caisse à chaque temps), et l'inverse
    if 60.0 * fr / lag < 95 and lag // 2 > 0 and ac[lag // 2 - 1: lag // 2 + 2].max() >= 0.55 * ac[lag]:
        lag = lag // 2 - 1 + int(np.argmax(ac[lag // 2 - 1: lag // 2 + 2]))
    elif 60.0 * fr / lag > 175 and 2 * lag + 2 < len(ac) and ac[2 * lag - 1: 2 * lag + 2].max() >= 0.8 * ac[lag]:
        lag = 2 * lag - 1 + int(np.argmax(ac[2 * lag - 1: 2 * lag + 2]))
    if 1 <= lag < len(ac) - 1:
        a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
        den = a - 2 * b + c
        if den != 0:
            lag = lag + max(-0.5, min(0.5, 0.5 * (a - c) / den))
    return float(60.0 * fr / lag)


def suivre(o, fr, bpm, serrage=100.0):
    """Les temps : chaque temps cherche le meilleur temps précédent à environ une période (Ellis 2007)."""
    periode = fr * 60.0 / bpm
    if o.std() <= 0:
        return np.array([], dtype=int)
    on = o / o.std()
    k = np.arange(-int(periode), int(periode) + 1)
    local = np.convolve(on, np.exp(-0.5 * (k * 32.0 / periode) ** 2), mode="same")
    n = len(local)
    fen = np.arange(-int(round(2 * periode)), -int(round(periode / 2)) + 1)
    cout = -serrage * np.log(-fen / periode) ** 2
    cumul = np.zeros(n)
    lien = -np.ones(n, dtype=int)
    premier = True
    lmax = local.max() if n else 0
    for i in range(n):
        idx = i + fen
        ok = idx >= 0
        best, prec = 0.0, -1
        if ok.any():
            cand = cout[ok] + cumul[idx[ok]]
            j = int(np.argmax(cand))
            best, prec = float(cand[j]), int(idx[ok][j])
        cumul[i] = local[i] + best
        if premier and local[i] < 0.01 * lmax:
            lien[i] = -1
        else:
            lien[i] = prec
            premier = False
    if n < 3:
        return np.array([], dtype=int)
    maxloc = np.r_[False, (cumul[1:-1] > cumul[:-2]) & (cumul[1:-1] >= cumul[2:]), False]
    if not maxloc.any():
        return np.array([], dtype=int)
    cands = np.where(maxloc & (cumul > 0.5 * np.median(cumul[maxloc])))[0]
    if not len(cands):
        return np.array([], dtype=int)
    b = [int(cands[-1])]
    while lien[b[-1]] >= 0 and len(b) < 10000:
        b.append(int(lien[b[-1]]))
    b = np.array(b[::-1])
    # les temps du silence au début et à la fin sont retirés
    lisse = np.convolve(local, np.hanning(max(3, int(periode)) * 2 + 1), mode="same")
    seuil = 0.5 * np.sqrt(np.mean(lisse[b] ** 2)) if len(b) else 0
    garde = np.where(lisse[b] > seuil)[0]
    if len(garde):
        b = b[garde[0]: garde[-1] + 1]
    return b


def rms(y, pas):
    n = max(1, len(y) // pas)
    return np.sqrt(np.mean(y[: n * pas].reshape(n, pas) ** 2, axis=1)) if len(y) >= pas else np.array([float(np.sqrt(np.mean(y ** 2))) if len(y) else 0.0])


def analyser(chemin):
    y = lire(chemin)
    duree = len(y) / SR
    o = enveloppe(y)
    fr = SR / HOP
    bpm = tempo(o, fr)
    trames = suivre(o, fr, bpm)
    t = lambda tr: round(float(tr) / fr, 3)
    beats = [t(b) for b in trames]
    forts, accents, drop = [], [], None
    if len(trames) >= 4:
        force = np.array([o[max(0, b - 2): b + 3].max() for b in trames])
        phase = int(np.argmax([force[p::4].mean() if len(force[p::4]) else 0 for p in range(4)]))
        forts = beats[phase::4]
        seuil = np.percentile(force, 66)
        accents = [beats[i] for i in range(len(beats)) if force[i] >= seuil]
    # le drop : la plus forte montée d'énergie entre la seconde d'avant et la seconde d'après (pas dans la première
    # seconde et demie, où la musique démarre)
    e = rms(y, int(0.1 * SR))
    if len(e) > 30:
        av = np.array([e[max(0, i - 10): i].mean() if i else 0 for i in range(len(e))])
        ap = np.array([e[i: i + 10].mean() for i in range(len(e))])
        d = ap - av
        d[:15] = -1
        i = int(np.argmax(d))
        if d[i] > 0.35 * e.mean() and ap[i] > 1.5 * max(av[i], 1e-4):
            x = i * 0.1
            drop = round(min(beats, key=lambda b: abs(b - x)) if beats else x, 3)
    periode = round(60.0 / bpm, 4) if bpm else None
    return {"duree": round(duree, 3), "tempo": round(bpm, 2), "periode": periode, "beats": beats, "forts": forts, "accents": accents, "drop": drop}


def pic(chemin):
    y = lire(chemin)
    if len(y) < SR * 0.3:
        return {"pic": None, "force": 0}
    o = enveloppe(y)
    # ni la première dixième de seconde ni la fin (un son coupé net y fait un clic)
    debut, fin = int(0.1 * SR / HOP), len(o) - int(0.12 * SR / HOP)
    if fin <= debut + 2:
        return {"pic": None, "force": 0}
    zone = o[debut:fin]
    i = int(np.argmax(zone))
    force = float(zone[i] / (zone.mean() + 1e-6))
    ok = zone[i] >= 0.35 and force >= 6
    return {"pic": round((i + debut) * HOP / SR, 3) if ok else None, "force": round(force, 2)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"erreur": "python3 rythme.py fichier.wav [--pic]"}))
        sys.exit(1)
    print(json.dumps(pic(sys.argv[1]) if "--pic" in sys.argv else analyser(sys.argv[1])))
