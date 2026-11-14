// Les clés des créatrices (Claude, upload-post) sont chiffrées avant d'entrer en base (AES-256-GCM, une clé de
// chiffrement tirée d'un secret des variables Vercel : HQ_STUDIO_CLE si Louis l'ajoute, sinon CRON_SECRET), liées à
// leur compte (une clé copiée sur un autre compte ne se déchiffre pas) et marquées de l'empreinte de la clé de
// chiffrement : si le secret change un jour, la tour le voit et demande simplement de recoller la clé, au lieu de
// déchiffrer n'importe quoi. Les sessions des créatrices sont signées avec une clé tirée du même secret.
'use strict';
const crypto = require('crypto');

function maitre() {
  const s = String(process.env.HQ_STUDIO_CLE || '').trim();
  if (s.length >= 32) return s;
  const c = String(process.env.CRON_SECRET || '').trim();
  if (c.length >= 16) return c;
  if (process.env.HQ_LOCAL === '1' && !process.env.VERCEL) return 'la-tour-locale-studio-sans-secret';
  return null;
}
function cle(usage) {
  const m = maitre();
  return m ? crypto.createHmac('sha256', m).update('la-tour/studio/' + usage + '/v1').digest() : null;
}
function empreinte() { const k = cle('secrets'); return k ? crypto.createHash('sha256').update(k).digest('hex').slice(0, 12) : null; }
function disponible() { return !!maitre(); }

// lien : ce à quoi la clé est attachée (« claude:12 ») ; la fin (4 derniers caractères) sert à la reconnaître
function chiffrer(valeur, lien) {
  const k = cle('secrets');
  if (!k) throw new Error('le coffre des clés n\'est pas prêt (secret absent des variables de la tour)');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  c.setAAD(Buffer.from('la-tour/studio/' + lien));
  const ct = Buffer.concat([c.update(String(valeur), 'utf8'), c.final()]);
  return { v: 1, k: empreinte(), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ct: ct.toString('base64'), fin: String(valeur).slice(-4), le: new Date().toISOString() };
}
// null si la clé manque, a été chiffrée avec un autre secret, ou a été modifiée
function dechiffrer(b, lien) {
  if (!b || b.v !== 1 || !b.ct || !b.iv || !b.tag) return null;
  const k = cle('secrets');
  if (!k || b.k !== empreinte()) return null;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(b.iv, 'base64'));
    d.setAAD(Buffer.from('la-tour/studio/' + lien));
    d.setAuthTag(Buffer.from(b.tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(b.ct, 'base64')), d.final()]).toString('utf8');
  } catch (e) { return null; }
}
// la clé est-elle lisible avec le secret d'aujourd'hui ?
function lisible(b) { return !!(b && b.v === 1 && b.k === empreinte()); }

module.exports = { chiffrer, dechiffrer, lisible, cle, empreinte, disponible };
