// Jade, Chasseuse Google Maps : métiers cibles x communes de Martinique (rotation lue dans sa stratégie),
// entreprises avec numéro, situation web notée. Plafond de recherches Google par jour (budget).
// Martinique uniquement : une ligne de rotation hors de l'île est ignorée, un résultat hors 972 est jeté.
'use strict';
const ND = require('../chasse/nd-moteur');
const MQ = require('../martinique');
const { SOCIAUX, GRATUITS } = require('../web');
const { jourGP } = require('../util');

const PLACES = 'https://places.googleapis.com/v1/places:searchText';
const CHAINES = /(carrefour|leclerc|super u|hyper u|intermarch|casino|leader price|ecomax|total ?energies|\besso\b|rubis|orange|\bsfr\b|\bfree\b|bouygues|digicel|outremer telecom|mcdonald|\bkfc\b|burger king|subway|domino|decathlon|darty|conforama|\bbut\b|castorama|leroy merlin|mr\.? bricolage|point p|bricorama|weldom|renault|peugeot|toyota|citro[eë]n|hertz|\bavis\b|europcar|sixt|banque|cr[ée]dit agricole|bnp|bred|soci[ée]t[ée] g[ée]n[ée]rale|caisse d.?[ée]pargne|la poste|france travail|p[ôo]le emploi|mairie|pr[ée]fecture|collectivit[ée] territoriale|h[ôo]pital|\bchu\b|clinique|gendarmerie|police|[ée]cole publique|coll[èe]ge|lyc[ée]e|universit|edf|veolia|engie|odyssi|sme\b|axa|allianz|groupama|maif|macif|mma|pharmacie)/i;

function decouper(s) { return String(s || '').split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean); }
function zoneOk(z) { return /^martinique$/i.test(String(z).trim()) || !!MQ.commune(z); }

// Deux écritures possibles dans la stratégie :
//  - des lignes « métier | commune »
//  - « Métiers : a, b, c » et « Zones : x, y » : chaque métier passe dans chaque commune
function lignes(playbook) {
  const txt = String(playbook || '');
  const out = txt.split('\n').map(function (l) { return l.trim(); })
    .filter(function (l) { return l.indexOf('|') > 0 && !/^rotation/i.test(l); })
    .map(function (l) { const p = l.split('|'); return { metier: p[0].trim(), zone: p[1].trim() }; });
  const m = txt.match(/^\s*m[ée]tiers?\s*:\s*(.+)$/im), z = txt.match(/^\s*(zones?|communes?)\s*:\s*(.+)$/im);
  if (m) {
    const M = decouper(m[1]), Z = z ? decouper(z[2]) : MQ.ZONES_CHASSE;
    Z.forEach(function (zone) { M.forEach(function (metier) { out.push({ metier: metier, zone: zone }); }); });
  }
  return out.filter(function (x) { return x.metier && x.zone && zoneOk(x.zone); })
    .map(function (x) { return { metier: x.metier, zone: MQ.commune(x.zone) || 'Martinique' }; });
}
function etatWeb(site) {
  if (!site) return 'aucun';
  if (SOCIAUX.test(site)) return 'reseau';
  if (GRATUITS.test(site) || /^http:\/\//i.test(site)) return 'douteux';
  return 'a_auditer';
}
const SCORE = { aucun: 68, reseau: 72, douteux: 66, a_auditer: 50 };

async function chercher(metier, zone, cle) {
  const body = { textQuery: metier + ' ' + zone + (zone === 'Martinique' ? '' : ' Martinique'), pageSize: 20, languageCode: 'fr', locationRestriction: { rectangle: ND.BOITES['972'] } };
  const r = await fetch(PLACES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': cle, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus,places.primaryTypeDisplayName,places.regularOpeningHours.weekdayDescriptions' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
  });
  const d = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error('Google Places : ' + ((d.error && d.error.message) || r.status));
  return { places: d.places || [] };
}

async function run(ctx) {
  const db = ctx.db;
  const cle = process.env.GOOGLE_MAPS_API_KEY;
  if (!cle) return { resume: 'Pas de clé Google (GOOGLE_MAPS_API_KEY) : rien à faire.', produit: 0, erreur: true };
  const rot = lignes(ctx.agent.playbook);
  if (!rot.length) return { resume: 'Stratégie sans rotation en Martinique (« Métiers : ... » et « Zones : ... ») : à corriger par mon chef.', produit: 0, erreur: true };
  const jour = await db.one('hq_daily', { eq: { day: jourGP() } });
  let reste = Math.max(0, (ctx.budget.places_jour || 0) - ((jour && jour.places) || 0));
  if (reste <= 0) return { resume: 'Plafond Google du jour atteint, je reprends demain.', produit: 0, prochain_min: 360 };
  const cfg = await db.one('hq_config', { eq: { key: 'job:maps' } });
  let i = (cfg && cfg.value && cfg.value.i) || 0;
  const n = Math.min(3, reste);
  const lus = [], nouveaux = [];
  for (let k = 0; k < n && Date.now() < ctx.limite - 20000; k++) {
    const q = rot[i % rot.length]; i++;
    let res;
    try { res = await chercher(q.metier, q.zone, cle); }
    catch (e) { lus.push(q.metier + ' ' + q.zone + ' : erreur ' + String(e.message).slice(0, 80)); continue; }
    ctx.compteurs.places++; reste--;
    let gardes = 0, horsZone = 0;
    res.places.forEach(function (p) {
      const nom = p.displayName ? p.displayName.text : '';
      const tel = p.internationalPhoneNumber || p.nationalPhoneNumber || null;
      if (!nom || p.businessStatus === 'CLOSED_PERMANENTLY' || CHAINES.test(nom)) return;
      if (!MQ.estMartinique(p.formattedAddress)) { horsZone++; return; }
      if (!tel && !p.websiteUri) return;
      const ew = etatWeb(p.websiteUri);
      if (ew === 'a_auditer' && (p.userRatingCount || 0) > 400) return; // très grosse structure avec site : pas notre cible
      gardes++;
      nouveaux.push({
        company_id: 'novalemo', dedupe: 'place:' + p.id, source: 'maps', name: nom, sector: q.metier, island: 'MQ', commune: MQ.communeDe(p.formattedAddress) || q.zone,
        website: p.websiteUri || null, domain: p.websiteUri && ew !== 'reseau' ? (function () { try { return new URL(p.websiteUri).hostname.replace(/^www\./, ''); } catch (e) { return null; } })() : null,
        phone: tel, site_state: ew, score: SCORE[ew] + Math.min(8, Math.round((p.userRatingCount || 0) / 15)), reason: 'Google Maps : ' + q.metier + ', ' + (ew === 'aucun' ? 'pas de site' : ew === 'reseau' ? 'réseaux sociaux seulement' : ew === 'douteux' ? 'site faible' : 'site à auditer'),
        status: 'nouveau', data: { google: { place_id: p.id, maps: p.googleMapsUri, note: p.rating || null, avis: p.userRatingCount || 0, type: p.primaryTypeDisplayName ? p.primaryTypeDisplayName.text : null, adresse: p.formattedAddress, horaires: (p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions) || null } }
      });
    });
    lus.push(q.metier + ' ' + q.zone + ' : ' + res.places.length + ' vus, ' + gardes + ' gardés' + (horsZone ? ', ' + horsZone + ' hors Martinique' : ''));
  }
  let ajoutes = 0;
  if (nouveaux.length) ajoutes = (await db.insert('hq_leads', nouveaux, { onConflict: 'dedupe', ignoreDuplicates: true })).length;
  await db.upsert('hq_config', { key: 'job:maps', value: { i: i % Math.max(1, rot.length) }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  ctx.compteurs.leads += ajoutes;
  return { resume: ajoutes + ' nouveau(x) prospect(s) Google Maps (' + lus.join(' ; ') + ')', produit: ajoutes, detail: lus };
}

module.exports = { run, lignes, etatWeb };
