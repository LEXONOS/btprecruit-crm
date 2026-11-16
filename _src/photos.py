"""Copie les photos d'illustration Pexels dans assets/photos/ pour ne plus dépendre du réseau de Pexels.
Lancer depuis la racine du site, sur un ordinateur connecté à internet :
    python3 _src/photos.py          (télécharge les photos manquantes)
    python3 _src/photos.py --tout   (retélécharge tout)
puis : python3 _src/build.py

Une photo déjà présente dans assets/photos/ (par exemple une vraie photo du centre) n'est jamais écrasée,
sauf avec --tout."""
import pathlib
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build import PHOTOS, PHOTOS_LOCALES, photo_locale, url_pexels  # noqa: E402

LARGEUR = 1800


def main():
    tout = '--tout' in sys.argv
    PHOTOS_LOCALES.mkdir(parents=True, exist_ok=True)
    for cle, (ident, description, _) in PHOTOS.items():
        if photo_locale(cle) and not tout:
            print(f'  {cle:9} déjà là, gardée')
            continue
        cible = PHOTOS_LOCALES / f'{cle}.jpg'
        requete = urllib.request.Request(url_pexels(ident, LARGEUR), headers={'User-Agent': 'Mozilla/5.0 (site Lomaya)'})
        with urllib.request.urlopen(requete, timeout=30) as r:
            donnees = r.read()
        if not donnees.startswith(b'\xff\xd8'):
            print(f'  {cle:9} réponse inattendue, ignorée')
            continue
        cible.write_bytes(donnees)
        print(f'  {cle:9} {len(donnees) // 1024} ko  ({description})')
    print('Fini. Relancez : python3 _src/build.py')


if __name__ == '__main__':
    main()
