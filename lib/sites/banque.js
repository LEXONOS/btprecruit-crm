// Petite banque de photos d'illustration de secours (photos Unsplash servies par Lorem Picsum, licence Unsplash :
// usage libre, crédit apprécié), pour les métiers où une image d'ambiance a du sens quand Pexels n'est pas branché.
// Sélection reprise de taste-skill (MIT), limitée à ce qui va sous les tropiques : mer, jardin, table, bâti clair, route.
'use strict';

const BANQUE = {
  mer: [
    { id: 124, ratio: 1.5, auteur: 'Anton Sulsky', page: 'https://unsplash.com/photos/fj0tFloTPGQ' },
    { id: 640, ratio: 1.5, auteur: 'Sarah Bürvenich', page: 'https://unsplash.com/photos/vigsqYux_-8' },
    { id: 215, ratio: 1.33, auteur: 'Paula Borowska', page: 'https://unsplash.com/photos/04paG2PxKGs' },
    { id: 77, ratio: 1.48, auteur: 'May Pamintuan', page: 'https://unsplash.com/photos/j9nfqTi5T5o' },
    { id: 851, ratio: 1.66, auteur: 'Tiago Aguiar', page: 'https://unsplash.com/photos/uXzNVOZT5no' },
    { id: 374, ratio: 1.5, auteur: 'Ma. Alejandra', page: 'https://unsplash.com/photos/TDahcrcPhhA' },
    { id: 218, ratio: 1.5, auteur: 'Monika Majkowska', page: 'https://unsplash.com/photos/Nq8LdWC7HnM' },
    { id: 716, ratio: 1.5, auteur: 'Matthew Kosloski', page: 'https://unsplash.com/photos/BT_BUEwjeQg' },
    { id: 1038, ratio: 0.67, auteur: 'Marcelo Quinan', page: 'https://unsplash.com/photos/upywS5QFwr8' },
    { id: 108, ratio: 1.5, auteur: 'Florian Klauer', page: 'https://unsplash.com/photos/t1mqA3V3-7g' }
  ],
  jardin: [
    { id: 189, ratio: 1.33, auteur: 'Buzo Jesús', page: 'https://unsplash.com/photos/pHM4a_RZSLE' },
    { id: 631, ratio: 1.5, auteur: '贝莉儿 NG', page: 'https://unsplash.com/photos/C_-DQF-x-N0' },
    { id: 844, ratio: 1.5, auteur: 'kazuend', page: 'https://unsplash.com/photos/LVdiXyu2eTc' },
    { id: 704, ratio: 1.5, auteur: 'Ståle Grut', page: 'https://unsplash.com/photos/NUgw97CVdAk' },
    { id: 517, ratio: 1.5, auteur: 'Brian Jimenez', page: 'https://unsplash.com/photos/ch-mPpglKjQ' },
    { id: 944, ratio: 1.5, auteur: 'Tim Swaan', page: 'https://unsplash.com/photos/eOpewngf68w' },
    { id: 940, ratio: 0.66, auteur: 'Annie Spratt', page: 'https://unsplash.com/photos/8mqOw4DBBSg' },
    { id: 159, ratio: 2.03, auteur: 'Shyamanta Baruah', page: 'https://unsplash.com/photos/kxqvE41_07k' }
  ],
  table: [
    { id: 488, ratio: 1.5, auteur: 'Monstruo Estudio', page: 'https://unsplash.com/photos/lQy6mHZ7fYk' },
    { id: 292, ratio: 1.51, auteur: 'Webvilla', page: 'https://unsplash.com/photos/hv1MrBzGGNY' },
    { id: 999, ratio: 1.5, auteur: 'Annie Spratt', page: 'https://unsplash.com/photos/R3LcfTvcGWY' },
    { id: 326, ratio: 1.51, auteur: 'Dominik Martin', page: 'https://unsplash.com/photos/JYFmYif4n70' },
    { id: 42, ratio: 1.5, auteur: 'Luke Chesser', page: 'https://unsplash.com/photos/KR2mdHJ5qMg' },
    { id: 625, ratio: 1.5, auteur: 'Breather', page: 'https://unsplash.com/photos/DEdM9Vs6s8w' },
    { id: 635, ratio: 1.5, auteur: 'André Freitas', page: 'https://unsplash.com/photos/uu5PfAzu0s4' },
    { id: 1080, ratio: 1.5, auteur: 'veeterzy', page: 'https://unsplash.com/photos/OJJIaFZOeX4' }
  ],
  batiment: [
    { id: 1081, ratio: 1.49, auteur: 'Julien Moreau', page: 'https://unsplash.com/photos/688Fna1pwOQ' },
    { id: 954, ratio: 1.52, auteur: 'Todd Quackenbush', page: 'https://unsplash.com/photos/JJB_K8aCPU4' },
    { id: 887, ratio: 1.5, auteur: 'Roman Kraft', page: 'https://unsplash.com/photos/7sMHTVJ0OTA' },
    { id: 947, ratio: 1.5, auteur: 'Anthony DELANOIX', page: 'https://unsplash.com/photos/vNAZubsDWMg' },
    { id: 951, ratio: 1.6, auteur: 'Sérgio Rola', page: 'https://unsplash.com/photos/4aQY2CrXsa8' },
    { id: 946, ratio: 1.4, auteur: 'Padurariu Alexandru', page: 'https://unsplash.com/photos/2UE1givDiPM' }
  ],
  route: [
    { id: 133, ratio: 1.5, auteur: 'Dietmar Becker', page: 'https://unsplash.com/photos/8Zt0xOOK4nI' },
    { id: 655, ratio: 1.78, auteur: 'Kyle Szegedi', page: 'https://unsplash.com/photos/tRQfEwP5P_0' },
    { id: 757, ratio: 1.71, auteur: 'Josh Felise', page: 'https://unsplash.com/photos/11Q8ApbwkVI' },
    { id: 88, ratio: 0.75, auteur: 'Barcelona', page: 'https://unsplash.com/photos/muC_6gTMLR4' }
  ]
};

function url(p, largeur) { const l = largeur || 1920; return 'https://picsum.photos/id/' + p.id + '/' + l + '/' + Math.round(l / (p.ratio || 1.5)); }

module.exports = { BANQUE, url };
