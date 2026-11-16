/* Réglages du site Lomaya : tout ce qui peut changer est ici, rien d'autre à toucher.
   Les prix affichés dans la page sont aussi écrits en dur dans index.html (pour Google) :
   si un prix change, le changer aux deux endroits. */
window.LOMAYA = {
  // La réservation en ligne parle au CRM Novalem (novalem-plateforme).
  // mode 'auto' : le CRM répond, on l'utilise ; sinon aperçu simulé sur les adresses d'aperçu
  // (vercel.app, localhost, ?apercu=1), et sur le vrai domaine un message « par téléphone ».
  reservation: {
    mode: 'auto',
    plateforme: 'https://novalem-plateforme.vercel.app',
    espace: 'lomaya',
  },

  contact: {
    telephone: '0690 60 97 60',
    telephoneIntl: '+590690609760',
    whatsapp: '590690609760',
    instagram: 'lomayabienetre',
    adresse: 'Immeuble 2626, Rue Henri Becquerel, ZI Jarry, 97122 Baie-Mahault',
  },

  fuseau: 'America/Guadeloupe',

  // Ouverture du centre : les réservations commencent ce jour-là (à confirmer avec Laurence)
  ouverture: '2027-01-04',

  // Les formules réservables en ligne (prix en centimes, TTC)
  formules: [
    { id: 'solo', nom: 'Séance solo', detail: '1 h 30, dont 1 h de flottaison', personnes: 1, prix: 7900, prixOuverture: 6800 },
    { id: 'duo', nom: 'Séance duo', detail: 'À deux dans le même bassin', personnes: 2, prix: 14000, prixOuverture: 11900 },
  ],

  // Tarifs d'ouverture : actif tant que la date de fin n'est pas passée (null = jusqu'à nouvel ordre)
  offreOuverture: { actif: true, fin: null },

  // Les deux bassins : couleur dans l'agenda et sur le site, décalage de départ en minutes
  cabines: [
    { id: 'cabine-1', nom: 'Cabine 1', couleur: '#d9665f', decalage: 0 },
    { id: 'cabine-2', nom: 'Cabine 2', couleur: '#5e8a83', decalage: 15 },
  ],

  // Une séance bloque la cabine 1 h 30 : 30 min d'accueil, douche et lavage + 1 h de flottaison
  dureeMinutes: 90,

  // Horaires d'ouverture par jour (0 = dimanche). À confirmer avec Laurence : le CRM fera foi.
  horaires: { 0: null, 1: ['09:00', '20:00'], 2: ['09:00', '20:00'], 3: ['09:00', '20:00'], 4: ['09:00', '20:00'], 5: ['09:00', '20:00'], 6: ['09:00', '20:00'] },

  delaiMinHeures: 2,
  horizonJours: 60,

  paiement: {
    // 'total' : la séance est payée à la réservation ; 'acompte' : seul l'acompte est payé en ligne
    mode: 'total',
    acompteCentimes: 3000,
  },

  annulationHeures: 24,
  rappel48h: true,
};
