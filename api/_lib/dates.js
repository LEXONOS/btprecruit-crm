// api/_lib/dates.js
// Dates timezone-safe côté serveur (récaps email).
// Règle : une date d'agenda est une JOURNÉE CALENDAIRE ("YYYY-MM-DD"),
// jamais un instant. On ne fait jamais new Date("YYYY-MM-DD") (=> minuit UTC,
// donc décalage d'un jour selon le fuseau). On compare des clés de jour.
//
// Fuseau métier configurable via la variable d'env CRM_TZ (défaut: Europe/Paris).
const TZ = process.env.CRM_TZ || 'Europe/Paris';

// Renvoie la clé jour YYYY-MM-DD d'une valeur (chaîne date seule, ISO, Date, ms),
// calculée dans le fuseau métier.
function dayKeyTZ(v, tz) {
  tz = tz || TZ;
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(0, 10);
  const d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d.getTime())) return (typeof v === 'string' ? v.slice(0, 10) : '');
  // en-CA => "YYYY-MM-DD"
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

// Clé jour d'aujourd'hui (fuseau métier).
function todayKeyTZ(tz) { return dayKeyTZ(new Date(), tz || TZ); }

module.exports = { TZ, dayKeyTZ, todayKeyTZ };
