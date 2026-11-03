// lib/chasse/nd-mots.js — listes de mots du moteur « nouveaux domaines » (pas une route : fichier en _)
// Mots que les dictionnaires ne connaissent pas (metiers abreges, prenoms,
// noms de famille courants, mots d'ici) : ils aident a decouper un nom de
// domaine colle ("alloclimservice" -> "allo clim service") avant de le
// chercher dans l'annuaire des entreprises.

// Metiers, abreviations et mots commerciaux frequents dans les noms de domaine
const MOTS_METIER = (
  'clim climatisation froid frigo frigoriste vmc resto restau snack food truck foodtruck burger pizza sushi bokit accras colombo rhum punch ' +
  'immo reno renov renovation deco archi elec electro electricite info informatique compta conseil conseils kine osteo dentaire medical pharma sante ' +
  'beaute coiffure coiff nails nail lash lashes spa massage tattoo tatoo barber barbershop coach fitness gym crossfit yoga danse dance zumba ' +
  'auto autos moto motos scoot scooter quad car cars wash garage pneu pneus carrosserie loc location locations rent rental boat boats bateau bateaux ' +
  'nautic nautique marine yacht yachts catamaran jetski dive plongee kayak excursion excursions tour tours travel voyage voyages event events evenementiel ' +
  'photo photos video videos drone drones studio design web digital market shop store stores boutique bio eco green solar solaire energie energy ' +
  'photovoltaique water eau fontaine fontaines piscine piscines pool pools jardin jardins paysage paysagiste garden clean cleaning nettoyage pressing laverie ' +
  'transport transports taxi taxis vtc logistique livraison express securite secu alarme alarmes surveillance btp batiment construction travaux ' +
  'maconnerie menuiserie alu aluminium metal metallerie bois toiture charpente peinture platrerie carrelage plomberie plombier chauffage sanitaire ' +
  'habitat maison maisons home villa villas gite gites bungalow bungalows lodge resort hotel residence appart appartement formation academy academie ' +
  'ecole school permis creche nounou services service pro group groupe holding invest capital patrimoine finance financement credit assurance ' +
  'courtage courtier expert expertise audit juridique avocat avocats notaire cabinet agency agence consulting com communication media prod production ' +
  'music musique sound lumiere print impression imprimerie enseigne enseignes flocage textile mode fashion bijoux jewelry cosmetique cosmetiques parfum ' +
  'fleur fleurs flower flowers cadeau cadeaux gift jouet jouets kids enfant enfants bebe baby pet pets chien chiens chat chats dog dogs cat veto veterinaire ' +
  'animaux ferme agri agricole peche poisson poissonnerie fruits legumes epicerie marche cave vins wine bar lounge club night grill bbq traiteur ' +
  'patisserie boulangerie glacier glaces sorbet sorbets chocolat chocolaterie cafe coffee juice jus smoothie smoothies container conteneur conteneurs ' +
  'drive pizzeria creperie brasserie bistrot restaurant restaurants hebergement location locatif gestion syndic conciergerie concierge ' +
  'presta prestation prestations depannage reparation installation entretien maintenance multiservices'
).split(/\s+/);

// Mots d'ici (Guadeloupe, Martinique, Iles du Nord) et creole courant dans les enseignes
const MOTS_LOCAUX = (
  'gwada gwadloup guadeloupe karukera karu madinina matnik martinique antilles antillais antillaise caraibe caraibes caribbean ' +
  'kreyol creole zouk gwoka lakay doudou kaz ti zanmi lanmou bel pitt mizik sosyete jarry gosier abymes lamentin moule capesterre ' +
  'deshaies bouillante goyave desirade saintes galante gustavia marigot'
).split(/\s+/);

// Prenoms courants (France + Antilles) : "chrismarine" -> "chris marine"
const PRENOMS = (
  'jean pierre michel andre philippe alain jacques bernard marie nathalie isabelle sylvie catherine christine francoise sophie sandrine stephanie ' +
  'valerie celine julie aurelie laura sarah camille chloe emma lea manon ines jade louise alice lina rose anna eva zoe clara lucie mathilde pauline ' +
  'elodie emilie audrey melanie laetitia vanessa jessica cindy kevin thomas nicolas julien maxime alexandre antoine romain guillaume anthony ' +
  'sebastien jeremy jonathan florian quentin vincent david olivier frederic laurent christophe eric patrick thierry pascal didier gerard daniel ' +
  'dominique yves claude patrice franck fabrice cedric ludovic gregory mickael loic benoit arnaud damien fabien jerome mathieu matthieu adrien hugo ' +
  'lucas louis gabriel raphael leo jules arthur nathan ethan noah tom theo paul enzo mael sacha axel mohamed yanis rayan adam samuel dylan bryan ' +
  'steve steeve johan rudy willy teddy freddy jimmy johnny harry chris christian christelle christiane murielle josiane georges gilles serge bruno ' +
  'denis marc luc hugues herve kenzo yohan yannick wilfried fred eddy jessy jordan mathis lenny kylian noa ilan maeva maelle naomie ruth nadege ' +
  'nadia rosemonde ginette lucette micheline huguette yolande gisele josette liliane magali karine corinne carole sabrina jennifer marlene ' +
  'jocelyne mireille monique martine brigitte annie chantal danielle odile evelyne fabienne severine delphine virginie caroline estelle ' +
  'marion morgane oceane justine charlotte margaux juliette agathe romane ambre nina lola mia leana elsa victoria marco tony alex max sam ben ' +
  'joe jo fanny tiffany cynthia sonia sylvain hubert jacky jose joel roland rene raymond henri lucien marcel robert roger albert fernand ' +
  'gaston leon emile felix victor oscar tim jim bob'
).split(/\s+/);

// Noms de famille tres courants (France, Antilles) : "boulangeriedupont" -> "boulangerie dupont"
const NOMS = (
  'martin bernard thomas petit robert richard durand dubois moreau laurent simon michel lefebvre leroy roux david bertrand morel fournier girard ' +
  'bonnet dupont lambert fontaine rousseau vincent muller lefevre faure andre mercier blanc guerin boyer garnier chevalier francois legrand gauthier ' +
  'garcia perrin robin clement morin nicolas henry roussel mathieu gautier masson marchand duval denis dumont marie lemaire noel meyer dufour meunier ' +
  'brun blanchard giraud joly riviere lucas brunet gaillard barbier arnaud martinez gerard roche renard schmitt roy leroux colin vidal caron picard ' +
  'roger fabre aubert lemoine renaud dumas lacroix olivier philippe bourgeois pierre benoit rey leclerc payet rolland leclercq guillaume lecomte lopez ' +
  'jean dupuy guillot hubert berger carpentier sanchez dupuis moulin louis deschamps huet vasseur perez boucher fleury royer klein jacquet adam paris ' +
  'poirier marty aubry guyot carre charles renault charpentier menard maillard baron bertin bailly herve schneider fernandez collet leger bouvier ' +
  'julien prevost millet perrot daniel cousin germain breton besson langlois remy pelletier leveque perrier leblanc barre lebrun marchal weber mallet ' +
  'hamon boulanger jacob monnier michaud rodriguez guichard gillet etienne grondin poulain tessier chevallier collin chauvin bouchet gay lemaitre ' +
  'benard marechal humbert reynaud antoine hoarau perret barthelemy cordier pichon lejeune gilbert lamy delaunay pasquier carlier laporte ' +
  'joseph alexandre alexis hippolyte theophile anselme florent lubin casimir celestin placide sylvestre edouard auguste bienvenu beaujour belair ' +
  'calixte zenon jeanne cesaire'
).split(/\s+/);

// Mots vides : jamais utiles pour reconnaitre une entreprise
const MOTS_VIDES = new Set(('le la les l de du des d et a au aux en un une the and of my mon ma mes ton ta tes votre vos notre nos chez par pour sur ' +
  'avec www fr').split(/\s+/));

// Petits mots (2-3 lettres) acceptes pour decouper un nom colle. Les gros
// dictionnaires ne fournissent que des mots de 4 lettres et plus : sinon
// "financia" deviendrait "fi nan ci a".
const COURTS = ('de la le les du des et en un une au aux sur par ma mon ton ta ti ka my the and of by to go run fun bio eco spa car bar pub art zen top ' +
  'pro web net box lab hub fit gym tea eat bbq vtc btp eau ile mer sol bel bon big new ice sun sea sky sud nord est max kid mix pop ' +
  'bay one two dog cat pet hot red job net app pc it gp mq dom tom cap vie bus').split(/\s+/);

// Mots trop generiques pour prouver qu'un nom de domaine = une entreprise
const GENERIQUES = new Set(('services service groupe group holding societe ste compagnie cie entreprise entreprises france pro pros ' +
  'guadeloupe gwada gwadloup karukera antilles antillais antillaise caraibe caraibes caribbean martinique madinina matnik ' +
  'sas sarl eurl sasu sa sci snc ei eirl earl scp selarl selas ets etablissements ' +
  'online shop store web site sites digital consulting conseil conseils agence agency international global plus fils freres').split(/\s+/));

// Reperes locaux dans le nom de domaine lui-meme (sans tirets ni accents).
// sub = trouve n'importe ou dans le nom, tok = seulement comme mot entier.
// Les noms de lieux ambigus (Sainte-Anne, Le Lamentin, Saint-Louis...) sont
// volontairement absents : ils existent aussi en metropole.
const SIGNAUX = [
  ['guadeloupe', 'GP', 'sub'], ['gwadloup', 'GP', 'sub'], ['gwada', 'GP', 'sub'], ['karukera', 'GP', 'sub'], ['gwoka', 'GP', 'sub'], ['bokit', 'GP', 'sub'],
  ['971', 'GP', 'tok'], ['gpe', 'GP', 'tok'], ['karu', 'GP', 'tok'],
  ['pointeapitre', 'GP', 'sub'], ['abymes', 'GP', 'sub'], ['gosier', 'GP', 'sub'], ['baiemahault', 'GP', 'sub'], ['jarry', 'GP', 'sub'],
  ['saintfrancois', 'GP', 'sub'], ['lemoule', 'GP', 'sub'], ['capesterr', 'GP', 'sub'], ['basseterre', 'GP', 'sub'], ['troisrivieres', 'GP', 'sub'],
  ['deshaies', 'GP', 'sub'], ['bouillante', 'GP', 'sub'], ['petitbourg', 'GP', 'sub'], ['sainterose', 'GP', 'sub'], ['morneaeau', 'GP', 'sub'],
  ['petitcanal', 'GP', 'sub'], ['ansebertrand', 'GP', 'sub'], ['vieuxhabitants', 'GP', 'sub'], ['gourbeyre', 'GP', 'sub'], ['mariegalante', 'GP', 'sub'],
  ['grandbourg', 'GP', 'sub'], ['terredehaut', 'GP', 'sub'], ['lessaintes', 'GP', 'sub'], ['desirade', 'GP', 'sub'], ['houelbourg', 'GP', 'sub'], ['raizet', 'GP', 'sub'],
  ['martinique', 'MQ', 'sub'], ['madinina', 'MQ', 'sub'], ['matnik', 'MQ', 'sub'], ['972', 'MQ', 'tok'], ['fortdefrance', 'MQ', 'sub'], ['schoelcher', 'MQ', 'sub'],
  ['troisilets', 'MQ', 'sub'], ['sainteluce', 'MQ', 'sub'], ['levauclin', 'MQ', 'sub'],
  ['sxm', 'NORD', 'tok'], ['stbarth', 'NORD', 'sub'], ['saintbarth', 'NORD', 'sub'], ['stbarts', 'NORD', 'sub'], ['gustavia', 'NORD', 'sub'], ['grandcase', 'NORD', 'sub'],
  ['sbh', 'NORD', 'tok'], ['977', 'NORD', 'tok'], ['978', 'NORD', 'tok'],
  ['antilles', 'ANT', 'sub'], ['antillais', 'ANT', 'sub'], ['caraibe', 'ANT', 'sub'], ['caribbean', 'ANT', 'sub'], ['kreyol', 'ANT', 'sub'], ['zouk', 'ANT', 'tok'], ['lakay', 'ANT', 'tok']
];

// Divisions NAF (2 premiers chiffres du code APE) -> activite lisible
const NAF = {
  '01': 'Agriculture, élevage', '02': 'Sylviculture', '03': 'Pêche, aquaculture', '05': 'Extraction', '06': 'Extraction', '07': 'Extraction', '08': 'Carrières',
  '09': 'Services aux industries extractives', '10': 'Industrie alimentaire', '11': 'Fabrication de boissons', '12': 'Tabac', '13': 'Textile', '14': 'Habillement',
  '15': 'Cuir, chaussure', '16': 'Travail du bois', '17': 'Papier, carton', '18': 'Imprimerie', '19': 'Raffinage', '20': 'Industrie chimique', '21': 'Industrie pharmaceutique',
  '22': 'Caoutchouc, plastique', '23': 'Matériaux (verre, béton...)', '24': 'Métallurgie', '25': 'Produits métalliques', '26': 'Électronique, informatique',
  '27': 'Équipements électriques', '28': 'Machines et équipements', '29': 'Industrie automobile', '30': 'Matériels de transport', '31': 'Fabrication de meubles',
  '32': 'Autres industries', '33': 'Réparation, installation de machines', '35': 'Énergie (électricité, gaz, froid)', '36': 'Eau (captage, distribution)',
  '37': 'Eaux usées', '38': 'Déchets, récupération', '39': 'Dépollution', '41': 'Construction de bâtiments', '42': 'Génie civil', '43': 'Travaux du bâtiment (second œuvre)',
  '45': 'Commerce et réparation auto / moto', '46': 'Commerce de gros', '47': 'Commerce de détail', '49': 'Transport terrestre', '50': 'Transport maritime',
  '51': 'Transport aérien', '52': 'Logistique, entreposage', '53': 'Courrier, livraison', '55': 'Hébergement', '56': 'Restauration', '58': 'Édition',
  '59': 'Vidéo, cinéma, son', '60': 'Radio, télévision', '61': 'Télécommunications', '62': 'Informatique, développement', '63': 'Services d\'information',
  '64': 'Services financiers', '65': 'Assurance', '66': 'Courtage, services financiers', '68': 'Immobilier', '69': 'Juridique, comptabilité',
  '70': 'Conseil de gestion, holding', '71': 'Architecture, ingénierie', '72': 'Recherche', '73': 'Publicité, études de marché', '74': 'Design, photo, traduction',
  '75': 'Vétérinaire', '77': 'Location (véhicules, matériel)', '78': 'Emploi, intérim', '79': 'Agence de voyage, tourisme', '80': 'Sécurité, gardiennage',
  '81': 'Nettoyage, entretien, espaces verts', '82': 'Services aux entreprises', '84': 'Administration publique', '85': 'Enseignement, formation',
  '86': 'Santé', '87': 'Hébergement médico-social', '88': 'Action sociale', '90': 'Arts, spectacle', '91': 'Culture, musées', '92': 'Jeux d\'argent',
  '93': 'Sport, loisirs', '94': 'Association, organisation', '95': 'Réparation (informatique, objets)', '96': 'Services à la personne (coiffure, beauté...)',
  '97': 'Ménages employeurs', '98': 'Ménages', '99': 'Organisations extraterritoriales'
};

// Formes juridiques les plus frequentes (code INSEE -> libelle court)
const FORMES_JURIDIQUES = {
  '1000': 'Entrepreneur individuel', '5499': 'SARL', '5498': 'EURL', '5710': 'SAS', '5720': 'SASU', '5599': 'SA', '5202': 'SNC', '6540': 'SCI',
  '6599': 'Société civile', '6585': 'SCP', '5485': 'SELARL', '5785': 'SELAS', '6533': 'EARL', '9220': 'Association', '9221': 'Association'
};

module.exports = { MOTS_METIER, MOTS_LOCAUX, PRENOMS, NOMS, MOTS_VIDES, COURTS, GENERIQUES, SIGNAUX, NAF, FORMES_JURIDIQUES };
