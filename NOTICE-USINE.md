# USINE A SITES — notice d'installation (une seule fois)

## 1. Supabase (2 min)
1. Ouvre Supabase > ton projet > SQL Editor
2. Colle tout le contenu de `supabase/usine-schema.sql` et clique Run
   (cree la table web_usine + le bucket de stockage web-usine)

## 2. Token GitHub (3 min)
1. github.com > ta photo en haut a droite > Settings
2. Tout en bas a gauche : Developer settings > Personal access tokens > Fine-grained tokens > Generate new token
3. Nom : `novalem-usine` / Expiration : 1 an / Repository access : All repositories
4. Permissions > Repository permissions :
   - Administration : Read and write (pour creer les repos)
   - Contents : Read and write (pour pousser les fichiers)
5. Generate token, copie-le (il commence par github_pat_)

## 3. Token Vercel (1 min)
1. vercel.com > ta photo > Account Settings > Tokens
2. Create : nom `novalem-usine`, scope Full Account, expiration 1 an
3. Copie le token

## 4. Variables Vercel (2 min)
Dans Vercel > projet btprecruit-crm > Settings > Environment Variables, ajoute :
- `GITHUB_TOKEN`  = le token GitHub
- `GITHUB_OWNER`  = LEXONOS
- `VERCEL_TOKEN`  = le token Vercel
(ANTHROPIC_API_KEY, SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY existent deja)

## 5. Vercel Pro (obligatoire pour la generation)
La generation IA prend 1 a 3 minutes par fichier : il faut le plan Pro
(maxDuration 300 s, deja configure dans vercel.json).
Settings > General > upgrade, ou via le dashboard Billing.

## 6. Deploiement
Pousse ces fichiers sur GitHub, Vercel redeploie tout seul :
- api/usine.js                       (nouveau — 11e fonction sur 12)
- public/sites-usine.html            (nouveau)
- public/templates/love-dogs/*       (nouveau)
- supabase/usine-schema.sql          (nouveau)
- public/sites.html                  (modifie : lien "Usine a sites" dans la nav)
- vercel.json                        (modifie : rewrite + maxDuration)

## Utilisation
CRM Sites > bouton "Usine a sites" (ou /sites-usine?client=ID depuis une fiche)
1. Choisir le client, deposer tous les fichiers en vrac
2. Trier avec l'IA, relire la fiche, valider
3. Generer le site (template Love Dog's pour l'instant)
4. Mettre en ligne : repo GitHub + Vercel automatiques, le lien
   xxx.vercel.app se range tout seul dans les Liens de la fiche client
