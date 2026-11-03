// La Martinique pour Novalemo : communes, zones de chasse, et les tests qui gardent la prospection sur l'île.
'use strict';
const { sansAccents } = require('./util');

// Les 34 communes (code postal principal). Toutes les adresses de Martinique sont en 972xx.
const COMMUNES = [
  ['Fort-de-France', '97200'], ['Le Lamentin', '97232'], ['Schœlcher', '97233'], ['Le Robert', '97231'], ['Le François', '97240'],
  ['Ducos', '97224'], ['Sainte-Marie', '97230'], ['Saint-Joseph', '97212'], ['Rivière-Salée', '97215'], ['La Trinité', '97220'],
  ['Sainte-Luce', '97228'], ['Le Gros-Morne', '97213'], ['Saint-Esprit', '97270'], ['Les Trois-Îlets', '97229'], ['Le Marin', '97290'],
  ['Le Lorrain', '97214'], ['Le Diamant', '97223'], ['Rivière-Pilote', '97211'], ['Sainte-Anne', '97227'], ['Le Vauclin', '97280'],
  ['Le Carbet', '97221'], ['Saint-Pierre', '97250'], ['Le Marigot', '97225'], ['Basse-Pointe', '97218'], ['Case-Pilote', '97222'],
  ['Le Morne-Rouge', '97260'], ['Les Anses-d\'Arlet', '97217'], ['Bellefontaine', '97222'], ['Le Morne-Vert', '97226'],
  ['Fonds-Saint-Denis', '97250'], ['Grand\'Rivière', '97218'], ['Macouba', '97218'], ['L\'Ajoupa-Bouillon', '97216'], ['Le Prêcheur', '97250']
];
const cle = function (s) { return sansAccents(String(s || '').replace(/œ/gi, 'oe')).replace(/[^a-z0-9]/g, ''); };
const PAR_CLE = new Map(COMMUNES.map(function (c) { return [cle(c[0]), c]; }));
// variantes courantes (sans article, Google, BODACC)
[['lamentin', 'Le Lamentin'], ['robert', 'Le Robert'], ['francois', 'Le François'], ['trinite', 'La Trinité'], ['marin', 'Le Marin'], ['diamant', 'Le Diamant'],
  ['vauclin', 'Le Vauclin'], ['carbet', 'Le Carbet'], ['lorrain', 'Le Lorrain'], ['marigot', 'Le Marigot'], ['grosmorne', 'Le Gros-Morne'], ['morne rouge', 'Le Morne-Rouge'],
  ['trois ilets', 'Les Trois-Îlets'], ['troisilets', 'Les Trois-Îlets'], ['anses darlet', 'Les Anses-d\'Arlet'], ['ansesdarlet', 'Les Anses-d\'Arlet'], ['fdf', 'Fort-de-France'],
  ['schoelcher', 'Schœlcher'], ['precheur', 'Le Prêcheur'], ['ajoupabouillon', 'L\'Ajoupa-Bouillon'], ['grandriviere', 'Grand\'Rivière']]
  .forEach(function (v) { PAR_CLE.set(cle(v[0]), COMMUNES.find(function (c) { return c[0] === v[1]; })); });

function commune(nom) { const c = PAR_CLE.get(cle(nom)); return c ? c[0] : null; }
function estMartinique(texte) {
  const s = String(texte || '');
  if (/\b972\d{2}\b/.test(s) || /martinique|madinina/i.test(s)) return true;
  if (/\b97[13-8]\d{2}\b/.test(s) || /guadeloupe|saint-martin|saint-barth/i.test(s)) return false;
  return !!commune(s);
}
// commune lue dans une adresse : « 12 rue X, 97232 Le Lamentin, Martinique »
function communeDe(adresse) {
  const m = String(adresse || '').match(/972\d{2}\s+([^,\n]+)/);
  if (m) return commune(m[1]) || m[1].trim();
  for (const c of COMMUNES) if (cle(adresse).indexOf(cle(c[0])) >= 0) return c[0];
  return null;
}

// Téléphones : +596 596 (fixe), +596 696 / 697 (mobile, donc WhatsApp possible)
function chiffres(t) { return String(t || '').replace(/[^\d+]/g, ''); }
function e164(t) {
  let d = chiffres(t);
  if (!d) return null;
  if (d.indexOf('00') === 0) d = '+' + d.slice(2);
  if (/^0\d{9}$/.test(d)) d = (/^0(596|696|697)/.test(d) ? '+596' : /^0(590|690|691)/.test(d) ? '+590' : '+33') + d.slice(1);
  return /^\+\d{10,15}$/.test(d) ? d : null;
}
function mobile(t) { const e = e164(t); return !!e && /^\+596(696|697)\d{6}$/.test(e); }
function affiche(t) {
  const e = e164(t);
  if (!e) return String(t || '');
  if (/^\+596/.test(e)) { const n = '0' + e.slice(4); return n.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4'); }
  return e;
}

// Zones de chasse par défaut (les bassins d'entreprises de l'île)
const ZONES_CHASSE = ['Fort-de-France', 'Le Lamentin', 'Ducos', 'Schœlcher', 'Le Robert', 'Le François', 'Rivière-Salée', 'Sainte-Luce', 'Le Marin', 'La Trinité', 'Saint-Joseph', 'Les Trois-Îlets', 'Sainte-Marie', 'Saint-Pierre'];

module.exports = { COMMUNES, commune, communeDe, estMartinique, e164, mobile, affiche, ZONES_CHASSE };
