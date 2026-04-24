// ─── TYPES ────────────────────────────────────────────────────────────────────
export type DocType = 'acte_vente' | 'mandat_exclusif' | 'mandat_open' | 'promesse_vente'
export type DocStatus = 'brouillon' | 'envoye' | 'signe' | 'archive'

// ─── CHECKLIST INSPECTION AMEL ────────────────────────────────────────────────
export const CHECKLIST_AMEL = [
  {
    id: 'pont_coque',
    titre: 'Pont & Coque',
    icone: '⚓',
    items: [
      { id: 'genoa_furler', label: 'Moteur et boîte de vitesses du enrouleur génois (6 photos)', done: false, note: '' },
      { id: 'genoa_sail', label: 'Génois déroulé ~2,5m — 4 photos + 2 gros plans', done: false, note: '' },
      { id: 'windlass', label: 'Guindeau et chaîne (4 photos)', done: false, note: '' },
      { id: 'lockers', label: 'Coffres avant ouverts — fonds des coffres (risque fissures)', done: false, note: '' },
      { id: 'hawse_pipe', label: 'Chaumard tribord (corrosion possible) — 2 photos', done: false, note: '' },
      { id: 'main_traveler', label: 'Chariot d\'écoute principale — poulies intérieures (2 photos)', done: false, note: '' },
      { id: 'outhaul_car', label: 'Chariot de bordure grand-voile (4 photos)', done: false, note: '' },
      { id: 'outhaul_gearbox', label: 'Boîte de vitesses et moteur bordure — côté bâbord et tribord (3-4 photos)', done: false, note: '' },
      { id: 'furling_gearbox', label: 'Boîte d\'enroulement manuelle mât principal et mât de misaine', done: false, note: '' },
      { id: 'mainsail', label: 'Grand-voile déroulée ~2,5m — 4 photos + 2 gros plans point d\'écoute', done: false, note: '' },
      { id: 'mizzen', label: 'Tapecul — même protocole que grand-voile', done: false, note: '' },
      { id: 'genoa_traveler', label: 'Chariot génois bâbord et tribord — poulies (2 photos chacun)', done: false, note: '' },
      { id: 'mizzen_outhaul', label: 'Chariot de bordure misaine (2 photos)', done: false, note: '' },
      { id: 'rudder_post', label: 'Presse-étoupe axe de gouvernail — état rouille/corrosion', done: false, note: '' },
      { id: 'hull_keel', label: 'Coque, quille, gouvernail — réparations éventuelles', done: false, note: '' },
    ],
  },
  {
    id: 'cockpit_nav',
    titre: 'Cockpit & Navigation',
    icone: '🧭',
    items: [
      { id: 'door', label: 'Photo de la porte d\'entrée', done: false, note: '' },
      { id: 'cockpit_instruments', label: 'Cockpit complet — instruments, commutateurs, moteur Morse (20 photos)', done: false, note: '' },
      { id: 'steering_wheel', label: 'Volant de barre — cuir et compas', done: false, note: '' },
      { id: 'cabinet_inside', label: 'Intérieur armoire électrique (2 photos)', done: false, note: '' },
      { id: 'nav_station', label: 'Poste de navigation — vue complète (6-8 photos)', done: false, note: '' },
      { id: 'autopilot', label: 'Pilote automatique — vérin et capteur position gouvernail', done: false, note: '' },
    ],
  },
  {
    id: 'electrique',
    titre: 'Électricité & Batteries',
    icone: '⚡',
    items: [
      { id: 'battery_bank', label: 'Compartiment batteries — 4 photos', done: false, note: '' },
      { id: 'battery_switches', label: 'Dos des coupe-circuits principaux', done: false, note: '' },
      { id: 'solar_panels', label: 'Panneaux solaires et régulateur', done: false, note: '' },
      { id: 'inverter', label: 'Convertisseur/chargeur', done: false, note: '' },
    ],
  },
  {
    id: 'salle_des_machines',
    titre: 'Salle des Machines',
    icone: '🔧',
    items: [
      { id: 'engine_overview', label: 'Moteur principal — toutes vues (min. 10 photos)', done: false, note: '' },
      { id: 'cdrive', label: 'C-Drive, transmission, bâti moteur, sump eau grise (10 photos)', done: false, note: '' },
      { id: 'cdrive_reservoir', label: 'Réservoir huile C-Drive — couleur de l\'huile (2 gros plans flash)', done: false, note: '' },
      { id: 'starter_solenoid', label: 'Relais démarreur, solénoïde négatif, relais alternateur 24V (2 photos)', done: false, note: '' },
      { id: 'generator', label: 'Groupe électrogène — face, dos, pompe eau brute, panneau (12 photos)', done: false, note: '' },
      { id: 'freshwater_pump', label: 'Pompe eau douce et pompe clim (4-6 photos)', done: false, note: '' },
      { id: 'watermaker', label: 'Osmoseur — chaque composant (min. 2 photos par composant)', done: false, note: '' },
      { id: 'sea_chest', label: 'Vanne de coque et tuyauteries (2-4 photos)', done: false, note: '' },
      { id: 'gray_water', label: 'Sump eau grise — pompe et interrupteur', done: false, note: '' },
      { id: 'head_pumps', label: 'Pompes de chasse WC (2) et pompe eau grise (2 photos)', done: false, note: '' },
      { id: 'water_heater', label: 'Chauffe-eau et nourrice bâbord', done: false, note: '' },
      { id: 'anchor_wash', label: 'Pompe de lavage ancre et zone environnante', done: false, note: '' },
    ],
  },
  {
    id: 'bow_thruster_clim',
    titre: 'Propulseur & Climatisation',
    icone: '🌀',
    items: [
      { id: 'bow_thruster', label: 'Compartiment propulseur d\'étrave — tout visible (8 photos)', done: false, note: '' },
      { id: 'bow_thruster_outside', label: 'Propulseur vue extérieure si à sec (2-3 photos)', done: false, note: '' },
      { id: 'ac_aft', label: 'Climatiseur arrière (3-4 photos)', done: false, note: '' },
      { id: 'ac_salon', label: 'Climatiseur salon (3-4 photos)', done: false, note: '' },
      { id: 'ac_forward', label: 'Climatiseur avant (3-4 photos)', done: false, note: '' },
    ],
  },
  {
    id: 'interieur',
    titre: 'Intérieur & Équipements',
    icone: '🏠',
    items: [
      { id: 'galley', label: 'Cuisinière, micro-ondes, lave-vaisselle (4 photos chacun)', done: false, note: '' },
      { id: 'washer', label: 'Lave-linge (4 photos)', done: false, note: '' },
      { id: 'fridge_freezer', label: 'Réfrigérateur(s) et congélateur(s) (4 photos chacun)', done: false, note: '' },
      { id: 'gas_compartment', label: 'Compartiment gaz — vue intérieure (2 photos)', done: false, note: '' },
      { id: 'heads', label: 'WC — tuyaux et vannes visibles', done: false, note: '' },
      { id: 'heads_pumps', label: 'Pompes manuelles ou macérateurs WC', done: false, note: '' },
    ],
  },
]

// ─── CHECKLIST GÉNÉRIQUE ──────────────────────────────────────────────────────
export const CHECKLIST_GENERAL = [
  {
    id: 'exterieur',
    titre: 'Extérieur',
    icone: '⛵',
    items: [
      { id: 'coque_ext', label: 'Coque extérieure — toutes faces (6+ photos)', done: false, note: '' },
      { id: 'pont', label: 'Pont — vue générale et détails', done: false, note: '' },
      { id: 'quille', label: 'Quille et jonction coque', done: false, note: '' },
      { id: 'gouvernail', label: 'Gouvernail et safran', done: false, note: '' },
      { id: 'greement', label: 'Gréement courant et dormant', done: false, note: '' },
      { id: 'voiles', label: 'État des voiles — photos déployées', done: false, note: '' },
      { id: 'antifouling', label: 'Antifouling — état et date', done: false, note: '' },
    ],
  },
  {
    id: 'moteur',
    titre: 'Motorisation',
    icone: '⚙️',
    items: [
      { id: 'moteur_general', label: 'Moteur — vues générales (6+ photos)', done: false, note: '' },
      { id: 'heures_moteur', label: 'Compteur heures moteur — photo lisible', done: false, note: '' },
      { id: 'transmission', label: 'Transmission et ligne d\'arbre', done: false, note: '' },
      { id: 'helice', label: 'Hélice — état général', done: false, note: '' },
      { id: 'liquides', label: 'Niveaux huile, liquide de refroidissement', done: false, note: '' },
    ],
  },
  {
    id: 'electronique',
    titre: 'Électronique & Navigation',
    icone: '📡',
    items: [
      { id: 'vhf', label: 'VHF — marque et modèle', done: false, note: '' },
      { id: 'gps_chartplotter', label: 'GPS/Traceur de carte', done: false, note: '' },
      { id: 'pilote_auto', label: 'Pilote automatique — test fonctionnement', done: false, note: '' },
      { id: 'ais', label: 'AIS — si équipé', done: false, note: '' },
      { id: 'radar', label: 'Radar — si équipé', done: false, note: '' },
    ],
  },
  {
    id: 'securite',
    titre: 'Sécurité',
    icone: '🛟',
    items: [
      { id: 'radeau', label: 'Radeau de survie — date certification', done: false, note: '' },
      { id: 'epirb', label: 'EPIRB — date activation et test', done: false, note: '' },
      { id: 'gilets', label: 'Gilets de sauvetage — quantité et état', done: false, note: '' },
      { id: 'extincteurs', label: 'Extincteurs — date vérification', done: false, note: '' },
    ],
  },
]

// ─── QUESTIONNAIRE PRÉ-ACHAT AMEL ────────────────────────────────────────────
export const QUESTIONNAIRE_AMEL_PARTS = [
  {
    id: 'pont_coque',
    titre: 'Partie 1 : Pont & Coque',
    questions: [
      { id: 'grement_courant_age', label: 'Gréement courant — âge ?', type: 'text' },
      { id: 'grement_courant_specs', label: 'Si remplacé, conforme aux specs Amel ?', type: 'yesno' },
      { id: 'grement_dormant_age', label: 'Gréement dormant — âge ?', type: 'text' },
      { id: 'grement_dormant_qui', label: 'Si remplacé, par qui et quand ?', type: 'text' },
      { id: 'moteurs_enrouleurs_age', label: 'Moteurs enrouleurs et boîtes — âge ?', type: 'text' },
      { id: 'voiles_age', label: 'Voiles — âge ?', type: 'text' },
      { id: 'voiles_matiere', label: 'Voiles — matière et fabricant ?', type: 'text' },
      { id: 'guindeau_marque', label: 'Guindeau — marque et modèle ?', type: 'text' },
      { id: 'guindeau_dernier_service', label: 'Guindeau — date dernier entretien ?', type: 'date' },
      { id: 'chaine_age', label: 'Chaîne d\'ancre — âge et type ?', type: 'text' },
      { id: 'coffres_avant_fissures', label: 'Coffres avant — fond fissuré ? (SM uniquement)', type: 'yesno' },
      { id: 'reparations_coque', label: 'Coque/quille/gouvernail — réparations effectuées ?', type: 'textarea' },
      { id: 'antifouling_date', label: 'Antifouling — dernière date de renouvellement ?', type: 'date' },
      { id: 'antifouling_produit', label: 'Antifouling — quel produit ?', type: 'text' },
      { id: 'echouage', label: 'Le bateau a-t-il déjà échoué ou heurté quelque chose ?', type: 'yesno' },
      { id: 'echouage_detail', label: 'Si oui, expliquer', type: 'textarea' },
      { id: 'presse_etoupe_date', label: 'Presse-étoupe axe gouvernail — dernière vérification ?', type: 'date' },
    ],
  },
  {
    id: 'electronique',
    titre: 'Partie 2 : Électronique & Électricité',
    questions: [
      { id: 'pilote_auto_marque', label: 'Pilote automatique — marque, modèle, âge ?', type: 'text' },
      { id: 'pilote_auto_fonctionne', label: 'Pilote automatique — fonctionne ?', type: 'yesno' },
      { id: 'vhf_marque', label: 'VHF — marque, modèle, DSC ?', type: 'text' },
      { id: 'ais', label: 'AIS — présent et fonctionnel ?', type: 'yesno' },
      { id: 'radar', label: 'Radar — marque et âge ?', type: 'text' },
      { id: 'batteries_maison_nb', label: 'Batteries de service — nombre ?', type: 'text' },
      { id: 'batteries_maison_age', label: 'Batteries de service — âge ?', type: 'text' },
      { id: 'batteries_demarrage_age', label: 'Batterie démarrage — âge ?', type: 'text' },
      { id: 'convertisseur', label: 'Convertisseur — marque, capacité, fonctionnel ?', type: 'text' },
      { id: 'chargeur_marque', label: 'Chargeur de batterie — marque et ampérage ?', type: 'text' },
      { id: 'epirb', label: 'EPIRB — marque et date dernière certification ?', type: 'text' },
      { id: 'zincs_date', label: 'Zincs — dernière date de remplacement ?', type: 'date' },
    ],
  },
  {
    id: 'mecanique',
    titre: 'Partie 3 : Mécanique',
    questions: [
      { id: 'moteur_marque', label: 'Moteur principal — marque et modèle ?', type: 'text' },
      { id: 'moteur_heures', label: 'Moteur principal — heures ?', type: 'text' },
      { id: 'moteur_huile_date', label: 'Dernière vidange huile moteur ?', type: 'date' },
      { id: 'moteur_impulseur_date', label: 'Dernière toupie (impulseur) ?', type: 'date' },
      { id: 'moteur_inject_date', label: 'Dernier test injecteurs ?', type: 'date' },
      { id: 'coude_echappement', label: 'Coude d\'échappement changé/entretenu ? Date ?', type: 'text' },
      { id: 'transmission_service', label: 'Transmission — dernier entretien ?', type: 'date' },
      { id: 'cdrive_joint', label: 'C-Drive — joint inférieur remplacé ?', type: 'yesno' },
      { id: 'cdrive_date', label: 'C-Drive — date dernier entretien ?', type: 'date' },
      { id: 'propulseur_service', label: 'Propulseur — date dernier entretien ?', type: 'date' },
      { id: 'generateur_marque', label: 'Générateur — marque, modèle, heures ?', type: 'text' },
      { id: 'generateur_service', label: 'Générateur — date dernier entretien ?', type: 'date' },
      { id: 'osmoseur_marque', label: 'Osmoseur — marque, modèle, débit (L/h) ?', type: 'text' },
      { id: 'osmoseur_membrane', label: 'Osmoseur — date dernier changement membrane ?', type: 'date' },
      { id: 'clim_nb', label: 'Climatiseurs — nombre, marque, fonctionnement ?', type: 'text' },
      { id: 'clim_service', label: 'Climatiseurs — date dernier entretien ?', type: 'date' },
    ],
  },
  {
    id: 'plomberie',
    titre: 'Partie 4 : Plomberie',
    questions: [
      { id: 'wc_marque', label: 'WC — marque, modèle, fonctionnel ?', type: 'text' },
      { id: 'wc_service', label: 'WC — date dernier entretien ?', type: 'date' },
      { id: 'pompe_eau_douce', label: 'Pompe eau douce — marque, fonctionnel ?', type: 'text' },
      { id: 'chauffe_eau', label: 'Chauffe-eau — marque, fonctionnel ?', type: 'text' },
      { id: 'reservoir_eau', label: 'Réservoir eau — dernière inspection/nettoyage ?', type: 'date' },
      { id: 'sump_pompe', label: 'Pompe sump eau grise — marque, fonctionnel ?', type: 'text' },
      { id: 'gaz_type', label: 'Type de bonbonnes gaz (EU/US) et quantité ?', type: 'text' },
    ],
  },
  {
    id: 'pieces_rechange',
    titre: 'Partie 5 : Pièces de rechange',
    questions: [
      { id: 'pieces_liste', label: 'Liste complète des pièces de rechange incluses', type: 'textarea' },
      { id: 'outils_liste', label: 'Outils restant à bord', type: 'textarea' },
    ],
  },
  {
    id: 'autres',
    titre: 'Partie 6 : Divers',
    questions: [
      { id: 'dettes', label: 'Dettes ou hypothèques sur ce bateau ?', type: 'yesno' },
      { id: 'ventilation', label: 'Ventilation forcée Amel — présente et fonctionnelle ?', type: 'yesno' },
      { id: 'chauffage_diesel', label: 'Chauffage diesel Amel — présent, dernier entretien ?', type: 'text' },
      { id: 'extras', label: 'Autres équipements inclus dans la vente ?', type: 'textarea' },
    ],
  },
  {
    id: 'defauts',
    titre: 'Partie 7 : Équipements non fonctionnels',
    questions: [
      { id: 'liste_defauts', label: 'Lister tous les équipements non en état de fonctionnement complet', type: 'textarea' },
    ],
  },
]

// ─── DÉCODEUR HIN/CIN ─────────────────────────────────────────────────────────
export const MOIS_HIN: Record<string, string> = {
  A: 'Janvier', B: 'Février', C: 'Mars', D: 'Avril', E: 'Mai', F: 'Juin',
  G: 'Juillet', H: 'Août', I: 'Septembre', J: 'Octobre', K: 'Novembre', L: 'Décembre',
}

export function decodeHIN(hin: string): {
  fabricant: string
  serie: string
  mois_fabrication: string
  annee_fabrication: number
  millesime: number
  valide: boolean
} | null {
  const clean = hin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length < 12) return null

  const fabricant = clean.slice(0, 3)
  const serie = clean.slice(3, 8)
  const moisLetter = clean.slice(8, 9)
  const anneeConstruction = parseInt('20' + clean.slice(9, 10))
  const millesime = parseInt('20' + clean.slice(10, 12))

  const mois = MOIS_HIN[moisLetter] || moisLetter

  return {
    fabricant,
    serie,
    mois_fabrication: mois,
    annee_fabrication: anneeConstruction,
    millesime: millesime || anneeConstruction,
    valide: true,
  }
}

// ─── TEMPLATES CONTRATS ───────────────────────────────────────────────────────
export type ContractData = {
  // Bateau
  bateau_marque: string
  bateau_modele: string
  bateau_annee: number
  bateau_nom: string
  bateau_immatriculation: string
  bateau_pavillon: string
  bateau_moteur: string
  bateau_num_serie: string
  // Vendeur
  vendeur_nom: string
  vendeur_prenom: string
  vendeur_adresse: string
  vendeur_nationalite: string
  vendeur_email: string
  vendeur_tel: string
  // Acheteur
  acheteur_nom: string
  acheteur_prenom: string
  acheteur_adresse: string
  acheteur_nationalite: string
  acheteur_email: string
  acheteur_tel: string
  // Transaction
  prix: number
  devise: string
  commission_pct: number
  depot_garantie: number
  date_signature: string
  lieu_signature: string
  // Broker
  broker_nom: string
  broker_email: string
  broker_tel: string
  societe: string
}

export function generateActeVente(d: Partial<ContractData>): string {
  const date = d.date_signature || new Date().toLocaleDateString('fr-FR')
  const lieu = d.lieu_signature || '___________'

  return `ACTE DE VENTE / BILL OF SALE

Entre les soussignés / Between the undersigned:

VENDEUR / SELLER:
Nom / Name: ${d.vendeur_nom || '___________'}
Prénom / First name: ${d.vendeur_prenom || '___________'}
Nationalité / Nationality: ${d.vendeur_nationalite || '___________'}
Adresse / Address: ${d.vendeur_adresse || '___________'}
Email: ${d.vendeur_email || '___________'}
Tél: ${d.vendeur_tel || '___________'}

ACHETEUR / BUYER:
Nom / Name: ${d.acheteur_nom || '___________'}
Prénom / First name: ${d.acheteur_prenom || '___________'}
Nationalité / Nationality: ${d.acheteur_nationalite || '___________'}
Adresse / Address: ${d.acheteur_adresse || '___________'}
Email: ${d.acheteur_email || '___________'}
Tél: ${d.acheteur_tel || '___________'}

IL A ÉTÉ CONVENU CE QUI SUIT / IT HAS BEEN AGREED THE FOLLOWING:

Le vendeur agissant en qualité de propriétaire du navire:
The Seller acting as the owner of the vessel:

NOM / NAME: ${d.bateau_nom || '___________'}
Marque / Brand: ${d.bateau_marque || '___________'}
Modèle / Model: ${d.bateau_modele || '___________'}
Année / Year: ${d.bateau_annee || '____'}
Moteur / Engine: ${d.bateau_moteur || '___________'}
Pavillon / Flag: ${d.bateau_pavillon || '___________'}
N° Immatriculation / Official number: ${d.bateau_immatriculation || '___________'}
N° de série / Serial number: ${d.bateau_num_serie || '___________'}

DECLARE VENDRE LA TOTALITÉ DUDIT BATEAU À L'ACHETEUR QUI ACCEPTE LES CLAUSES ET CONDITIONS SUIVANTES:
DECLARES TO SELL THE TOTALITY OF THE SAID VESSEL TO THE BUYER WHO ACCEPTS THE FOLLOWING CONDITIONS:

ÉTAT DU NAVIRE / CONDITION OF THE VESSEL:
L'acheteur déclare bien connaître le navire et l'avoir visité pour l'accepter dans l'état où il se trouve.
The buyer declares to know the vessel well, have visited it and accept it in "as is" condition.

DETTES / DEBTS:
Le vendeur déclare qu'il n'existe sur le dit navire aucune dette ni inscription hypothécaire et garantit l'acquéreur contre toute réclamation à ce sujet.
The seller declares that there is no debt or lien on the vessel and guarantees the buyer against any claim.

PRIX DE VENTE / SALE PRICE: ${d.prix ? d.prix.toLocaleString('fr-FR') : '___________'} ${d.devise || '€'}

En foi de quoi les parties étant d'accord, le présent acte a été clos et signé après lecture par chacune des parties.
In good faith, the parties agree, that the sale has been closed and signed after each party read it.

À / In: ${lieu}        Le / On: ${date}

Signature Vendeur / Seller:                    Signature Acheteur / Buyer:


_____________________________                  _____________________________


Courtier / Broker: ${d.broker_nom || '___________'} — ${d.societe || 'Caraibe Yachts'}
Email: ${d.broker_email || '___________'} — Tél: ${d.broker_tel || '___________'}
`
}

export function generateMandatExclusif(d: Partial<ContractData>): string {
  const date = d.date_signature || new Date().toLocaleDateString('fr-FR')
  const commission = d.commission_pct || 8
  const prix = d.prix ? d.prix.toLocaleString('fr-FR') : '___________'

  return `MANDAT DE VENTE EXCLUSIF / EXCLUSIVE LISTING AGREEMENT

Date: ${date}

MANDANT / PRINCIPAL (Vendeur / Seller):
Nom complet / Full name: ${d.vendeur_prenom || ''} ${d.vendeur_nom || '___________'}
Adresse / Address: ${d.vendeur_adresse || '___________'}
Email: ${d.vendeur_email || '___________'}
Tél: ${d.vendeur_tel || '___________'}

MANDATAIRE / AGENT:
${d.societe || 'CARAIBE YACHTS'}
Courtier / Broker: ${d.broker_nom || '___________'}
Email: ${d.broker_email || '___________'}
Tél: ${d.broker_tel || '___________'}

NAVIRE / VESSEL:
Marque / Brand: ${d.bateau_marque || '___________'} — Modèle / Model: ${d.bateau_modele || '___________'}
Année / Year: ${d.bateau_annee || '____'} — Nom / Name: ${d.bateau_nom || '___________'}
Immatriculation / Registration: ${d.bateau_immatriculation || '___________'}
N° de série / Serial number: ${d.bateau_num_serie || '___________'}

PRIX DEMANDÉ / ASKING PRICE: ${prix} ${d.devise || '€'}

CONDITIONS DU MANDAT EXCLUSIF:
Le mandant confie EXCLUSIVEMENT à ${d.societe || 'Caraibe Yachts'} la vente du navire décrit ci-dessus pour une durée de 6 mois renouvelable.
The principal exclusively entrusts ${d.societe || 'Caraibe Yachts'} with the sale of the above vessel for a renewable period of 6 months.

Le courtier s'engage à:
- Publier l'annonce sur tous les portails de courtage pertinents
- Organiser les visites et qualifications des acheteurs
- Assister dans les négociations et la rédaction des contrats
- Accompagner jusqu'à la signature de l'acte de vente

HONORAIRES / COMMISSION: ${commission}% du prix de vente TTC, à la charge du vendeur, payables à la signature de l'acte de vente définitif.

Fait à / Signed at: ${d.lieu_signature || '___________'}  Le / On: ${date}

Signature Vendeur / Seller:                    Signature Courtier / Broker:


_____________________________                  _____________________________
`
}

export function generateMandatOpen(d: Partial<ContractData>): string {
  const date = d.date_signature || new Date().toLocaleDateString('fr-FR')
  const commission = d.commission_pct || 8

  return `MANDAT DE VENTE OPEN / OPEN LISTING AGREEMENT

Date: ${date}

MANDANT / PRINCIPAL (Vendeur / Seller):
Nom complet / Full name: ${d.vendeur_prenom || ''} ${d.vendeur_nom || '___________'}
Adresse / Address: ${d.vendeur_adresse || '___________'}
Email: ${d.vendeur_email || '___________'}
Tél: ${d.vendeur_tel || '___________'}

MANDATAIRE / AGENT:
${d.societe || 'CARAIBE YACHTS'}
Courtier / Broker: ${d.broker_nom || '___________'}

NAVIRE / VESSEL:
Marque / Brand: ${d.bateau_marque || '___________'} — Modèle / Model: ${d.bateau_modele || '___________'}
Année / Year: ${d.bateau_annee || '____'} — Nom / Name: ${d.bateau_nom || '___________'}

PRIX DEMANDÉ / ASKING PRICE: ${d.prix ? d.prix.toLocaleString('fr-FR') : '___________'} ${d.devise || '€'}

CONDITIONS:
Mandat non exclusif — le vendeur se réserve le droit de confier la vente à d'autres courtiers.
Non-exclusive listing — the seller reserves the right to appoint other brokers.

HONORAIRES / COMMISSION: ${commission}% du prix de vente, payables à la signature de l'acte définitif.

Fait à / Signed at: ${d.lieu_signature || '___________'}  Le / On: ${date}

Signature Vendeur / Seller:                    Signature Courtier / Broker:


_____________________________                  _____________________________
`
}

export function generatePromesseVente(d: Partial<ContractData>): string {
  const date = d.date_signature || new Date().toLocaleDateString('fr-FR')
  const depot = d.depot_garantie || (d.prix ? Math.round(d.prix * 0.1) : 0)

  return `PROMESSE DE VENTE / PURCHASE & SALE AGREEMENT

Date: ${date}

VENDEUR / SELLER:
${d.vendeur_prenom || ''} ${d.vendeur_nom || '___________'}
${d.vendeur_adresse || '___________'}
Email: ${d.vendeur_email || '___________'} — Tél: ${d.vendeur_tel || '___________'}

ACHETEUR / BUYER:
${d.acheteur_prenom || ''} ${d.acheteur_nom || '___________'}
${d.acheteur_adresse || '___________'}
Email: ${d.acheteur_email || '___________'} — Tél: ${d.acheteur_tel || '___________'}

NAVIRE / VESSEL:
${d.bateau_marque || '___________'} ${d.bateau_modele || '___________'} — ${d.bateau_annee || '____'}
Nom / Name: ${d.bateau_nom || '___________'}
Immatriculation: ${d.bateau_immatriculation || '___________'}

PRIX DE VENTE CONVENU / AGREED SALE PRICE:
${d.prix ? d.prix.toLocaleString('fr-FR') : '___________'} ${d.devise || '€'}

DÉPÔT DE GARANTIE / DEPOSIT: ${depot.toLocaleString('fr-FR')} ${d.devise || '€'} (10%)
Payable à la signature de la présente promesse / Payable upon signing this agreement.

CONDITIONS SUSPENSIVES / CONTINGENCIES:
1. Expertise satisfaisante du navire / Satisfactory survey of the vessel
2. Essai en mer concluant / Satisfactory sea trial
3. Vérification titre de propriété / Verification of clear title

DÉLAIS / TIMELINE:
- Expertise à réaliser dans les 14 jours / Survey within 14 days
- Signature acte définitif sous 30 jours / Final deed within 30 days

En cas de rétractation de l'acheteur sans motif valable, le dépôt reste acquis au vendeur.
If the buyer withdraws without valid reason, the deposit is forfeited to the seller.

Intermédiaire / Broker: ${d.broker_nom || '___________'} — ${d.societe || 'Caraibe Yachts'}
Commission: ${d.commission_pct || 8}% à la charge du vendeur

Fait à / Signed at: ${d.lieu_signature || '___________'}  Le / On: ${date}

Signature Vendeur / Seller:                    Signature Acheteur / Buyer:


_____________________________                  _____________________________
`
}
