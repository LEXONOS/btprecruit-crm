/* Lomaya · réservation en ligne
   Parle à la plateforme Novalem (/api/formulaire : site, creneaux, reserver ; code en préparation).
   Tant que l'espace « lomaya » n'est pas ouvert, un aperçu simulé suit exactement les règles du centre :
   2 bassins, séances de 1 h 30, départs décalés de 15 minutes, solo ou duo, tarifs d'ouverture. */
(function () {
  'use strict';
  var C = window.LOMAYA;
  if (!C) return;
  var FUSEAU = C.fuseau || 'America/Guadeloupe';
  var DECALAGE_UTC = '-04:00'; // la Guadeloupe ne change pas d'heure

  // ---------- Petits outils ----------
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'texte') e.textContent = v;
        else if (k === 'classe') e.className = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') for (var s in v) e.style.setProperty(s, v[s]);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) ajouter(e, arguments[i]);
    return e;
  }
  function ajouter(parent, enfant) {
    if (enfant == null || enfant === false) return;
    if (Array.isArray(enfant)) { enfant.forEach(function (c) { ajouter(parent, c); }); return; }
    parent.appendChild(typeof enfant === 'string' || typeof enfant === 'number' ? document.createTextNode(String(enfant)) : enfant);
  }
  function vider(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function icone(id) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#' + id);
    s.appendChild(u);
    s.setAttribute('aria-hidden', 'true');
    return s;
  }
  function euros(cts) {
    var entier = cts % 100 === 0;
    return (cts / 100).toLocaleString('fr-FR', { minimumFractionDigits: entier ? 0 : 2, maximumFractionDigits: 2 }) + ' €';
  }
  function centimesDe(prix) {
    if (typeof prix === 'number') return Math.round(prix * 100);
    var m = String(prix || '').replace(/\s/g, '').match(/(\d+)(?:[.,](\d{1,2}))?/);
    if (!m) return null;
    return Number(m[1]) * 100 + (m[2] ? Number((m[2] + '0').slice(0, 2)) : 0);
  }
  var fmtJour = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' });
  var fmtHeure = new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' });
  var fmtHeureNum = new Intl.DateTimeFormat('en-GB', { timeZone: FUSEAU, hour: '2-digit', hourCycle: 'h23' }); // « 09 » (le français écrirait « 09 h »)
  function jourLocal(date) { return fmtJour.format(date); }
  function ajouterJours(jour, n) { var d = new Date(jour + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function jourSemaine(jour) { return new Date(jour + 'T12:00:00Z').getUTCDay(); }
  function heure(iso) { return fmtHeure.format(new Date(iso)); }
  function heureTexte(iso) { var p = heure(iso).split(':'); return Number(p[0]) + ' h' + (p[1] === '00' ? '' : ' ' + p[1]); }
  function heureNombre(iso) { return Number(fmtHeureNum.format(new Date(iso))); }
  var JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function partsJour(jour) { var p = jour.split('-'); return { a: Number(p[0]), m: Number(p[1]) - 1, j: Number(p[2]) }; }
  function libelleLong(jour) { var p = partsJour(jour); return JOURS_LONGS[jourSemaine(jour)] + ' ' + p.j + ' ' + MOIS[p.m]; }
  function minutes(hhmm) { var p = hhmm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function hhmm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  function hachage(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  function attendre(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function cabineDe(id) { return (etat.vue && etat.vue.cabines || C.cabines).filter(function (c) { return c.id === id; })[0] || null; }

  function offreActive() {
    var o = C.offreOuverture || {};
    if (!o.actif) return false;
    if (o.fin && jourLocal(new Date()) > o.fin) return false;
    return true;
  }
  function prixFormule(f) { return offreActive() && f.prixOuverture ? f.prixOuverture : f.prix; }

  function apercuAutorise() {
    var hote = location.hostname;
    return /(^|\.)vercel\.app$|^localhost$|^127\.0\.0\.1$|claudeusercontent|claude\.ai$|^$/.test(hote) || /[?&]apercu=1/.test(location.search) || location.protocol === 'file:';
  }

  // ---------- La plateforme Novalem ----------
  function apiPlateforme() {
    var base = String(C.reservation.plateforme || '').replace(/\/$/, '') + '/api/formulaire';
    var slug = encodeURIComponent(C.reservation.espace || '');
    function lire(url) {
      return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error((j && j.erreur) || 'Indisponible pour le moment.'); e.status = r.status; e.code = j && j.code; throw e; }
          return j;
        });
      });
    }
    return {
      mode: 'plateforme',
      info: function () { return lire(base + '?quoi=site&espace=' + slug); },
      creneaux: function (q) { return lire(base + '?quoi=creneaux&espace=' + slug + '&prestation=' + encodeURIComponent(q.prestation) + (q.depuis ? '&depuis=' + q.depuis : '') + '&jours=' + (q.jours || 7)); },
      code: function (q) { return lire(base + '?quoi=code&espace=' + slug + '&code=' + encodeURIComponent(q.code) + '&prestation=' + encodeURIComponent(q.prestation)); },
      reserver: function (corps) {
        corps.quoi = 'reserver';
        corps.espace = C.reservation.espace;
        return fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }).then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (!r.ok) { var e = new Error((j && j.erreur) || 'Réservation impossible pour le moment.'); e.code = j && j.code; throw e; }
            return j;
          });
        });
      },
    };
  }

  // ---------- L'aperçu simulé, aux règles du centre ----------
  function apiApercu() {
    var CLE = 'lomaya-apercu-pris';
    function pris() { try { return JSON.parse(sessionStorage.getItem(CLE) || '[]'); } catch (e) { return []; } }
    function noterPris(cle) { try { var l = pris(); l.push(cle); sessionStorage.setItem(CLE, JSON.stringify(l)); } catch (e) { /* navigation privée */ } }
    function premierJour() { var a = jourLocal(new Date()); return C.ouverture && C.ouverture > a ? C.ouverture : a; }
    return {
      mode: 'apercu',
      info: function () {
        return Promise.resolve({
          entreprise: { nom: 'Lomaya', horaires_texte: null },
          prestations: C.formules.map(function (f) {
            return { id: f.id, nom: f.nom, duree: C.dureeMinutes, detail: f.detail, prix: euros(prixFormule(f)), prix_centimes: prixFormule(f), prix_normal_centimes: f.prix, personnes: f.personnes };
          }),
          cabines: C.cabines,
          paiement: { actif: true, mode: C.paiement.mode, acompte_centimes: C.paiement.acompteCentimes },
          rdv: { fuseau: FUSEAU, horizon_jours: C.horizonJours, validation: 'auto' },
        });
      },
      creneaux: function (q) {
        var limite = Date.now() + C.delaiMinHeures * 3600000;
        var debut = q.depuis && q.depuis > premierJour() ? q.depuis : premierJour();
        var horizon = ajouterJours(premierJour(), C.horizonJours);
        var dejaPris = pris();
        var jours = [];
        for (var i = 0; i < (q.jours || 7); i++) {
          var jour = ajouterJours(debut, i);
          if (jour > horizon) break;
          var plage = C.horaires[jourSemaine(jour)];
          if (!plage) { jours.push({ jour: jour, ferme: true, creneaux: [] }); continue; }
          var liste = [];
          C.cabines.forEach(function (cab) {
            for (var t = minutes(plage[0]) + (cab.decalage || 0); t + C.dureeMinutes <= minutes(plage[1]); t += C.dureeMinutes) {
              var iso = jour + 'T' + hhmm(t) + ':00' + DECALAGE_UTC;
              if (Date.parse(iso) < limite) continue;
              if (hachage(jour + cab.id + t) % 100 < 30) continue; // séances déjà prises (simulées)
              if (dejaPris.indexOf(iso + '|' + cab.id) >= 0) continue;
              liste.push({ debut: iso, fin: new Date(Date.parse(iso) + C.dureeMinutes * 60000).toISOString(), cabine: cab.id });
            }
          });
          liste.sort(function (a, b) { return Date.parse(a.debut) - Date.parse(b.debut); });
          jours.push({ jour: jour, ferme: false, creneaux: liste });
        }
        return attendre(380).then(function () { return { depuis: debut, jours: jours, horizon: horizon, premier: premierJour(), fuseau: FUSEAU }; });
      },
      code: function (q) {
        var code = q.code.replace(/[\s-]/g, '').toUpperCase();
        return attendre(450).then(function () {
          if (code === '123ABC') return { valide: true, type: 'carte', libelle: 'Carte cadeau', couvre: true };
          if (code === 'BIENVENUE') return { valide: true, type: 'promo', libelle: 'Code BIENVENUE', pourcentage: 10 };
          return { valide: false, message: 'Ce code n’est pas reconnu. Vérifiez-le ou appelez-nous.' };
        });
      },
      reserver: function (corps) {
        return attendre(1100).then(function () {
          noterPris(corps.debut + '|' + corps.cabine);
          return { rendez_vous: { confirme: true }, apercu: true };
        });
      },
    };
  }

  // ---------- État ----------
  var etat = {
    api: null, vue: null, pret: null, indisponible: false,
    etape: 1, formule: null, depuis: null, jours: [], horizon: null, premier: null, jour: null, creneau: null,
    client: { nom: '', telephone: '', email: '', premiere: false, message: '', accord: false },
    code: { saisi: '', resultat: null, verification: false },
    envoi: false, ouvert: false, declencheur: null, notice: null,
  };

  function demarrer() {
    if (etat.pret) return etat.pret;
    var mode = (C.reservation && C.reservation.mode) || 'auto';
    var plateforme = apiPlateforme();
    if (mode === 'apercu') {
      etat.api = apiApercu();
    } else {
      etat.api = plateforme;
    }
    etat.pret = etat.api.info().then(function (vue) {
      etat.vue = vue;
      document.dispatchEvent(new CustomEvent('lomaya:info', { detail: vue }));
      return vue;
    }).catch(function () {
      if (mode === 'auto' && apercuAutorise()) {
        etat.api = apiApercu();
        return etat.api.info().then(function (vue) { etat.vue = vue; return vue; });
      }
      etat.indisponible = true;
      return null;
    });
    return etat.pret;
  }

  // ---------- Le panneau ----------
  var dom = {};
  function construire() {
    if (dom.racine) return;
    dom.titre = h('h2', { classe: 'resa__titre', id: 'resa-titre', texte: 'Réserver ma séance' });
    dom.etapes = h('ol', { classe: 'resa__etapes', 'aria-label': 'Étapes' },
      ['Formule', 'Créneau', 'Vous', 'Paiement'].map(function (t, i) { return h('li', { 'data-i': i + 1, texte: t }); }));
    dom.fermer = h('button', { classe: 'resa__fermer', type: 'button', 'aria-label': 'Fermer', onclick: fermer }, icone('i-fermer'));
    dom.corps = h('div', { classe: 'resa__corps' });
    dom.retour = h('button', { classe: 'resa__retour', type: 'button', texte: 'Retour', onclick: precedent });
    dom.suivant = h('button', { classe: 'bouton bouton--plein bouton--grand', type: 'button', onclick: suivant });
    dom.pied = h('div', { classe: 'resa__pied' }, dom.retour, dom.suivant);
    dom.panneau = h('div', { classe: 'resa__panneau', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'resa-titre' },
      h('div', { classe: 'resa__tete' }, h('div', { classe: 'resa__haut' }, dom.titre, dom.fermer), dom.etapes),
      dom.corps, dom.pied);
    dom.racine = h('div', { classe: 'resa', id: 'resa', hidden: true },
      h('div', { classe: 'resa__voile', onclick: fermer }), dom.panneau);
    document.body.appendChild(dom.racine);
    // icône de fermeture ajoutée au sprite
    var sprite = document.querySelector('svg[aria-hidden="true"][width="0"]');
    if (sprite && !document.getElementById('i-fermer')) {
      var sym = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
      sym.setAttribute('id', 'i-fermer'); sym.setAttribute('viewBox', '0 0 24 24');
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M6 6l12 12M18 6 6 18'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.8'); p.setAttribute('stroke-linecap', 'round');
      sym.appendChild(p); sprite.appendChild(sym);
      ['i-gauche', 'i-droite'].forEach(function (id, i) {
        var s = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
        s.setAttribute('id', id); s.setAttribute('viewBox', '0 0 24 24');
        var q = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        q.setAttribute('d', i ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'); q.setAttribute('fill', 'none'); q.setAttribute('stroke', 'currentColor'); q.setAttribute('stroke-width', '1.8'); q.setAttribute('stroke-linecap', 'round'); q.setAttribute('stroke-linejoin', 'round');
        s.appendChild(q); sprite.appendChild(s);
      });
    }
    dom.racine.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); fermer(); return; }
      if (ev.key === 'Tab') pieger(ev);
    });
  }

  function pieger(ev) {
    var f = Array.prototype.filter.call(dom.panneau.querySelectorAll('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])'), function (e) { return !e.disabled && e.offsetParent !== null; });
    if (!f.length) return;
    var premier = f[0], dernier = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === premier) { ev.preventDefault(); dernier.focus(); }
    else if (!ev.shiftKey && document.activeElement === dernier) { ev.preventDefault(); premier.focus(); }
  }

  function ouvrir(options) {
    options = options || {};
    construire();
    etat.declencheur = document.activeElement;
    if (!etat.ouvert) {
      dom.racine.hidden = false;
      document.body.classList.add('verrou');
      requestAnimationFrame(function () { requestAnimationFrame(function () { dom.racine.classList.add('est-ouverte'); }); });
      etat.ouvert = true;
      document.dispatchEvent(new CustomEvent('lomaya:resa', { detail: { ouvert: true } }));
    }
    if (options.succesRetour) { rendreSuccesRetour(); return; }
    if (etat.etape === 'succes') reinitialiser();
    etat.notice = options.notice || null;
    afficherChargement();
    demarrer().then(function () {
      if (etat.indisponible) { rendreIndisponible(); return; }
      if (options.formule) {
        var f = trouverFormule(options.formule);
        if (f) { etat.formule = f; etat.etape = 2; etat.jour = null; etat.creneau = null; etat.depuis = null; rendre(); chargerCreneaux(); return; }
      }
      rendre();
    });
    setTimeout(function () { dom.fermer.focus(); }, 60);
  }

  function fermer() {
    if (!etat.ouvert) return;
    dom.racine.classList.remove('est-ouverte');
    document.body.classList.remove('verrou');
    etat.ouvert = false;
    document.dispatchEvent(new CustomEvent('lomaya:resa', { detail: { ouvert: false } }));
    setTimeout(function () { if (!etat.ouvert) dom.racine.hidden = true; }, 500);
    if (etat.declencheur && etat.declencheur.focus) etat.declencheur.focus();
    if (location.hash === '#reserver-en-ligne') history.replaceState(null, '', location.pathname + location.search);
  }

  function reinitialiser() {
    etat.etape = 1; etat.formule = null; etat.jour = null; etat.creneau = null; etat.depuis = null; etat.jours = [];
    etat.code = { saisi: '', resultat: null, verification: false };
    etat.envoi = false;
  }

  function trouverFormule(id) {
    var liste = (etat.vue && etat.vue.prestations) || [];
    id = String(id).toLowerCase();
    return liste.filter(function (p) { return String(p.id).toLowerCase() === id || (id === 'duo' ? /duo/i.test(p.nom) : id === 'solo' ? /solo/i.test(p.nom) : false); })[0] || null;
  }

  function afficherChargement() {
    vider(dom.corps);
    dom.pied.hidden = true;
    dom.corps.appendChild(h('div', { classe: 'chargement', 'aria-label': 'Chargement' }, h('span'), h('span'), h('span')));
  }

  function bandeauApercu() {
    if (!etat.api || etat.api.mode !== 'apercu') return null;
    return h('div', { classe: 'resa__apercu', role: 'note' },
      h('span', null, h('b', { texte: 'Aperçu' }), ' : la réservation est simulée, rien n’est réservé ni payé. Pour essayer : carte cadeau ', h('code', { texte: '123ABC' }), ', code promo ', h('code', { texte: 'BIENVENUE' }), '.'));
  }

  function majEtapes() {
    Array.prototype.forEach.call(dom.etapes.children, function (li) {
      var i = Number(li.getAttribute('data-i'));
      li.classList.toggle('est-active', etat.etape === i);
      li.classList.toggle('est-faite', etat.etape === 'succes' || (typeof etat.etape === 'number' && i < etat.etape));
      if (etat.etape === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  function rendre() {
    majEtapes();
    vider(dom.corps);
    dom.pied.hidden = false;
    dom.retour.style.visibility = etat.etape > 1 ? 'visible' : 'hidden';
    ajouter(dom.corps, bandeauApercu());
    if (etat.notice) dom.corps.appendChild(h('div', { classe: 'resa__apercu', role: 'status' }, h('span', { texte: etat.notice })));
    if (etat.etape === 1) rendreFormules();
    else if (etat.etape === 2) rendreCreneaux();
    else if (etat.etape === 3) rendreClient();
    else if (etat.etape === 4) rendrePaiement();
    dom.corps.scrollTop = 0;
  }

  function suivant() {
    if (etat.etape === 1 && etat.formule) { etat.etape = 2; etat.notice = null; rendre(); chargerCreneaux(); return; }
    if (etat.etape === 2 && etat.creneau) { etat.etape = 3; rendre(); return; }
    if (etat.etape === 3) { if (validerClient()) { etat.etape = 4; rendre(); } return; }
    if (etat.etape === 4) envoyer();
  }
  function precedent() {
    if (etat.etape > 1) { etat.etape -= 1; rendre(); if (etat.etape === 2) rendreJoursEtHeures(); }
  }

  // ----- Étape 1 : la formule -----
  function rendreFormules() {
    dom.corps.appendChild(h('h3', { texte: 'Seul ou à deux ?' }));
    dom.corps.appendChild(h('p', { classe: 'resa__intro', texte: 'Chaque séance dure 1 h 30, dont 1 h entière de flottaison. Nos deux bassins accueillent une ou deux personnes.' }));
    var liste = h('div', { classe: 'formules', role: 'group', 'aria-label': 'Formule' });
    (etat.vue.prestations || []).forEach(function (p) {
      var duo = /duo/i.test(p.nom) || p.personnes === 2;
      var normal = p.prix_normal_centimes, actuel = p.prix_centimes;
      var prix = h('span', { classe: 'formule__prix' }, p.prix || '', normal && actuel && normal > actuel ? h('s', { texte: euros(normal) }) : null);
      liste.appendChild(h('button', {
        classe: 'formule', type: 'button', 'aria-pressed': etat.formule && etat.formule.id === p.id ? 'true' : 'false',
        onclick: function () { etat.formule = p; rendre(); },
      }, h('span', { classe: 'formule__icone' }, icone(duo ? 'i-duo' : 'i-solo')),
        h('span', null, h('strong', { texte: p.nom }), h('small', { texte: p.detail || (p.duree ? p.duree + ' min' : '') })), prix));
    });
    dom.corps.appendChild(liste);
    dom.corps.appendChild(h('p', { classe: 'resa__aide', texte: 'Une carte cadeau ou un abonnement ? Vous indiquerez votre code à l’étape du paiement.' }));
    dom.suivant.textContent = 'Choisir mon créneau';
    dom.suivant.disabled = !etat.formule;
  }

  // ----- Étape 2 : le jour et l'heure -----
  function chargerCreneaux() {
    etat.chargement = true;
    rendreJoursEtHeures();
    var demande = etat.depuis;
    etat.api.creneaux({ prestation: etat.formule.id, depuis: etat.depuis, jours: 7 }).then(function (r) {
      if (demande !== etat.depuis) return;
      etat.chargement = false;
      etat.jours = r.jours || [];
      etat.horizon = r.horizon || null;
      if (!etat.premier) etat.premier = r.premier || r.depuis;
      if (!etat.depuis) etat.depuis = r.depuis;
      if (!etat.jour || !etat.jours.some(function (j) { return j.jour === etat.jour; })) {
        var libre = etat.jours.filter(function (j) { return j.creneaux && j.creneaux.length; })[0];
        etat.jour = libre ? libre.jour : null;
      }
      rendreJoursEtHeures();
    }).catch(function (e) {
      etat.chargement = false;
      etat.jours = [];
      etat.erreurCreneaux = e.message || 'Les créneaux ne peuvent pas être lus pour le moment.';
      rendreJoursEtHeures();
    });
  }

  function rendreCreneaux() {
    dom.corps.appendChild(h('h3', { texte: 'Le jour et l’heure' }));
    dom.zoneCreneaux = h('div');
    dom.corps.appendChild(dom.zoneCreneaux);
    dom.suivant.textContent = 'Continuer';
    dom.suivant.disabled = !etat.creneau;
    rendreJoursEtHeures();
  }

  function rendreJoursEtHeures() {
    var zone = dom.zoneCreneaux;
    if (!zone || etat.etape !== 2) return;
    vider(zone);
    dom.suivant.disabled = !etat.creneau;
    if ((etat.chargement || !etat.depuis) && !etat.jours.length && !etat.erreurCreneaux) {
      // pas encore de semaine chargée : squelette en attendant les créneaux
      zone.appendChild(h('div', { classe: 'chargement' }, h('span'), h('span'), h('span')));
      return;
    }
    if (etat.erreurCreneaux && !etat.jours.length) {
      zone.appendChild(h('p', { classe: 'vide', texte: etat.erreurCreneaux }));
      etat.erreurCreneaux = null;
      return;
    }
    var premier = etat.jours.length ? etat.jours[0].jour : etat.depuis;
    var dernier = etat.jours.length ? etat.jours[etat.jours.length - 1].jour : premier;
    var p1 = partsJour(premier), p2 = partsJour(dernier);
    var titreMois = p1.m === p2.m ? MOIS[p1.m] + ' ' + p1.a : MOIS_COURTS[p1.m] + ' – ' + MOIS_COURTS[p2.m] + ' ' + p2.a;
    var avant = h('button', { type: 'button', 'aria-label': 'Semaine précédente', disabled: !etat.premier || premier <= etat.premier, onclick: function () { changerSemaine(-7); } }, icone('i-gauche'));
    var apres = h('button', { type: 'button', 'aria-label': 'Semaine suivante', disabled: !!etat.horizon && ajouterJours(premier, 7) > etat.horizon, onclick: function () { changerSemaine(7); } }, icone('i-droite'));
    zone.appendChild(h('div', { classe: 'mois' }, h('strong', { texte: titreMois.replace('–', '-') }), h('div', null, avant, apres)));

    var bande = h('div', { classe: 'jours', role: 'group', 'aria-label': 'Jour' });
    etat.jours.forEach(function (j) {
      var n = (j.creneaux || []).length, p = partsJour(j.jour);
      bande.appendChild(h('button', {
        classe: 'jour', type: 'button', disabled: !n, 'aria-pressed': etat.jour === j.jour ? 'true' : 'false',
        'aria-label': libelleLong(j.jour) + (n ? ', ' + n + ' créneau' + (n > 1 ? 'x' : '') : j.ferme ? ', fermé' : ', complet'),
        onclick: function () { etat.jour = j.jour; etat.creneau = null; rendreJoursEtHeures(); },
      }, h('small', { texte: JOURS[jourSemaine(j.jour)] }), h('b', { texte: String(p.j) }), h('i', { texte: n ? n + ' libre' + (n > 1 ? 's' : '') : j.ferme ? 'fermé' : 'complet' })));
    });
    zone.appendChild(bande);

    if (etat.chargement) { zone.appendChild(h('div', { classe: 'chargement' }, h('span'), h('span'))); return; }
    var jour = etat.jours.filter(function (j) { return j.jour === etat.jour; })[0];
    if (!jour) {
      zone.appendChild(h('p', { classe: 'vide', texte: etat.jours.length ? 'Aucun créneau libre cette semaine : regardez la semaine suivante.' : 'Aucun créneau à afficher pour le moment.' }));
      return;
    }
    var avecCabines = jour.creneaux.some(function (c) { return c.cabine; });
    if (avecCabines) {
      var cabs = (etat.vue.cabines || C.cabines);
      zone.appendChild(h('div', { classe: 'cabines-legende' }, cabs.map(function (c) {
        return h('span', null, h('i', { classe: 'point-cabine', style: { '--c': c.couleur } }), c.nom);
      })));
    }
    var moments = [{ nom: 'Matin', de: 0, a: 12 }, { nom: 'Après-midi', de: 12, a: 17 }, { nom: 'Soir', de: 17, a: 24 }];
    moments.forEach(function (m) {
      var liste = jour.creneaux.filter(function (c) { var hh = heureNombre(c.debut); return hh >= m.de && hh < m.a; });
      if (!liste.length) return;
      var grille = h('div', { classe: 'heures', role: 'group', 'aria-label': m.nom });
      liste.forEach(function (c) {
        var cab = c.cabine ? cabineDe(c.cabine) : null;
        var choisi = etat.creneau && etat.creneau.debut === c.debut && (etat.creneau.cabine || null) === (c.cabine || null);
        grille.appendChild(h('button', {
          classe: 'heure', type: 'button', 'aria-pressed': choisi ? 'true' : 'false',
          'aria-label': heureTexte(c.debut) + (cab ? ', ' + cab.nom : ''),
          onclick: function () { etat.creneau = c; rendreJoursEtHeures(); dom.suivant.focus({ preventScroll: true }); },
        }, cab ? h('i', { classe: 'point-cabine', style: { '--c': cab.couleur } }) : null, heure(c.debut)));
      });
      zone.appendChild(h('div', { classe: 'moment' }, h('p', { texte: m.nom }), grille));
    });
    if (etat.erreur) { zone.appendChild(h('p', { classe: 'erreur', role: 'alert', texte: etat.erreur })); etat.erreur = null; }
  }

  function changerSemaine(n) {
    var base = etat.jours.length ? etat.jours[0].jour : etat.depuis;
    etat.depuis = ajouterJours(base, n);
    if (etat.premier && etat.depuis < etat.premier) etat.depuis = etat.premier;
    etat.jour = null;
    etat.creneau = null;
    chargerCreneaux();
  }

  // ----- Étape 3 : les coordonnées -----
  function champ(id, libelle, attrs, aide) {
    var input = h(attrs.multiline ? 'textarea' : 'input', Object.assign({ id: id, name: id }, attrs.multiline ? { rows: 3, maxlength: 600 } : {}, attrs.input));
    return { boite: h('div', { classe: 'champ' }, h('label', { for: id }, libelle, aide ? h('span', { texte: ' ' + aide }) : null), input), input: input };
  }
  function rendreClient() {
    var c = etat.client;
    dom.corps.appendChild(h('h3', { texte: 'Vos coordonnées' }));
    dom.corps.appendChild(h('p', { classe: 'resa__intro', texte: 'Pour vous confirmer la séance et vous envoyer un rappel.' }));
    var nom = champ('resa-nom', 'Prénom et nom', { input: { autocomplete: 'name', maxlength: 120, value: c.nom, required: true } });
    var tel = champ('resa-tel', 'Téléphone', { input: { type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '0690 12 34 56', value: c.telephone, required: true } }, '(WhatsApp de préférence)');
    var mail = champ('resa-mail', 'E-mail', { input: { type: 'email', autocomplete: 'email', value: c.email, placeholder: 'pour recevoir votre reçu' } }, '(facultatif)');
    var msg = champ('resa-msg', 'Un mot pour nous', { multiline: true, input: { placeholder: 'Une question, une précision…' } }, '(facultatif)');
    msg.input.value = c.message;
    var premiere = h('input', { type: 'checkbox', id: 'resa-premiere' }); premiere.checked = c.premiere;
    var accord = h('input', { type: 'checkbox', id: 'resa-accord', required: true }); accord.checked = c.accord;
    var piege = h('input', { classe: 'piege', name: 'site_web', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    dom.erreurClient = h('p', { classe: 'erreur', role: 'alert' });
    dom.champs = { nom: nom, tel: tel, mail: mail, msg: msg, premiere: premiere, accord: accord, piege: piege };
    dom.corps.appendChild(h('div', { classe: 'champs' },
      nom.boite,
      h('div', { classe: 'deux' }, tel.boite, mail.boite),
      h('label', { classe: 'case', for: 'resa-premiere' }, premiere, h('span', { texte: 'C’est ma première séance de flottaison : on prendra le temps de tout vous expliquer.' })),
      msg.boite,
      h('label', { classe: 'case', for: 'resa-accord' }, accord, h('span', null, 'J’ai lu les ', h('a', { href: '#infos', onclick: function () { fermer(); } , texte: 'contre-indications' }), ' et j’accepte les ', h('a', { href: 'cgv.html', target: '_blank', texte: 'conditions de vente' }), ' (annulation gratuite jusqu’à ' + C.annulationHeures + ' h avant).')),
      piege, dom.erreurClient));
    dom.suivant.textContent = 'Continuer';
    dom.suivant.disabled = false;
    [nom.input, tel.input, mail.input].forEach(function (i) { i.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); suivant(); } }); });
    setTimeout(function () { if (!c.nom) nom.input.focus(); }, 80);
  }
  function telephoneValide(t) {
    var chiffres = t.replace(/[^\d+]/g, '');
    return /^(\+?\d{9,15})$/.test(chiffres);
  }
  function validerClient() {
    var d = dom.champs, c = etat.client;
    c.nom = d.nom.input.value.trim(); c.telephone = d.tel.input.value.trim(); c.email = d.mail.input.value.trim();
    c.message = d.msg.input.value.trim(); c.premiere = d.premiere.checked; c.accord = d.accord.checked; c.piege = d.piege.value;
    [d.nom, d.tel, d.mail].forEach(function (x) { x.boite.classList.remove('champ--erreur'); });
    var e = null, cible = null;
    if (c.nom.length < 2) { e = 'Indiquez votre prénom et votre nom.'; cible = d.nom; }
    else if (!telephoneValide(c.telephone)) { e = 'Indiquez un numéro de téléphone valide, pour la confirmation et le rappel.'; cible = d.tel; }
    else if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) { e = 'Cette adresse e-mail semble incomplète.'; cible = d.mail; }
    else if (!c.accord) { e = 'Merci de confirmer que vous avez lu les contre-indications et les conditions de vente.'; }
    dom.erreurClient.textContent = e || '';
    if (cible) { cible.boite.classList.add('champ--erreur'); cible.input.focus(); }
    else if (e) d.accord.focus();
    return !e;
  }

  // ----- Étape 4 : le récapitulatif et le paiement -----
  function montants() {
    var f = etat.formule;
    var base = f.prix_centimes != null ? f.prix_centimes : centimesDe(f.prix) || 0;
    var r = etat.code.resultat, remise = 0;
    if (r && r.valide) {
      if (r.couvre) remise = base;
      else if (r.pourcentage) remise = Math.round(base * r.pourcentage / 100);
      else if (r.remise_centimes) remise = Math.min(base, r.remise_centimes);
    }
    var total = Math.max(0, base - remise);
    var pv = etat.vue.paiement;
    var enLigne = pv ? pv.actif !== false : false;
    var maintenant = total;
    if (enLigne && pv.mode === 'acompte' && pv.acompte_centimes) maintenant = Math.min(total, pv.acompte_centimes);
    return { base: base, remise: remise, total: total, maintenant: enLigne ? maintenant : 0, enLigne: enLigne };
  }

  function carteRecap() {
    var c = etat.creneau, p = partsJour(etat.jour), cab = c.cabine ? cabineDe(c.cabine) : null;
    var fin = new Date(Date.parse(c.debut) + (etat.formule.duree || C.dureeMinutes) * 60000).toISOString();
    return h('div', { classe: 'recap__haut' },
      h('div', { classe: 'recap__date' }, h('small', { texte: JOURS[jourSemaine(etat.jour)] + ' ' + MOIS_COURTS[p.m] }), h('b', { texte: String(p.j) })),
      h('div', null,
        h('strong', { texte: etat.formule.nom }),
        h('span', null, heureTexte(c.debut) + ' à ' + heureTexte(fin), cab ? h('i', { classe: 'point-cabine', style: { '--c': cab.couleur } }) : null, cab ? cab.nom : null)));
  }

  function rendrePaiement() {
    var m = montants();
    dom.corps.appendChild(h('h3', { texte: 'Récapitulatif' }));
    var lignes = h('div', { classe: 'recap__lignes' },
      h('div', null, h('span', { texte: etat.formule.nom }), h('span', { texte: euros(m.base) })));
    if (m.remise) lignes.appendChild(h('div', { classe: 'remise' }, h('span', { texte: etat.code.resultat.libelle || 'Réduction' }), h('span', { texte: '-' + euros(m.remise) })));
    if (m.enLigne && m.maintenant < m.total) lignes.appendChild(h('div', null, h('span', { texte: 'Reste à régler au centre' }), h('span', { texte: euros(m.total - m.maintenant) })));
    var totalLibelle = m.enLigne ? (m.maintenant < m.total ? 'Acompte à régler maintenant' : 'À régler maintenant') : 'À régler au centre';
    dom.corps.appendChild(h('div', { classe: 'recap' }, carteRecap(), lignes,
      h('div', { classe: 'recap__total' }, h('span', { texte: totalLibelle }), h('b', { texte: euros(m.enLigne ? m.maintenant : m.total) }))));

    // Le code : carte cadeau, abonnement ou code promo
    var input = h('input', { id: 'resa-code', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: 24, placeholder: 'ex. 482 KLM', value: etat.code.saisi });
    var retour = h('p', { classe: 'code__retour', 'aria-live': 'polite' });
    var r = etat.code.resultat;
    if (r) { retour.textContent = r.valide ? (r.couvre ? r.libelle + ' acceptée : la séance est couverte.' : r.libelle + ' appliqué.') : (r.message || 'Code non reconnu.'); retour.className = 'code__retour ' + (r.valide ? 'ok' : 'non'); }
    var bouton = h('button', { classe: 'bouton bouton--contour', type: 'button', texte: etat.code.verification ? '…' : 'Appliquer', disabled: etat.code.verification, onclick: function () { verifierCode(input.value); } });
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); verifierCode(input.value); } });
    dom.corps.appendChild(h('div', { classe: 'champ' }, h('label', { for: 'resa-code' }, 'Carte cadeau, abonnement ou code promo', h('span', { texte: ' (facultatif)' })), h('div', { classe: 'code' }, input, bouton), retour));

    if (m.enLigne) {
      dom.corps.appendChild(h('p', { classe: 'securite' }, icone('i-cadenas'), 'Paiement sécurisé par carte bancaire. Lomaya n’a jamais accès à votre numéro de carte.'));
    } else {
      dom.corps.appendChild(h('p', { classe: 'securite' }, icone('i-cadenas'), 'Votre séance est réservée tout de suite, le règlement se fait au centre.'));
    }
    dom.corps.appendChild(h('p', { classe: 'politique', texte: 'Annulation gratuite jusqu’à ' + C.annulationHeures + ' h avant la séance. Passé ce délai, ou en cas d’absence, le montant réglé reste acquis.' }));
    dom.erreurEnvoi = h('p', { classe: 'erreur', role: 'alert' });
    dom.corps.appendChild(dom.erreurEnvoi);
    dom.suivant.disabled = etat.envoi;
    dom.suivant.textContent = etat.envoi ? 'Un instant…' : (m.enLigne && m.maintenant > 0 ? 'Payer ' + euros(m.maintenant) + ' et confirmer' : 'Confirmer ma réservation');
  }

  function verifierCode(valeur) {
    var code = String(valeur || '').trim();
    etat.code.saisi = code;
    if (!code) { etat.code.resultat = null; rendre(); return; }
    etat.code.verification = true;
    rendre();
    etat.api.code({ code: code, prestation: etat.formule.id }).then(function (r) {
      etat.code.resultat = r;
    }).catch(function (e) {
      // La plateforme ne sait pas encore vérifier les codes : il part avec la réservation et sera vérifié par l'équipe
      etat.code.resultat = e && (e.status === 404 || e.status === 400) && !e.code
        ? { valide: false, message: 'Le code sera vérifié par l’équipe et déduit au centre.', attente: true }
        : { valide: false, message: (e && e.message) || 'Vérification impossible pour le moment.' };
    }).then(function () { etat.code.verification = false; rendre(); });
  }

  function envoyer() {
    if (etat.envoi) return;
    var c = etat.client, m = montants();
    etat.envoi = true;
    rendre();
    var details = ['Formule : ' + etat.formule.nom];
    if (c.premiere) details.push('Première séance : oui');
    if (etat.code.saisi) details.push('Code : ' + etat.code.saisi.toUpperCase());
    if (etat.creneau.cabine) { var cab = cabineDe(etat.creneau.cabine); if (cab) details.push(cab.nom); }
    if (c.message) details.push('Message : ' + c.message);
    var corps = {
      prestation: etat.formule.id,
      debut: etat.creneau.debut,
      personne: etat.creneau.personne_id || null,
      cabine: etat.creneau.cabine || null,
      nom: c.nom, telephone: c.telephone, email: c.email,
      message: details.join(' · ').slice(0, 1000),
      code: etat.code.saisi ? etat.code.saisi.toUpperCase() : null,
      premiere: c.premiere,
      montant_attendu: m.enLigne ? m.maintenant : null,
      site_web: c.piege || '',
      page: location.href.split('#')[0].slice(0, 200),
      retour_ok: location.origin + location.pathname + '?reservation=ok',
      retour_annule: location.origin + location.pathname + '?reservation=annulee',
    };
    etat.api.reserver(corps).then(function (res) {
      if (res && res.paiement_url) { location.assign(res.paiement_url); return; }
      etat.envoi = false;
      etat.etape = 'succes';
      rendreSucces(res || {});
    }).catch(function (e) {
      etat.envoi = false;
      if (e && e.code === 'creneau_pris') {
        etat.etape = 2; etat.creneau = null;
        etat.erreur = e.message || 'Ce créneau vient d’être pris. Choisissez-en un autre.';
        rendre(); chargerCreneaux();
        return;
      }
      rendre();
      dom.erreurEnvoi.textContent = (e && e.message) || 'La réservation n’a pas pu aboutir. Réessayez ou appelez-nous au ' + C.contact.telephone + '.';
    });
  }

  // ----- Confirmation -----
  function anneau() {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('class', 'succes__anneau'); s.setAttribute('aria-hidden', 'true');
    var c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', '46');
    var p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'M31 51l13 13 26-28');
    s.appendChild(c); s.appendChild(p);
    return s;
  }

  function fichierAgenda() {
    var debut = new Date(etat.creneau.debut), fin = new Date(debut.getTime() + (etat.formule.duree || C.dureeMinutes) * 60000);
    function f(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    var lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lomaya//Reservation//FR', 'BEGIN:VEVENT',
      'UID:' + f(debut) + '-' + Math.random().toString(36).slice(2) + '@lomaya', 'DTSTAMP:' + f(new Date()),
      'DTSTART:' + f(debut), 'DTEND:' + f(fin), 'SUMMARY:' + etat.formule.nom + ' · Lomaya',
      'LOCATION:' + C.contact.adresse.replace(/,/g, '\\,'),
      'DESCRIPTION:Arrivez 10 minutes avant. Annulation gratuite jusqu\'à ' + C.annulationHeures + ' h avant au ' + C.contact.telephone + '.',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Séance Lomaya dans 2 heures', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'];
    var blob = new Blob([lignes.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    return URL.createObjectURL(blob);
  }

  function rendreSucces(res) {
    majEtapes();
    vider(dom.corps);
    dom.pied.hidden = true;
    var rv = res.rendez_vous || {};
    var aConfirmer = rv.confirme === false;
    var boite = h('div', { classe: 'succes', role: 'status' }, anneau(),
      h('h3', { texte: aConfirmer ? 'Demande bien reçue' : 'C’est réservé !' }),
      h('p', { texte: aConfirmer ? 'Nous confirmons votre séance très vite, par WhatsApp ou par e-mail.' : 'Votre confirmation arrive par WhatsApp ou par e-mail.' + (C.rappel48h ? ' Un rappel vous sera envoyé 48 h avant.' : '') }),
      h('div', { classe: 'recap' }, carteRecap()),
      h('div', { classe: 'succes__actions' },
        h('a', { classe: 'bouton bouton--plein', href: fichierAgenda(), download: 'seance-lomaya.ics' }, icone('i-agenda'), 'Ajouter à mon agenda'),
        h('a', { classe: 'bouton bouton--clair', href: '#infos', onclick: function () { fermer(); } }, 'Préparer ma séance')));
    if (res.apercu) boite.appendChild(h('p', { classe: 'politique', texte: 'Aperçu : cette réservation est simulée, rien n’a été réservé ni payé.' }));
    if (res.message) boite.insertBefore(h('p', { texte: res.message }), boite.children[3]);
    dom.corps.appendChild(boite);
  }

  function rendreSuccesRetour() {
    etat.etape = 'succes';
    majEtapes();
    vider(dom.corps);
    dom.pied.hidden = true;
    dom.corps.appendChild(h('div', { classe: 'succes', role: 'status' }, anneau(),
      h('h3', { texte: 'Paiement reçu, c’est réservé !' }),
      h('p', { texte: 'Votre confirmation arrive par WhatsApp ou par e-mail.' + (C.rappel48h ? ' Un rappel vous sera envoyé 48 h avant.' : '') + ' À très vite chez Lomaya.' }),
      h('div', { classe: 'succes__actions' }, h('a', { classe: 'bouton bouton--clair', href: '#infos', onclick: function () { fermer(); } }, 'Préparer ma séance'))));
  }

  function rendreIndisponible() {
    majEtapes();
    vider(dom.corps);
    dom.pied.hidden = true;
    dom.corps.appendChild(h('div', { classe: 'succes' },
      h('h3', { texte: 'Réservez par téléphone ou WhatsApp' }),
      h('p', { texte: 'La réservation en ligne est momentanément indisponible. Nous vous répondons tout de suite :' }),
      h('div', { classe: 'succes__actions' },
        h('a', { classe: 'bouton bouton--plein', href: 'tel:' + C.contact.telephoneIntl }, icone('i-tel'), 'Appeler le ' + C.contact.telephone),
        h('a', { classe: 'bouton bouton--clair', href: 'https://wa.me/' + C.contact.whatsapp + '?text=' + encodeURIComponent('Bonjour, je souhaite réserver une séance de flottaison.'), target: '_blank', rel: 'noopener' }, icone('i-wa'), 'Écrire sur WhatsApp'))));
  }

  // ---------- Branchements ----------
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-reserver]');
    if (!b) return;
    ev.preventDefault();
    var formule = b.getAttribute('data-reserver');
    document.dispatchEvent(new CustomEvent('lomaya:fermer-menu'));
    ouvrir({ formule: formule || null });
  });

  // Retour de la page de paiement, ou lien direct vers la réservation
  var params = new URLSearchParams(location.search);
  var retour = params.get('reservation');
  if (retour) {
    history.replaceState(null, '', location.pathname + location.hash);
    if (retour === 'ok') ouvrir({ succesRetour: true });
    else if (retour === 'annulee') ouvrir({ notice: 'Le paiement a été annulé : rien n’a été débité et le créneau n’est pas réservé. Vous pouvez recommencer.' });
  } else if (location.hash === '#reserver-en-ligne') {
    ouvrir();
  }

  // Lecture de l'espace dès le chargement (horaires du CRM, état de la réservation)
  if ('requestIdleCallback' in window) requestIdleCallback(function () { demarrer(); }, { timeout: 2500 });
  else setTimeout(demarrer, 1200);

  window.LomayaResa = { ouvrir: ouvrir, fermer: fermer, etat: etat };
})();
