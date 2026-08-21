# Migration Webador → site fait maison (Netlify)

Guide complet pour remplacer le site Webador par ce dépôt, sans coupure
de service et sans perdre le référencement ni les e-mails.

Le domaine est actuellement **acheté via Webador** : c'est le cas qui demande
le plus d'attention, car le nom de domaine et l'hébergement sont liés au même
abonnement.

---

## Règle d'or

**On ne touche au domaine qu'en avant-dernier, et on ne résilie Webador qu'en
dernier.** Tant que les étapes 1 à 4 ne sont pas terminées, le site Webador
reste en ligne et visible : personne ne voit la différence.

---

## Étape 0 — Sauvegarder ce qui existe chez Webador

À faire **avant tout**, car Webador ne propose pas d'export du site.

- [ ] Télécharger toutes les **images** utilisées sur le site actuel
- [ ] Copier tous les **textes** (accueil, à propos, services, mentions légales…)
- [ ] Noter **la liste des URLs actuelles** — indispensable pour l'étape 5
      (redirections). Astuce : chercher `site:TON-DOMAINE.fr` sur Google pour
      voir toutes les pages indexées.
- [ ] Noter les **coordonnées affichées** (adresse, téléphone, horaires)
- [ ] Faire une **capture d'écran de chaque page** — utile comme référence
      visuelle et comme preuve de l'existant

### ⚠️ Le piège des e-mails

Si tu as des adresses en `@TON-DOMAINE.fr` gérées par Webador :

- [ ] **Sauvegarder les messages** existants (export depuis le webmail, ou
      configuration en IMAP dans un client type Thunderbird pour tout rapatrier)
- [ ] Choisir où seront hébergés les mails ensuite (Google Workspace,
      Infomaniak, Zoho, OVH…) **avant** de changer quoi que ce soit
- [ ] Noter les **enregistrements MX** actuels

Changer les DNS sans avoir traité ce point coupe la réception des e-mails.
C'est l'erreur la plus fréquente de ce type de migration.

---

## Étape 1 — Mettre la landing page dans ce dépôt

Les fichiers de la page vont dans le dossier `public/` :

```
public/
├── index.html          ← ta landing page (remplace le fichier d'attente)
├── 404.html            ← page d'erreur
├── robots.txt
└── assets/             ← images, CSS, JS, polices
```

### Méthode simple (sans ligne de commande)

1. Aller sur https://github.com/damiennass1-bit/site-web
2. Sélectionner la branche `claude/webador-migration-ysovxe`
3. **Add file → Upload files**
4. Glisser-déposer le contenu de ta landing page
5. Vérifier que le fichier principal s'appelle bien `index.html` et qu'il est
   dans `public/`
6. **Commit changes**

### Méthode ligne de commande

Depuis le dossier de ta landing page, sur ton ordinateur :

```bash
git clone https://github.com/damiennass1-bit/site-web.git
cd site-web
git checkout claude/webador-migration-ysovxe
# copier tes fichiers dans public/
git add .
git commit -m "Ajout de la landing page"
git push -u origin claude/webador-migration-ysovxe
```

### Points à vérifier dans le HTML

- [ ] Les chemins des images sont **relatifs** (`assets/photo.jpg`) et non
      absolus vers un disque local (`file:///C:/Users/...`)
- [ ] Présence des balises `<title>` et `<meta name="description">`
- [ ] Balise `<meta name="viewport" content="width=device-width, initial-scale=1">`
      pour l'affichage mobile
- [ ] Retirer `<meta name="robots" content="noindex">` s'il y en a une —
      elle empêcherait Google d'indexer le site

---

## Étape 2 — Déployer sur Netlify (URL de test)

1. Créer un compte sur https://app.netlify.com (gratuit)
2. **Add new site → Import an existing project → GitHub**
3. Autoriser Netlify à accéder au dépôt `damiennass1-bit/site-web`
4. Sélectionner la branche à déployer
5. Netlify lit automatiquement `netlify.toml` : le dossier publié est `public/`,
   il n'y a pas de commande de build
6. **Deploy**

Le site est alors accessible sur une URL du type
`https://nom-aleatoire.netlify.app`. Le domaine réel n'est **pas encore**
concerné : Webador continue de tourner normalement.

Chaque `git push` sur cette branche redéploiera le site automatiquement.

---

## Étape 3 — Tout tester sur l'URL Netlify

- [ ] Affichage sur **mobile** (le plus important : la majorité du trafic)
- [ ] Affichage sur tablette et grand écran
- [ ] Toutes les **images** se chargent
- [ ] Tous les **liens** fonctionnent
- [ ] Le **formulaire de contact** envoie bien un message (voir plus bas)
- [ ] Les liens `tel:` et `mailto:` s'ouvrent correctement
- [ ] Test de vitesse : https://pagespeed.web.dev

### Formulaire de contact

Un site statique ne peut pas envoyer d'e-mail tout seul. Netlify propose
**Netlify Forms**, gratuit jusqu'à 100 envois par mois. Il suffit d'ajouter
`data-netlify="true"` à la balise `<form>` :

```html
<form name="contact" method="POST" data-netlify="true">
  <input type="hidden" name="form-name" value="contact">
  <label>Nom <input type="text" name="nom" required></label>
  <label>E-mail <input type="email" name="email" required></label>
  <label>Message <textarea name="message" required></textarea></label>
  <button type="submit">Envoyer</button>
</form>
```

Les messages reçus apparaissent dans l'onglet **Forms** du tableau de bord
Netlify, avec notification par e-mail à configurer.

---

## Étape 4 — Récupérer le nom de domaine

Le domaine étant chez Webador, il y a deux options.

### Option A — Transférer le domaine chez un autre registrar ✅ recommandé

Le domaine devient totalement indépendant de Webador. Coût : environ
10-15 € par an, qui inclut généralement un an de renouvellement en plus.

1. **Dans le compte Webador** : désactiver le verrouillage du domaine
   (*transfer lock*) et demander le **code d'autorisation** — appelé code EPP,
   code Auth, ou code de transfert AFNIC pour un `.fr`. Il arrive par e-mail,
   parfois sous 24-48 h.
2. Vérifier que l'**e-mail du contact propriétaire** (WHOIS) est une adresse
   à laquelle tu as accès — la validation du transfert y sera envoyée.
3. **Chez le nouveau registrar** (OVH, Gandi, Infomaniak, Cloudflare…) :
   lancer la procédure de transfert entrant, saisir le domaine et le code
   d'autorisation, payer.
4. **Valider l'e-mail de confirmation** reçu.
5. Attendre : comptez environ **5 jours** pour un `.com`, souvent moins pour
   un `.fr`.

Pendant toute la durée du transfert, le site Webador reste en ligne : les DNS
ne changent pas tant qu'on ne les modifie pas.

**Blocages possibles :**
- Domaine acheté ou transféré il y a **moins de 60 jours** → transfert refusé
  par les règles de l'ICANN, il faut attendre
- Domaine expirant dans moins de 15 jours → le renouveler d'abord
- Domaine offert dans le forfait Webador → vérifier les conditions, un
  transfert anticipé peut être facturé

### Option B — Garder le domaine chez Webador, changer seulement les DNS

Plus rapide (effet en quelques heures), mais tu restes dépendant de leur
abonnement — et souvent le domaine est lié au forfait payant, donc résilier
Webador te ferait perdre le domaine. **À vérifier dans leurs conditions avant
de choisir cette option.**

Dans les paramètres DNS du domaine chez Webador, remplacer les
enregistrements existants par ceux fournis par Netlify (voir étape 5).

---

## Étape 5 — Brancher le domaine sur Netlify

Une fois le domaine transféré (option A) ou accessible en DNS (option B) :

1. Dans Netlify : **Site settings → Domain management → Add a domain**
2. Saisir le domaine, par exemple `TON-DOMAINE.fr`
3. Netlify affiche les enregistrements DNS à créer chez le registrar :

| Type    | Nom   | Valeur                            |
|---------|-------|-----------------------------------|
| `A`     | `@`   | `75.2.60.5` *(valeur donnée par Netlify)* |
| `CNAME` | `www` | `nom-du-site.netlify.app`         |

> ⚠️ Utiliser **les valeurs exactes affichées par Netlify**, pas celles
> ci-dessus : elles servent uniquement d'exemple de format.

**Alternative plus simple** : déléguer le domaine aux serveurs DNS de Netlify
en remplaçant les *nameservers* chez le registrar par ceux de Netlify. Netlify
gère alors tous les enregistrements automatiquement. À éviter si tes e-mails
sont ailleurs et que tu ne veux pas recréer les MX manuellement.

4. **Conserver les enregistrements MX** si les e-mails sont gérés ailleurs —
   ils sont indépendants du site web
5. Choisir le domaine principal : avec ou sans `www` (peu importe, mais rester
   cohérent). Netlify redirige automatiquement l'autre vers celui-ci.
6. Activer le **certificat HTTPS** (Let's Encrypt, gratuit, en un clic dans
   Netlify une fois les DNS propagés)

La propagation DNS prend de quelques minutes à 48 h. Suivi possible sur
https://dnschecker.org

---

## Étape 6 — Préserver le référencement Google

Si le site Webador avait plusieurs pages indexées, il faut rediriger les
anciennes URLs vers les nouvelles. Sinon : erreurs 404 et perte de position
dans les résultats de recherche.

Créer un fichier `public/_redirects` :

```
# ancienne-url    nouvelle-url    code
/a-propos         /#a-propos      301
/nos-services     /#services      301
/contact          /#contact       301
```

Le code `301` signifie « déplacé définitivement » : c'est celui qui transmet
le référencement à la nouvelle adresse.

Ensuite :

- [ ] Créer un compte **Google Search Console** et y ajouter le domaine
- [ ] Soumettre le sitemap (ou au minimum l'URL d'accueil) pour accélérer
      la réindexation
- [ ] Vérifier après quelques jours qu'aucune erreur 404 n'est remontée
- [ ] Mettre à jour la **fiche Google Business** si tu en as une

---

## Étape 7 — Résilier Webador

**Seulement une fois que :**

- [ ] Le nouveau site tourne sur le vrai domaine depuis **au moins une semaine**
- [ ] Le HTTPS est actif (cadenas visible dans le navigateur)
- [ ] Les e-mails fonctionnent — envoi **et** réception testés
- [ ] Le domaine est bien transféré (option A) ou tu as confirmé qu'il ne sera
      pas perdu (option B)
- [ ] Tout le contenu a été récupéré (étape 0)

Attention à la **date de renouvellement** de l'abonnement Webador : résilier
juste après un prélèvement annuel revient à payer une année inutilisée.
Beaucoup de formules exigent un préavis avant l'échéance.

---

## Récapitulatif des coûts

| Poste                        | Webador           | Nouvelle solution           |
|------------------------------|-------------------|-----------------------------|
| Hébergement                  | inclus (abonnement) | Netlify : **0 €**         |
| Nom de domaine               | inclus            | ~10-15 €/an (registrar)     |
| Certificat HTTPS             | inclus            | **0 €** (Let's Encrypt)     |
| Formulaire de contact        | inclus            | **0 €** (100 envois/mois)   |
| E-mails pro `@domaine`       | selon formule     | 0 à 6 €/mois selon l'offre  |

---

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| Le site affiche encore l'ancienne version | Cache DNS ou navigateur — tester en navigation privée, vérifier sur dnschecker.org |
| « Site non sécurisé » | Certificat pas encore émis — attendre la propagation DNS complète, puis relancer *Verify DNS configuration* dans Netlify |
| Les e-mails ne partent plus | Enregistrements MX écrasés — les recréer à l'identique |
| Images manquantes | Chemins absolus ou casse des noms de fichiers (`Photo.JPG` ≠ `photo.jpg` — Netlify est sensible à la casse, pas Windows) |
| Transfert de domaine refusé | Domaine verrouillé, acheté il y a moins de 60 jours, ou code EPP expiré |
