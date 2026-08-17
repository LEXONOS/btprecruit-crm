/* Assistant UNIK'EAU - widget autonome
   S'insere en bas a droite, au-dessus du bouton WhatsApp.
   Reponses preenregistrees aux questions frequentes : on affiche les
   questions les plus posees et, pour un devis, on renvoie vers WhatsApp. */
(function () {
  'use strict';

  var WA = "https://wa.me/590690342476?text=Bonjour%20UNIK'EAU%2C%20j'aimerais%20un%20devis%20pour%20une%20fontaine%20%C3%A0%20eau.";

  /* ---------------- Styles ---------------- */
  var css = `
  .ukb-launcher{
    position:fixed;right:20px;bottom:92px;z-index:120;
    width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;
    display:grid;place-items:center;color:#fff;
    background:linear-gradient(135deg,#0C4C99,#1265C3 55%,#2EA7E6);
    box-shadow:0 14px 30px -8px rgba(18,101,195,.65);
    transition:transform .25s cubic-bezier(.22,.9,.24,1),box-shadow .25s;
  }
  .ukb-launcher:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 20px 40px -10px rgba(18,101,195,.7)}
  .ukb-launcher::before{
    content:"";position:absolute;inset:-5px;border-radius:50%;
    border:2px solid rgba(46,167,230,.45);opacity:0;
    animation:ukbPulse 2.6s ease-out infinite;
  }
  .ukb-launcher .ukb-ic-close{display:none}
  .ukb-launcher.is-open .ukb-ic-chat{display:none}
  .ukb-launcher.is-open .ukb-ic-close{display:block}
  .ukb-launcher.is-open::before{animation:none;opacity:0}
  .ukb-badge{
    position:absolute;top:-4px;right:-4px;padding:3px 7px;border-radius:999px;
    background:#0A1C30;color:#8FD4F5;font:600 9px/1 "IBM Plex Mono",ui-monospace,monospace;
    letter-spacing:.08em;border:1.5px solid rgba(143,212,245,.5);
  }
  @keyframes ukbPulse{0%{transform:scale(.9);opacity:.8}70%{transform:scale(1.28);opacity:0}100%{opacity:0}}

  .ukb-panel{
    position:fixed;right:20px;bottom:162px;z-index:130;
    width:378px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 190px);
    display:flex;flex-direction:column;overflow:hidden;border-radius:24px;
    background:#F6FAFD;border:1px solid #DCE7F0;
    box-shadow:0 6px 18px rgba(10,28,48,.12), 0 40px 90px -24px rgba(10,28,48,.4);
    opacity:0;transform:translateY(18px) scale(.96);transform-origin:100% 100%;
    pointer-events:none;transition:opacity .28s,transform .28s cubic-bezier(.22,.9,.24,1);
  }
  .ukb-panel.is-open{opacity:1;transform:none;pointer-events:auto}

  .ukb-head{
    position:relative;display:flex;align-items:center;gap:12px;padding:16px 16px 14px;color:#fff;
    background:
      radial-gradient(300px 140px at 90% -20%, rgba(46,167,230,.5), transparent 70%),
      linear-gradient(135deg,#0A1C30,#0C4C99 60%,#1265C3);
  }
  .ukb-ava{
    width:40px;height:40px;border-radius:14px;flex:none;display:grid;place-items:center;
    background:rgba(255,255,255,.14);border:1px solid rgba(143,212,245,.35);
  }
  .ukb-head-t{min-width:0}
  .ukb-head-t b{display:block;font:700 15.5px/1.2 "Sora",system-ui,sans-serif;letter-spacing:-.01em}
  .ukb-head-t small{display:flex;align-items:center;gap:6px;margin-top:3px;font:500 11px/1 "IBM Plex Mono",ui-monospace,monospace;color:#9CCBEE;letter-spacing:.05em}
  .ukb-dot{width:7px;height:7px;border-radius:50%;background:#2EA7E6;box-shadow:0 0 0 3px rgba(46,167,230,.2)}
  .ukb-close{
    margin-left:auto;width:34px;height:34px;border-radius:10px;border:0;cursor:pointer;flex:none;
    display:grid;place-items:center;color:#CFE6F7;background:rgba(255,255,255,.1);transition:background .2s;
  }
  .ukb-close:hover{background:rgba(255,255,255,.2)}

  .ukb-body{flex:1;overflow-y:auto;padding:18px 14px 10px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin}
  .ukb-msg{
    max-width:84%;padding:11px 14px;border-radius:16px;
    font:400 14px/1.55 "Instrument Sans",system-ui,sans-serif;white-space:pre-line;overflow-wrap:break-word;
    animation:ukbIn .3s cubic-bezier(.22,.9,.24,1);
  }
  .ukb-msg a{color:inherit;text-decoration:underline;text-underline-offset:2px;font-weight:600}
  .ukb-msg--bot{align-self:flex-start;background:#fff;border:1px solid #DCE7F0;color:#42566E;border-bottom-left-radius:6px;box-shadow:0 2px 8px rgba(10,28,48,.05)}
  .ukb-msg--user{align-self:flex-end;background:linear-gradient(135deg,#0C4C99,#1265C3);color:#fff;border-bottom-right-radius:6px}
  @keyframes ukbIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

  .ukb-typing{align-self:flex-start;display:flex;gap:5px;padding:14px 16px;background:#fff;border:1px solid #DCE7F0;border-radius:16px;border-bottom-left-radius:6px}
  .ukb-typing i{width:7px;height:7px;border-radius:50%;background:#7FA6C4;animation:ukbTy 1.1s ease-in-out infinite}
  .ukb-typing i:nth-child(2){animation-delay:.15s}
  .ukb-typing i:nth-child(3){animation-delay:.3s}
  @keyframes ukbTy{0%,60%,100%{transform:none;opacity:.5}30%{transform:translateY(-5px);opacity:1}}

  .ukb-chips{display:flex;flex-wrap:wrap;gap:7px;padding:2px 2px 6px;animation:ukbIn .35s .1s both}
  .ukb-chip{
    border:1px solid #C9DEF2;background:#EAF3FC;color:#0C4C99;cursor:pointer;border-radius:999px;
    padding:8px 13px;font:600 12.5px/1 "Instrument Sans",system-ui,sans-serif;transition:background .2s,transform .2s;
  }
  .ukb-chip:hover{background:#DFEEFA;transform:translateY(-1px)}
  .ukb-chip--wa{background:#E6F7EE;border-color:#B4E4C8;color:#128C46}
  .ukb-chip--wa:hover{background:#D9F2E4}
  .ukb-cat{width:100%;margin:9px 2px 1px;font:600 10.5px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#7488A0}

  .ukb-foot{padding:10px 12px 12px;background:#fff;border-top:1px solid #E4EDF5}
  .ukb-form{display:flex;gap:8px}
  .ukb-input{
    flex:1;min-width:0;border:1.5px solid #DCE7F0;border-radius:14px;padding:11px 14px;
    font:400 14px/1.4 "Instrument Sans",system-ui,sans-serif;color:#0A1C30;background:#F6FAFD;outline:0;
    transition:border-color .2s,background .2s;
  }
  .ukb-input:focus{border-color:#2EA7E6;background:#fff}
  .ukb-send{
    width:44px;height:44px;flex:none;border:0;border-radius:14px;cursor:pointer;display:grid;place-items:center;color:#fff;
    background:linear-gradient(135deg,#0C4C99,#1265C3);transition:transform .2s,opacity .2s;
  }
  .ukb-send:hover{transform:translateY(-2px)}
  .ukb-send:disabled{opacity:.45;transform:none;cursor:default}
  .ukb-note{margin:8px 2px 0;font:400 10.5px/1.4 "IBM Plex Mono",ui-monospace,monospace;color:#7488A0;text-align:center}

  /* Desktop : pile alignee au pixel (bot au-dessus du WhatsApp) */
  .fab{right:22px !important;bottom:22px !important;width:56px !important;height:56px !important}
  .ukb-launcher{right:22px;bottom:90px;width:56px;height:56px}

  /* Mobile : plus de pastilles empilees, une barre d'action propre en bas */
  .ukb-bar{
    position:fixed;left:0;right:0;bottom:0;z-index:110;display:none;gap:10px;
    padding:10px 12px calc(10px + env(safe-area-inset-bottom));
    background:rgba(246,250,253,.92);
    -webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);
    border-top:1px solid #DCE7F0;box-shadow:0 -10px 30px -12px rgba(10,28,48,.18);
    transition:transform .3s cubic-bezier(.22,.9,.24,1);
  }
  body.ukb-open .ukb-bar{transform:translateY(110%)}
  .ukb-bar a,.ukb-bar button{
    flex:1;display:flex;align-items:center;justify-content:center;gap:8px;
    min-height:48px;padding:10px 8px;border:0;border-radius:14px;cursor:pointer;
    font:700 14px/1.1 "Sora",system-ui,sans-serif;letter-spacing:-.01em;color:#fff;text-decoration:none;
  }
  .ukb-bar .ukb-bar-wa{background:linear-gradient(135deg,#27B45E,#128C46);box-shadow:0 8px 20px -8px rgba(24,150,74,.55)}
  .ukb-bar .ukb-bar-ai{background:linear-gradient(135deg,#0C4C99,#1265C3 60%,#2EA7E6);box-shadow:0 8px 20px -8px rgba(18,101,195,.55);position:relative}
  .ukb-bar .ukb-bar-ai .ukb-badge{position:static;margin-left:2px;background:rgba(10,28,48,.4);border-color:rgba(143,212,245,.4)}
  .ukb-bar svg{flex:none}

  @media (max-width:640px){
    body{padding-bottom:calc(70px + env(safe-area-inset-bottom))}
    .fab{display:none !important}
    .ukb-launcher{display:none}
    .ukb-bar{display:flex}
    .ukb-panel{
      right:10px;left:10px;width:auto;border-radius:20px;max-height:none;
      top:max(10px, env(safe-area-inset-top));bottom:calc(10px + env(safe-area-inset-bottom));height:auto;
    }
  }
  @media (prefers-reduced-motion:reduce){
    .ukb-launcher::before{animation:none}
    .ukb-msg,.ukb-chips{animation:none}
    .ukb-panel{transition:opacity .2s}
  }`;

  /* ---------------- Base de questions / reponses preenregistrees ---------------- */
  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  var WA_NUM = "+590 690 34 24 76";

  var CATS = [
    ['tarifs', "Tarifs"], ['eau', "L'eau"], ['entretien', "Entretien"], ['install', "Installation"],
    ['produit', "Le produit"], ['zone', "Zone et delais"], ['garantie', "Garantie"],
    ['paiement', "Paiement"], ['contact', "Contact"]
  ];

  var QA = [
    { id: 't1', cat: 'tarifs', q: "Combien coûte la location ?", k: ['location','louer','loue','loyer','mensualite','abonnement','prix','tarif','combien','cout','coute','par mois'],
      a: "Deux formules. La location tout compris :\n• 50 € HT/mois (54,25 € TTC) jusqu'à 4 personnes\n• 70 € HT/mois (75,95 € TTC) à partir de 5 personnes\nLe prix suit le nombre de personnes qui boivent l'eau, pas le format. Installation, entretien, cartouches et garantie compris. Engagement 24 mois, caution 100 €." },
    { id: 't2', cat: 'tarifs', q: "Combien coûte l'achat ?", k: ['achat','acheter','achete','699','799','acquisition','proprietaire'],
      a: "À l'achat, la fontaine vous appartient :\n• Comptoir : 699 € TTC\n• Colonne : 799 € TTC\n• Installation : 200 € TTC (déplacement, main-d'oeuvre et accessoires compris)\nGarantie 2 ans sur les pièces. L'entretien se fait ensuite via un contrat dédié." },
    { id: 't3', cat: 'tarifs', q: "Location ou achat, comment choisir ?", k: ['difference','plutot','choisir','conseil','rentable','vaut mieux','location ou','achat ou','louer ou'],
      a: "La location, c'est la formule sans souci : une mensualité fixe qui couvre la fontaine, l'installation, l'entretien, les cartouches et la garantie pendant tout le contrat.\nL'achat, c'est la machine qui vous appartient : vous payez la fontaine et l'installation une fois, puis l'entretien au contrat.\nDites-nous votre situation sur WhatsApp au +590 690 34 24 76, on vous dit ce qui revient le moins cher." },
    { id: 't4', cat: 'tarifs', q: "Qu'est-ce qui est compris dans la location ?", k: ['compris','inclus','comprend','inclut','tout compris'],
      a: "Tout est compris dans la mensualité : la fontaine, l'installation, l'entretien régulier, les 4 cartouches remplacées à chaque passage, et la garantie pendant toute la durée du contrat. Vous n'avez qu'un montant fixe, rien d'autre à prévoir." },
    { id: 't5', cat: 'tarifs', q: "Engagement et caution ?", k: ['engagement','caution','duree','24 mois','depot','engage'],
      a: "La location est prévue pour 24 mois, avec une caution de 100 € à la mise en service. En échange, tout est compris pendant le contrat : installation, entretien, cartouches et garantie." },
    { id: 't6', cat: 'tarifs', q: "Peut-on résilier avant 24 mois ?", k: ['resilier','resiliation','arreter','annuler','rompre','rendre','avant la fin'],
      a: "La location est prévue pour 24 mois. Une résiliation anticipée reste possible dans des situations particulières, étudiées au cas par cas. Expliquez-nous votre situation sur WhatsApp au +590 690 34 24 76." },

    { id: 'e1', cat: 'eau', q: "L'eau est-elle bonne à boire ?", k: ['bonne','boire','buvable','saine','sante','qualite','claire'],
      a: "Oui. L'eau du réseau passe par 4 cartouches (sédiments, charbon actif, ultrafiltration, post-charbon) qui retirent particules, chlore, mauvais goûts et micro-impuretés, puis par une lampe UV qui désinfecte le réservoir en continu. Résultat : une eau claire et fraîche, que vous buvez sans y penser." },
    { id: 'e2', cat: 'eau', q: "En Guadeloupe, on hésite à boire l'eau du robinet ?", k: ['guadeloupe','robinet','peur','hesite','hesiter','confiance','ile','reseau','potable'],
      a: "C'est justement l'intérêt. En Guadeloupe, beaucoup préfèrent acheter des bouteilles par précaution. Avec UNIK'EAU, l'eau est filtrée en 4 étapes et passée aux UV : vous retrouvez une eau du robinet en laquelle vous avez confiance, à volonté, sans bouteilles ni bonbonnes." },
    { id: 'e3', cat: 'eau', q: "Que retire la filtration ?", k: ['retire','filtration','filtre','enleve','elimine','bacterie','chlore','calcaire','impurete','charbon','membrane'],
      a: "La filtration retire :\n• Particules et sable (cartouche PP)\n• Chlore et mauvais goûts (charbon actif)\n• Bactéries et micro-impuretés (membrane d'ultrafiltration)\n• Puis un dernier affinage du goût (post-charbon)\nLa lampe UV neutralise les micro-organismes en continu, sans aucun produit ajouté." },
    { id: 'e4', cat: 'eau', q: "Eau chaude et froide ?", k: ['chaude','froide','temperee','chaud','froid','temperature','glacee','tiede'],
      a: "Oui, sur les deux modèles : eau froide (≤ 10 °C), tempérée et chaude (≥ 90 °C), à volonté. De quoi couvrir la bouteille au frais comme le thé ou le café." },

    { id: 'n1', cat: 'entretien', q: "À quel rythme change-t-on les filtres ?", k: ['rythme','frequence','change','changer','remplace','souvent','combien de fois'],
      a: "Selon le nombre de personnes : 2 passages par an jusqu'à 4 personnes, 4 passages par an à partir de 5. En location, ces passages et les cartouches neuves sont compris. À l'achat, c'est un contrat d'entretien dédié." },
    { id: 'n2', cat: 'entretien', q: "Combien coûte l'entretien à l'achat ?", k: ['entretien','maintenance','244','488','cout entretien','prix entretien','contrat entretien'],
      a: "À l'achat, le contrat d'entretien coûte :\n• 244 € TTC/an de 1 à 4 personnes (un passage tous les 6 mois)\n• 488 € TTC/an à partir de 5 personnes (un passage par trimestre)\nFiltres neufs et déplacement compris." },
    { id: 'n3', cat: 'entretien', q: "Qui s'occupe de l'entretien ?", k: ['qui','technicien','deplace','occupe','moi meme','demonter'],
      a: "Notre technicien se déplace, remplace les 4 cartouches par des neuves et vérifie la fontaine. Vous n'avez rien à faire ni à démonter." },

    { id: 'i1', cat: 'install', q: "Que faut-il prévoir chez moi ?", k: ['prevoir','besoin','faut il','arrivee','prise','plomberie','raccordement','preparer','branchement'],
      a: "Juste deux choses à proximité de l'emplacement : une arrivée d'eau potable et une prise électrique. Le technicien apporte tout le reste, accessoires de raccordement compris." },
    { id: 'i2', cat: 'install', q: "Combien de temps pour l'installation ?", k: ['delai','combien de temps','quand','rapidement','vite','attente','livraison','sous combien'],
      a: "En général, installation dans la semaine, au plus tard sous deux semaines après validation du devis. Un seul passage suffit." },
    { id: 'i3', cat: 'install', q: "Comment se passe l'installation ?", k: ['comment','pose','mise en service','deroule','installer','installation se passe'],
      a: "On raccorde la fontaine à votre arrivée d'eau, on la met en service et on vérifie chaque sortie (froide, tempérée, chaude). Rapide et propre, en un seul rendez-vous." },

    { id: 'p1', cat: 'produit', q: "Colonne ou comptoir ?", k: ['colonne','comptoir','format','modele','lequel','sol','plan de travail','difference'],
      a: "Même eau et mêmes 4 cartouches dans les deux. La colonne se pose au sol (idéale pour accueil, bureaux, salles d'attente). Le comptoir se pose sur un plan de travail (quand la place est comptée). Le choix se joue sur l'espace, pas sur le prix." },
    { id: 'p2', cat: 'produit', q: "Quels coloris ?", k: ['coloris','couleur','couleurs','noir','blanc','gris','teinte'],
      a: "Colonne : gris et noir, ou blanc et noir.\nComptoir : gris et noir, blanc et noir, ou noir complet." },
    { id: 'p3', cat: 'produit', q: "Quelles dimensions ?", k: ['dimension','taille','encombrement','hauteur','largeur','mesure','place','cm'],
      a: "La colonne fait 33 x 36 x 116 cm (largeur x profondeur x hauteur). Pour les dimensions exactes du comptoir, demandez-nous sur WhatsApp au +590 690 34 24 76, on vous envoie la fiche." },
    { id: 'p4', cat: 'produit', q: "Faut-il encore des bonbonnes ?", k: ['bonbonne','bonbonnes','bidon','bouteille','recharge','stock','commander'],
      a: "Non, plus jamais. La fontaine se branche sur votre arrivée d'eau : plus rien à commander, porter ou stocker, et jamais de rupture." },

    { id: 'z1', cat: 'zone', q: "Vous intervenez où ?", k: ['zone','secteur','commune','ville','deplace','intervenez','livrez','abymes','pointe','jarry','baie mahault','gosier','moule','basse terre','grande terre'],
      a: "Dans toute la Guadeloupe : Baie-Mahault, Jarry, Pointe-à-Pitre, Les Abymes, et au-delà. Dites-nous votre commune sur WhatsApp au +590 690 34 24 76, on confirme tout de suite." },
    { id: 'z2', cat: 'zone', q: "Pros ou particuliers ?", k: ['pro','professionnel','particulier','entreprise','bureau','maison','domicile','commerce'],
      a: "Les deux. Bureaux, commerces, salles d'attente, salles de sport, restaurants, et à la maison." },

    { id: 'g1', cat: 'garantie', q: "En cas de panne ?", k: ['panne','casse','probleme','marche plus','garantie','sav','depannage','repare','fuite'],
      a: "En location, la fontaine est garantie pendant tout le contrat : on intervient, on répare ou on remplace. À l'achat, vous êtes couvert 2 ans sur les pièces, dans le cadre d'un entretien respecté." },

    { id: 'pay1', cat: 'paiement', q: "Quels moyens de paiement ?", k: ['paiement','payer','regler','carte','virement','especes','cash','cheque','facture','moyen'],
      a: "Carte, virement, espèces et facture, au choix. Le devis et la facture sont établis au nom d'O'ELEC, la société derrière la marque UNIK'EAU." },
    { id: 'pay2', cat: 'paiement', q: "Pourquoi la facture est au nom d'O'ELEC ?", k: ['oelec','o elec','societe','entreprise','qui etes','siret','nom','facture'],
      a: "UNIK'EAU est la marque de fontaines à eau de la société O'ELEC, basée à Baie-Mahault. Vos devis, contrats et factures sont donc au nom d'O'ELEC : c'est la même maison." },

    { id: 'c1', cat: 'contact', q: "Comment obtenir un devis ?", k: ['devis','contact','contacter','joindre','whatsapp','telephone','appeler','mail','email','rendez vous','rdv','numero'],
      a: "Le plus simple : un message WhatsApp au +590 690 34 24 76 avec votre commune et la taille de votre équipe. Réponse rapide avec le bon modèle et un devis clair. Par mail : oelec.guadeloupe@gmail.com." }
  ];

  var STARTERS = ['t1', 't3', 'e2', 'n1', 'i1', 'i2'];

  function getQA(id) { for (var i = 0; i < QA.length; i++) { if (QA[i].id === id) return QA[i]; } return null; }

  /* ---------------- Construction du widget ---------------- */
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var ICONS = {
    chat: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M9.5 9.5c.3-1.2 1.4-2 2.7-2 1.5 0 2.8 1.1 2.8 2.5 0 1.7-2.2 1.9-2.8 3.2"/><circle cx="12.1" cy="16.5" r=".5" fill="currentColor"/></svg>',
    close: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    drop: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8FD4F5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.7 6.6 9.8a6.6 6.6 0 1 0 10.8 0Z"/><path d="M9.4 13.2a3 3 0 0 0 1.4 2.6" opacity=".7"/></svg>',
    send: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'
  };

  var launcher = document.createElement('button');
  launcher.className = 'ukb-launcher';
  launcher.setAttribute('aria-label', "Ouvrir l'assistant UNIK'EAU");
  launcher.setAttribute('aria-expanded', 'false');
  launcher.innerHTML = '<span class="ukb-ic-chat">' + ICONS.chat + '</span><span class="ukb-ic-close">' + ICONS.close + '</span>';

  var panel = document.createElement('section');
  panel.className = 'ukb-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', "Assistant UNIK'EAU");
  panel.innerHTML =
    '<div class="ukb-head">' +
      '<span class="ukb-ava">' + ICONS.drop + '</span>' +
      '<div class="ukb-head-t"><b>Assistant UNIK\u2019EAU</b><small><span class="ukb-dot"></span>Questions fr\u00E9quentes</small></div>' +
      '<button class="ukb-close" type="button" aria-label="Fermer">' + ICONS.close + '</button>' +
    '</div>' +
    '<div class="ukb-body"></div>' +
    '<div class="ukb-foot">' +
      '<form class="ukb-form">' +
        '<input class="ukb-input" type="text" placeholder="Votre question\u2026" autocomplete="off" maxlength="500" aria-label="Votre question">' +
        '<button class="ukb-send" type="submit" aria-label="Envoyer">' + ICONS.send + '</button>' +
      '</form>' +
      '<p class="ukb-note">R\u00E9ponses pr\u00E9enregistr\u00E9es \u00B7 devis sur WhatsApp</p>' +
    '</div>';

  var bar = document.createElement('div');
  bar.className = 'ukb-bar';
  bar.innerHTML =
    '<a class="ukb-bar-wa" href="' + WA + '" target="_blank" rel="noopener">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.4 14.1c-.2.7-1.3 1.3-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-2.9-1.3-4.8-4.2-5-4.4-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5-.4.9-.9 1-.7 1.4.8 1.3 1.7 2.1 3 2.8.3.2.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.1.1.7-.3 1.4Z"/></svg>' +
      'Devis WhatsApp</a>' +
    '<button class="ukb-bar-ai" type="button">' + ICONS.chat.replace('width="26" height="26"', 'width="18" height="18"') +
      'Une question ?</button>';

  document.body.appendChild(launcher);
  document.body.appendChild(panel);
  document.body.appendChild(bar);

  var body = panel.querySelector('.ukb-body');
  var form = panel.querySelector('.ukb-form');
  var input = panel.querySelector('.ukb-input');
  var send = panel.querySelector('.ukb-send');

  var busy = false;
  var started = false;
  var curChips = null;

  function scroll() { body.scrollTop = body.scrollHeight; }
  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function addMsg(role, text) {
    var el = document.createElement('div');
    el.className = 'ukb-msg ' + (role === 'user' ? 'ukb-msg--user' : 'ukb-msg--bot');
    if (role !== 'user' && text.indexOf(WA_NUM) !== -1) {
      el.innerHTML = esc(text).replace(/\+590 690 34 24 76/g, '<a href="' + WA + '" target="_blank" rel="noopener">' + WA_NUM + '</a>');
    } else {
      el.textContent = text;
    }
    body.appendChild(el);
    scroll();
  }

  function showTyping() {
    var t = document.createElement('div');
    t.className = 'ukb-typing';
    t.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(t);
    scroll();
    return t;
  }

  function clearChips() { if (curChips) { curChips.remove(); curChips = null; } }
  function chipGroup(build) {
    clearChips();
    var wrap = document.createElement('div');
    wrap.className = 'ukb-chips';
    build(wrap);
    body.appendChild(wrap);
    curChips = wrap;
    scroll();
  }
  function mkChip(label, cls, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ukb-chip' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
  function addAllChip(wrap) { wrap.appendChild(mkChip('Toutes les questions', '', showAll)); }
  function addWaChip(wrap) {
    var a = document.createElement('a');
    a.className = 'ukb-chip ukb-chip--wa';
    a.href = WA; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Ecrire sur WhatsApp';
    wrap.appendChild(a);
  }

  function related(qa) {
    chipGroup(function (wrap) {
      QA.filter(function (x) { return x.cat === qa.cat && x.id !== qa.id; }).slice(0, 3)
        .forEach(function (x) { wrap.appendChild(mkChip(x.q, '', function () { answer(x); })); });
      addAllChip(wrap);
      addWaChip(wrap);
    });
  }

  function answer(qa, userText) {
    if (busy) return;
    busy = true;
    addMsg('user', userText || qa.q);
    clearChips();
    var t = showTyping();
    setTimeout(function () {
      t.remove();
      addMsg('bot', qa.a);
      related(qa);
      busy = false;
      input.focus();
    }, 280);
  }

  function showAll() {
    if (busy) return;
    addMsg('bot', 'Voici tout ce que je peux détailler. Choisissez une question :');
    chipGroup(function (wrap) {
      CATS.forEach(function (c) {
        var items = QA.filter(function (x) { return x.cat === c[0]; });
        if (!items.length) return;
        var lab = document.createElement('span');
        lab.className = 'ukb-cat';
        lab.textContent = c[1];
        wrap.appendChild(lab);
        items.forEach(function (x) { wrap.appendChild(mkChip(x.q, '', function () { answer(x); })); });
      });
      addWaChip(wrap);
    });
  }

  function freeText(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    busy = true;
    addMsg('user', text);
    clearChips();
    var t = norm(text), best = null, score = 0;
    QA.forEach(function (x) {
      var s = 0;
      x.k.forEach(function (kw) { if (t.indexOf(kw) !== -1) s++; });
      if (s > score) { score = s; best = x; }
    });
    var ty = showTyping();
    setTimeout(function () {
      ty.remove();
      if (best && score >= 1) {
        addMsg('bot', best.a);
        related(best);
      } else {
        addMsg('bot', "Je n'ai pas de réponse préenregistrée à cette question précise. Le plus sûr est d'écrire à l'équipe sur WhatsApp au " + WA_NUM + ", elle vous répond vite. Sinon, choisissez parmi les questions fréquentes :");
        chipGroup(function (wrap) { addAllChip(wrap); addWaChip(wrap); });
      }
      busy = false;
      input.focus();
    }, 280);
  }

  function welcome() {
    if (started) return;
    started = true;
    addMsg('bot', "Bonjour ! Voici les questions qu'on nous pose le plus souvent. Choisissez, ou écrivez la vôtre.");
    chipGroup(function (wrap) {
      STARTERS.forEach(function (id) { var x = getQA(id); if (x) wrap.appendChild(mkChip(x.q, '', function () { answer(x); })); });
      addAllChip(wrap);
    });
  }

  function openPanel() {
    document.body.classList.add('ukb-open');
    panel.classList.add('is-open');
    launcher.classList.add('is-open');
    launcher.setAttribute('aria-expanded', 'true');
    launcher.setAttribute('aria-label', "Fermer l'assistant UNIK'EAU");
    welcome();
    setTimeout(function () { input.focus(); }, 250);
  }
  function closePanel() {
    document.body.classList.remove('ukb-open');
    panel.classList.remove('is-open');
    launcher.classList.remove('is-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-label', "Ouvrir l'assistant UNIK'EAU");
  }

  launcher.addEventListener('click', function () {
    if (panel.classList.contains('is-open')) closePanel(); else openPanel();
  });
  panel.querySelector('.ukb-close').addEventListener('click', closePanel);
  bar.querySelector('.ukb-bar-ai').addEventListener('click', openPanel);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) closePanel();
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value;
    input.value = '';
    freeText(v);
  });
})();
