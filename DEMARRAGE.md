# NOVALEM APP — demarrage

## Ce qui a change (version prospection)

- La **boite mail est retiree**. Tu envoies tes mails depuis ta propre
  boite (Gmail...). Quand l'app prepare un mail (RDV, fiche de
  presentation), une fenetre s'ouvre avec l'objet et le message prets :
  tu cliques **Copier**, tu colles dans ton mail et tu joins la fiche
  (bouton **telecharger le PDF** dans la fenetre).
- L'**atelier** d'un client ne genere plus le site tout seul. C'est
  devenu un simple **suivi de production** :
  - une **checklist** de ce que le client a fourni (a cocher),
  - le **lien de l'apercu Vercel** (le lien ephemere),
  - le **lien du site en ligne** (le nom de domaine achete),
  - un **depot** pour ranger tous les fichiers du client.
- La fiche de presentation (le PDF) est a jour : prix Essentiel 490 /
  Vitrine 990 / Signature 1390.

## Pour l'utiliser tout de suite

Rien a installer cote mail : tout marche des le deploiement.
Tu pousses le dossier sur GitHub, Vercel redeploie, tu te connectes,
et tu peux prospecter (Session d'appel + Reperage).

## Une seule chose optionnelle : le depot de fichiers

Le depot de fichiers dans l'atelier a besoin d'un espace de stockage.
S'il n'est pas encore active, tu verras un message dans l'atelier.
Pour l'activer (2 min, une seule fois) :

1. Supabase > **Storage** > **New bucket**
2. Nom : `web-usine`, coche **Public**, **Create**

(ou colle le contenu de `supabase/depot-fichiers.sql` dans Supabase >
SQL Editor). Tu peux tres bien prospecter sans, c'est pour plus tard.

## Coordonnees dans tes mails

La signature de tes mails reprend le telephone et l'email saisis dans
**Ma societe** (menu de gauche). Tant que ce n'est pas rempli, elle
utilise ceux de la fiche (+590 690 31 79 99 / louisprorenault@gmail.com).
