# Livraison MG-Lens : galeries par themes + lightbox + hero

ZIP CUMULATIF du chantier photos : il remplace et complete la livraison precedente.

## Quoi va ou (glisser tel quel a la racine du repo MG-Lens)
- `index.html` -> remplace celui de la racine
- `assets/photos/` -> les 65 photos renommees proprement (ecrase/complete le dossier)
- Les anciens fichiers 01.webp a 09.webp de la livraison precedente ne sont plus utilises : tu peux les supprimer du repo ou les laisser, ca ne casse rien

## Ce que ca change
1. PORTFOLIO PAR THEMES : 9 cadres = 9 univers (Editorial & mode 8, Beaute & bijoux 4, Evenementiel 6, Portraits studio 16, Plage & lifestyle 18, Noir & blanc 4, Culinaire & commerces 4, Famille & naissance 3, Nature & animaux 2). Clic sur un cadre = galerie en PILE DE CADRES 3D (ref Campione) : photo courante devant, les suivantes en retrait vers le fond avec flou progressif ; a l'ouverture les cadres arrivent disperses/flous et se rangent dans la pile ; navigation = la carte de devant s'envole a gauche et la pile avance. Fleches, compteur, Echap/fleches clavier, balayage tactile, clic sur une carte en retrait pour avancer, prechargement du theme entier.
2. NOIR & BLANC : au survol la photo se colore + leger zoom (desktop). Sur mobile, la couleur se revele quand le cadre traverse le centre de l'ecran et s'eteint quand il sort (fluide, reversible). Les cadres deja en N&B (Noir & blanc, Famille & naissance) n'ont plus le filtre : ils gardent juste le zoom, plus d'effet mort.
3. HERO CONSTELLATION : le ZH1 au centre + les 4 autres modeles autour (instantane, compact, drone, Manon minifig). Au chargement ils arrivent en volant un par un ; au scroll ils s'envolent chacun dans leur direction en tournant, le ZH1 part en dernier. Parallaxe souris, texte en cascade, decor studio supprime.
4. MANON EN VRAIE MINIFIG (v2) : tete jaune LEGO classique + grand sourire, cheveux blonds longs avec raie au milieu et pointes qui rebiquent, debardeur noir sur buste trapeze minifig, mains en C, jean, bras leve qui fait coucou, son petit appareil en briques dans l'autre main, collier argente.
5. MORPH EN VRAIES BRIQUES (v2) : l'instantane cote particuliers est bati en ~120 petites briques LEGO a tenons (1x1, 1x2, 2x2, plaques fines) ; au scroll vers "Pour les professionnels" CHAQUE brique s'envole (trajectoire courbe, culbute, decalage) et va se clipser dans le drone. Les briques du drone qui ne servent pas a l'appareil attendent en petit tas a cote de lui ; les briques de l'appareil qui ne servent pas au drone se posent en PLATEFORME D'ATTERRISSAGE blanche sous le drone, qui plane au-dessus, pales en rotation. Reversible et lisse, verifie par rendus headless (webgl).
6. HERO DISPERSE + COMETES (v3) : les appareils sont eparpilles aux quatre coins AUTOUR du texte (instantane en haut a gauche, drone qui vole en haut au centre, ZH1 en grand a droite, compact qui pointe depuis le bord bas, Manon qui fait coucou en bas a droite), positions calculees en fractions d'ecran donc la zone de texte reste toujours degagee. A l'arrivee chaque appareil VOLE le long d'une courbe de Bezier avec une trainee de briques en comete derriere lui ; au scroll il repart par la meme courbe, trainee comprise, et le ZH1 FONCE VERS LA CAMERA et traverse l'ecran en grossissant. Tout est reversible. Verifie par rendus headless a 5 moments du scroll.
7. MANON STAR (v3) : dans "Derriere l'objectif", 9 flashs de photographes (halo radial + etoile a 4 branches, additive blending) crepitent autour d'elle a des rythmes decales, et crepitent PLUS VITE quand on scrolle, comme des paparazzi. Et son bras leve fait vraiment coucou en boucle.

## Photos ecartees (pas dans les galeries)
SHAYCI5, SHAYCI8, IMG_7456 : trop denudees pour un site qui vise aussi les pros. Dis "go boudoir" si tu veux un 10e theme avec.

8. PORTFOLIO HARMONIEUX + ANIMATION (v4) : mosaique qui s'emboite parfaitement (3 cadres verticaux en diagonale positions 1/4/7 : Editorial, Plage, Noir & blanc ; remplit exactement 3x4 sur desktop et 2x6 sur mobile, zero trou, zero dent de scie). Nouvel ordre : Editorial T, Beaute, Evenementiel, Plage T, Studio, Famille, Noir & blanc T, Culinaire, Nature. Animation : chaque tirage se REVELE au scroll comme un developpement argentique (flou lumineux sepia qui devient net et contraste, en cascade case par case), puis chaque cadre s'INCLINE en 3D sous le curseur avec un REFLET DE VITRE qui suit la souris (radial screen-blend), comme un vrai tirage sous verre. Compatible avec l'effet N&B->couleur existant et la revelation couleur mobile. prefers-reduced-motion : tout s'affiche direct.

9. PASSE MOBILE COMPLETE (v5) - le desktop ne bouge pas, tout est en media queries + branche mobile du moteur 3D :
- NAV : sous la barre, rangee de pastilles d'ancres (Portfolio / Prestations / A propos / Contact) scrollable au doigt.
- HERO : structure repensee, texte en haut, bande reservee de 40svh en bas avec la scene recomposee (ZH1 centre, drone au-dessus de son epaule, Manon qui fait coucou devant a gauche, instantane au coin) ; titre recalibre (13.5vw), boutons pleine largeur sous 480px, legende centree en bas ; pixel ratio plafonne a 1.6 sur petit ecran pour la fluidite.
- PRESTATIONS : le canvas du morph passe EN TETE et reste COLLE en haut (sticky, fond papier flou, filet) pendant qu'on fait defiler la liste -> la transformation appareil->drone se voit en direct au scroll, morph legerement retracte pour tenir dans le petit canvas.
- PORTFOLIO : legendes recalibrees (plus de debordement), grille 2 colonnes qui s'emboite pleinement, revelation argentique conservee.
- LIGHTBOX : consigne adaptee au tactile ("Balayez...").
- Divers : coordonnees contact empilees, boutons contact pleine largeur, marges resserrees, bouton WhatsApp flottant reduit, theme-color papier pour la barre du navigateur.

10. DEUX VERSIONS + HARMONIE (v6) :
- SELECTEUR tout en haut, centre sous la barre : pastille "LEGO / Classique". Le choix est memorise (localStorage) et partageable : ajouter ?mode=simple a l'URL ouvre directement la version classique (pratique pour envoyer les 2 liens a Manon : lien normal = LEGO, lien?mode=simple = classique).
- VERSION CLASSIQUE : site sobre sans aucun parti pris LEGO : pas de 3D (hero texte seul et compact, pas de colonne morph, pas de Manon minifig ni flashs), pas de revelation argentique, pas d'inclinaison ni reflet ; la lightbox devient une carte unique avec navigation en fondu ; la grille, l'effet N&B->couleur et tout le contenu restent.
- HARMONIE VERSION LEGO : halo papier derriere le bloc texte du hero (lisible meme quand un modele passe derriere), inclinaison des cadres adoucie (4.5 deg), reflet plus subtil, revelation argentique moins criarde, gris de lecture plus contraste.
