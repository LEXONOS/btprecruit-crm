"""Génère index.html et les pages légales à partir des gabarits.
Lancer : python3 _src/build.py  (depuis la racine du site)

Les questions fréquentes vivent ici : une seule source pour la page et pour Google (FAQPage).

Photos : chaque emplacement a une clé (hero, sel, accueil...). Si un fichier assets/photos/<clé>.jpg existe,
il est utilisé ; sinon la photo d'illustration Pexels correspondante est servie par le réseau de Pexels.
Pour remplacer une photo par une vraie photo du centre : déposer assets/photos/<clé>.jpg puis relancer ce script.
Pour copier les photos Pexels dans le site (conseillé avant la mise en ligne) : python3 _src/photos.py"""
import html
import json
import pathlib
import re

RACINE = pathlib.Path(__file__).resolve().parent.parent
SRC = RACINE / '_src'
PHOTOS_LOCALES = RACINE / 'assets' / 'photos'

# clé : (identifiant Pexels, description, photographe quand il est connu). Licence Pexels : usage libre,
# sans attribution obligatoire. Page de chaque photo : https://www.pexels.com/photo/<identifiant>/
PHOTOS = {
    'hero':        (5639627,  "Femme en robe blanche qui flotte sur une eau sombre (format paysage)", 'cottonbro studio'),
    'hero_mobile': (5639624,  "Femme en robe blanche qui flotte sur une eau sombre (format portrait, téléphone)", 'cottonbro studio'),
    'flotte':      (5639312,  "Femme qui flotte sur le dos, eau sombre et lisse", 'cottonbro studio'),
    'sel':         (14438170, "Sels de bain et cuillère en bois", 'ANVA Marketing'),
    'etoiles':     (1341279,  "Ciel étoilé (fond de la partie Les bienfaits)", 'Kai Pilger'),
    'serviettes':  (208504,   "Serviettes roulées, encens et fleurs (bande de la partie Contact)", ''),
}
LARGEURS = (480, 800, 1200, 1600)


def url_pexels(ident, largeur):
    return f'https://images.pexels.com/photos/{ident}/pexels-photo-{ident}.jpeg?auto=compress&cs=tinysrgb&w={largeur}'


def photo_locale(cle):
    for ext in ('jpg', 'jpeg', 'webp', 'png'):
        f = PHOTOS_LOCALES / f'{cle}.{ext}'
        if f.exists():
            return f'assets/photos/{cle}.{ext}'
    return None


def src(cle, largeur):
    return photo_locale(cle) or url_pexels(PHOTOS[cle][0], largeur)


def srcset(cle):
    locale = photo_locale(cle)
    if locale:
        return locale
    return ', '.join(f'{url_pexels(PHOTOS[cle][0], l)} {l}w' for l in LARGEURS)


def remplacer_photos(page):
    page = re.sub(r'\{\{p:(\w+):(\d+)\}\}', lambda m: html.escape(src(m.group(1), int(m.group(2)))), page)
    page = re.sub(r'\{\{s:(\w+)\}\}', lambda m: html.escape(srcset(m.group(1))), page)
    reste = re.findall(r'\{\{[^}]*\}\}', page)
    if reste:
        raise SystemExit(f'Emplacements de photo inconnus : {reste}')
    distantes = any(photo_locale(c) is None for c in PHOTOS)
    lien = '<link rel="preconnect" href="https://images.pexels.com">' if distantes else ''
    return page.replace('<!--PRECONNECT-->', lien)


FAQ = [
    ('La flottaison', [
        ("Pourquoi parle-t-on de flottaison en isolation sensorielle ?",
         ["L'objectif est une relaxation profonde, où les stimulations extérieures sont supprimées autant que possible. En dehors de la petite musique de début et de fin de séance, aucun bruit, sauf si vous le demandez. La lumière s'éteint complètement ou laisse place au ciel étoilé.",
          "La très forte teneur en sel d'Epsom vous fait flotter comme en apesanteur, et l'eau, proche de la température du corps, efface toute sensation de chaud ou de froid. Votre cerveau se repose, votre esprit vagabonde librement."]),
        ("Quels sont les bienfaits de la flottaison ?",
         ["Elle est particulièrement appréciée en cas de douleurs chroniques, de stress, d'anxiété, de surmenage ou de problèmes de sommeil. Une séance permet un lâcher-prise total et une relaxation profonde ; pratiquée régulièrement, elle aide à aborder le quotidien de façon beaucoup plus sereine."]),
        ("Quels sont les bienfaits du sel d'Epsom ?",
         ["Utilisé depuis des siècles pour soulager les douleurs musculaires et articulaires, ce sel minéral associe deux minéraux essentiels : le soufre et le magnésium.",
          "Il hydrate la peau, l'aide à garder son élasticité et élimine les peaux mortes. Il est réputé apaiser certains problèmes de peau comme l'eczéma ou le psoriasis, et donne de l'éclat au teint et aux cheveux."]),
    ]),
    ('Votre séance', [
        ("Que dois-je apporter ?",
         ["Absolument rien. Nous fournissons tout le nécessaire pour la douche avant et après la séance, des bouchons d'oreilles si vous préférez éviter le sel dans les oreilles, un bonnet si vous ne voulez pas mouiller vos cheveux, un sèche-cheveux, un coin maquillage et coiffage, et un espace détente pour une boisson avant de repartir.",
          "Idéalement, on flotte nu, pour éviter toute sensation liée au maillot de bain."]),
        ("Combien de temps dure une séance ?",
         ["La flottaison dure 1 heure, la séance 1 h 30 au total : l'accueil, les douches avant et après, le coiffage si besoin et un moment dans l'espace détente. Arrivez 10 minutes avant l'heure.",
          "Vous pouvez aussi enchaîner deux séances : comptez alors 2 h 30 et non 3 h, car vous gagnez le temps entre les deux."]),
        ("Y a-t-il des précautions à prendre ?",
         ["Oui, des choses simples liées à la forte salinité de l'eau : ne pas se raser à la lame ni s'épiler le jour de la séance, protéger les petites blessures qui pourraient piquer, éviter de se frotter les yeux avec les mains mouillées et retirer ses lentilles de contact.",
          "Attendez un mois après un piercing ou un tatouage, évitez les colorations dans les deux semaines qui précèdent, et prenez un repas léger."]),
        ("Peut-on venir à deux ?",
         ["Oui : nos deux bassins sont des bassins duo. Vous flottez seul, ou à deux dans le même bassin avec la séance duo."]),
    ]),
    ('Hygiène et sécurité', [
        ("L'eau de mon bassin est-elle désinfectée ?",
         ["Oui, l'hygiène de nos cabines est notre priorité absolue. Chaque bassin contient près de 900 litres d'eau et 450 kg de sel d'Epsom : une salinité qui empêche déjà la survie des organismes et des virus.",
          "En plus, avant chaque séance, l'eau est filtrée et désinfectée pendant 15 minutes aux ultraviolets et au peroxyde d'hydrogène. Chaque nuit, un cycle de désinfection supplémentaire de 4 heures assure l'absence totale de germes. Des contrôles réguliers garantissent les normes d'hygiène et de sécurité."]),
        ("Puis-je contacter quelqu'un pendant ma séance ?",
         ["Oui. Chaque bassin est équipé d'un bouton d'appel. Vous pouvez aussi sortir du bassin à tout moment, et garder la lumière allumée si vous le préférez."]),
    ]),
    ('Réservation', [
        ("Comment réserver ?",
         ["En ligne, en quelques clics : solo ou duo, le jour, l'heure, puis le paiement sécurisé par carte bancaire. Vous pouvez aussi réserver par téléphone au 0690 60 97 60 ou nous écrire sur WhatsApp."]),
        ("Puis-je annuler ou déplacer ma séance ?",
         ["Oui, gratuitement jusqu'à 24 heures avant la séance. Passé ce délai, ou si vous ne venez pas, le montant réglé reste acquis."]),
        ("Comment fonctionnent les cartes cadeaux ?",
         ["Elles s'achètent au centre et sont valables 6 mois. Chaque carte porte un code unique : la personne qui la reçoit l'indique au moment de réserver, en ligne ou par téléphone."]),
        ("Comment fonctionnent les abonnements ?",
         ["Vous choisissez 3 ou 6 mois, et 2, 3 ou 4 séances par mois. Plus le rythme est soutenu, moins la séance coûte : jusqu'à 61 € au lieu de 79 €. Les abonnements sont payables en 4 fois maximum."]),
    ]),
]


def insecable(t):
    t = re.sub(r' ([:;?!])', '\u00a0\\1', t)
    t = re.sub(r'(\d) (€|°C|cm|kg|h|L|litres|minutes|heures|mois|séances)\b', '\\1\u00a0\\2', t)
    return t


def faq_html():
    blocs = []
    plus = '<svg aria-hidden="true"><use href="#i-plus"/></svg>'
    for groupe, questions in FAQ:
        items = []
        for q, rep in questions:
            corps = ''.join(f'<p>{html.escape(insecable(p), quote=False)}</p>' for p in rep)
            items.append(f'<details class="question"><summary><span>{html.escape(insecable(q), quote=False)}</span>{plus}</summary><div class="question__reponse"><div>{corps}</div></div></details>')
        blocs.append(f'<div class="faq__groupe apparait"><h3>{html.escape(groupe)}</h3>' + ''.join(items) + '</div>')
    return '\n        '.join(blocs)


def faq_jsonld():
    data = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': ' '.join(rep)}}
            for _, questions in FAQ for q, rep in questions
        ],
    }
    return '<script type="application/ld+json">\n' + json.dumps(data, ensure_ascii=False, indent=1) + '\n</script>'


def main():
    gabarit = (SRC / 'index.template.html').read_text(encoding='utf-8')
    script = (SRC / 'script-lomaya.svgpart').read_text(encoding='utf-8').strip()
    page = (gabarit
            .replace('<!--SCRIPT_PATHS-->', script)
            .replace('<!--FAQ_HTML-->', faq_html())
            .replace('<!--FAQ_JSONLD-->', faq_jsonld()))
    page = remplacer_photos(page)
    (RACINE / 'index.html').write_text(page, encoding='utf-8')

    # Pages légales : même sprite, même pied de page, en-tête simplifié
    sprite = re.search(r'<svg width="0".*?</svg>', page, re.S).group(0)
    pied = re.search(r'<footer class="pied">.*?</footer>', page, re.S).group(0)
    pied = pied.replace('href="#', 'href="index.html#')
    entete = ('<header class="entete entete--plein" id="entete"><div class="conteneur entete__barre">'
              '<a class="marque" href="index.html" aria-label="Lomaya, retour à l\'accueil">'
              '<img class="marque__fleur" src="assets/img/lomaya-fleur.svg" alt="" width="46" height="30">'
              '<svg class="marque__script" viewBox="0 0 780 278" aria-hidden="true"><use href="#lomaya-script" width="780" height="278"/></svg></a>'
              '<div class="entete__actions"><a class="lien" href="index.html">Retour au site</a></div>'
              '</div></header>')
    for nom in ('mentions-legales', 'cgv', 'confidentialite'):
        contenu = (SRC / f'{nom}.part.html').read_text(encoding='utf-8')
        titre = re.search(r'<h1>(.*?)</h1>', contenu).group(1)
        doc = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
               '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
               f'<title>{titre} · Lomaya</title>\n<meta name="robots" content="noindex, follow">\n'
               '<meta name="theme-color" content="#f2efe9">\n'
               '<link rel="icon" href="assets/img/favicon-48.png" sizes="48x48" type="image/png">\n'
               '<link rel="stylesheet" href="css/style.css">\n</head>\n<body class="legal">\n'
               f'{sprite}\n{entete}\n<main class="page-legale"><div class="conteneur page-legale__grille">\n{contenu}\n</div></main>\n{pied}\n'
               '<script>document.querySelectorAll("[data-annee]").forEach(function(e){e.textContent=new Date().getFullYear()})</script>\n'
               '</body>\n</html>\n')
        (RACINE / f'{nom}.html').write_text(doc, encoding='utf-8')
    locales = sorted(c for c in PHOTOS if photo_locale(c))
    print('index.html + 3 pages légales générées.', f'Photos locales : {", ".join(locales) or "aucune"} ;',
          f'Pexels : {len(PHOTOS) - len(locales)}.')


if __name__ == '__main__':
    main()
