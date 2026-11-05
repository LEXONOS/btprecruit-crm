// La page de rendu : charge les polices du dépôt, construit la scène, et rend une image JPEG à la demande.
import { creer } from './moteur.js';

const POLICES = [
  ['Unbounded', '/lib/sites/polices/unbounded.woff2', { weight: '200 900' }],
  ['Archivo', '/lib/sites/polices/archivo.woff2', { weight: '100 900', stretch: '62% 125%' }],
  ['Inter', '/lib/sites/polices/inter.woff2', { weight: '100 900' }]
];

let film = null;
window.STUDIO = {
  pret: false,
  profil() { return film && Object.assign({}, film.profil, { appels: film.renderer.info.render.calls, triangles: film.renderer.info.render.triangles, programmes: film.renderer.info.programs.length }); },
  async preparer(spec) {
    await Promise.all(POLICES.map(async (p) => { const f = new FontFace(p[0], 'url(' + p[1] + ')', p[2]); await f.load(); document.fonts.add(f); }));
    // la police du hindi (Noto Sans Devanagari) vient du système de l'usine
    await document.fonts.ready;
    film = creer(spec);
    document.body.appendChild(film.toile);
    film.toile.style.width = '270px';
    window.STUDIO.pret = true;
    return { duree: film.duree, plans: film.plans, objets: Object.keys(film.objets).length };
  },
  capture(t, qualite, largeur) {
    const toile = film.image(t);
    if (largeur && largeur < toile.width) {
      const c = document.createElement('canvas'); c.width = largeur; c.height = Math.round(toile.height * largeur / toile.width);
      c.getContext('2d').drawImage(toile, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', qualite || 0.85);
    }
    return toile.toDataURL('image/jpeg', qualite || 0.92);
  }
};
window.addEventListener('error', (e) => { window.STUDIO.erreur = String(e.message || e); });
