# Migration Webador → site fait maison (Netlify)

**Domaine :** `solvex-automation.com`
**Hébergeur actuel :** Webador Pro — 12,00 €/mois, depuis le 14 janvier 2026
**Prochaine échéance affichée :** 14 septembre 2026
**Renouvellement du domaine :** 14 janvier 2027 — 20,00 €/an (ligne facturée à part)
**E-mail :** `info@solvex-automation.com` — statut *Inactif*, 101,7 Ko utilisés

---

## Voie rapide : mettre le nouveau site en ligne aujourd'hui

**Changer de site et transférer le domaine sont deux opérations
indépendantes.** Le transfert prend environ 5 jours, mais il n'est pas un
prérequis : il suffit de modifier les enregistrements DNS pour que
`solvex-automation.com` pointe vers Netlify au lieu de Webador. Effet en
quelques heures.

| # | Action | Durée | Où |
|---|---|---|---|
| 1 | Envoyer la landing page dans `public/` | 5 min | GitHub |
| 2 | Importer le dépôt et déployer | 10 min | Netlify |
| 3 | Ajouter le domaine et relever les valeurs DNS | 5 min | Netlify |
| 4 | Remplacer l'enregistrement `A` et le `CNAME www` | 10 min | Webador |
| 5 | Propagation DNS puis activation du HTTPS | 1 à 24 h | — |

À l'issue de l'étape 5, le nouveau site est en ligne sur le vrai domaine.

**À l'étape 4, ne toucher qu'aux enregistrements `A` et `CNAME`.** Laisser
les `MX` intacts : ils gèrent l'e-mail, pas le site.

Si Webador refuse la modification des enregistrements DNS, basculer les
*nameservers* du domaine vers ceux de Netlify — l'option se trouve dans le
même écran de gestion du domaine. Il faudra alors recréer les `MX`
manuellement si l'e-mail doit continuer de fonctionner.

Le transfert du domaine (étape 3 du plan complet) et la résiliation
(étape 7) se traitent ensuite, tranquillement, avant le 14 septembre. Lancer
tout de même la demande de code EPP dès aujourd'hui : c'est le maillon le
plus lent.

---

## Ce que dit la situation actuelle

**Le transfert du domaine est possible dès maintenant.** Le domaine a été
enregistré le 14 janvier 2026, soit il y a plus de 60 jours : la période de
blocage ICANN qui interdit les transferts sur les domaines récents est passée.

**Le risque e-mail est quasi nul.** La boîte `info@` est inactive et contient
101,7 Ko — autant dire rien. Il n'y a pas de historique de messages à
rapatrier. Il faudra tout de même recréer l'adresse ailleurs si elle figure
sur le site, des cartes de visite ou des devis.

**Le coût actuel est de 164 €/an**, contre une douzaine d'euros après
migration. Détail plus bas.

**⚠️ Ne pas accepter l'offre « Économiser 24 € par an / Passer à la
facturation annuelle ».** Elle engage pour douze mois et ferait perdre tout
l'intérêt de la migration.

---

## Calendrier

La facturation est mensuelle, prochaine échéance le **14 septembre 2026**.
Boucler la migration avant cette date évite de payer un mois de plus.
Un transfert de `.com` prend environ 5 jours, plus 24 à 48 h pour obtenir le
code d'autorisation — c'est jouable, à condition de lancer la demande de code
tout de suite.

| Quand | Quoi |
|---|---|
| **Jour 1** | Demander le code EPP à Webador (étape 3) + envoyer la landing page dans `public/` (étape 1) |
| **Jour 2-3** | Réception du code → lancer le transfert chez le nouveau registrar |
| **Jour 2-4** | Déployer sur Netlify et tout tester sur l'URL `.netlify.app` (étapes 2 et 4) |
| **Jour 7-8** | Transfert finalisé → brancher le domaine sur Netlify, activer le HTTPS (étape 5) |
| **Jour 8-14** | Vérification en conditions réelles, redirections SEO (étape 6) |
| **Avant le 14 septembre** | Résilier Webador (étape 7) |

Si le calendrier dérape, ce n'est pas grave : un mois supplémentaire coûte
12 €. Mieux vaut payer un mois de plus que de résilier trop tôt et perdre le
domaine.

---

## Règle d'or

**Transférer le domaine d'abord, résilier Webador ensuite — jamais l'inverse.**

Tant que les étapes 1 à 6 ne sont pas terminées, le site Webador reste en
ligne et visible : personne ne voit la différence. Résilier avant d'avoir
transféré `solvex-automation.com` risque de libérer le domaine, même s'il est
payé jusqu'en janvier 2027.

---

## Étape 0 — Sauvegarder le contenu existant

Webador ne propose pas d'export du site. À faire avant tout :

- [ ] Télécharger toutes les **images** du site actuel
- [ ] Copier tous les **textes** (accueil, à propos, services, mentions légales…)
- [ ] Noter **la liste des URLs actuelles** — indispensable pour l'étape 6.
      Chercher `site:solvex-automation.com` sur Google pour voir les pages indexées.
- [ ] Noter les **coordonnées affichées** (adresse, téléphone, horaires)
- [ ] Faire une **capture d'écran de chaque page**, comme référence visuelle

### E-mail

La boîte `info@solvex-automation.com` est inactive et pratiquement vide, donc
rien à sauvegarder. Mais l'adresse doit continuer de fonctionner si elle est
communiquée quelque part.

- [ ] Vérifier si `info@` est affichée sur le site, des documents, une fiche
      Google Business, des cartes de visite
- [ ] Choisir la solution de remplacement (voir le tableau à l'étape 5)
- [ ] Noter les **enregistrements MX** actuels avant de toucher aux DNS

---

## Étape 1 — Mettre la landing page dans ce dépôt

Les fichiers vont dans `public/` :

```
public/
├── index.html          ← la landing page (remplace le fichier d'attente)
├── 404.html            ← page d'erreur
├── robots.txt
└── assets/             ← images, CSS, JS, polices
```

### Méthode simple (sans ligne de commande)

1. Aller sur https://github.com/damiennass1-bit/site-web
2. Sélectionner la branche `claude/webador-migration-ysovxe`
3. **Add file → Upload files**
4. Glisser-déposer le contenu de la landing page
5. Vérifier que le fichier principal s'appelle bien `index.html`, dans `public/`
6. **Commit changes**

### Méthode ligne de commande

Depuis le dossier de la landing page :

```bash
git clone https://github.com/damiennass1-bit/site-web.git
cd site-web
git checkout claude/webador-migration-ysovxe
# copier les fichiers dans public/
git add .
git commit -m "Ajout de la landing page"
git push -u origin claude/webador-migration-ysovxe
```

### Points à vérifier dans le HTML

- [ ] Chemins d'images **relatifs** (`assets/photo.jpg`), pas absolus
      (`file:///C:/Users/...`)
- [ ] Balises `<title>` et `<meta name="description">` renseignées
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1">`
- [ ] Pas de `<meta name="robots" content="noindex">` résiduelle — elle
      empêcherait l'indexation par Google
- [ ] Casse des noms de fichiers cohérente : Netlify distingue `Photo.JPG` de
      `photo.jpg`, contrairement à Windows

---

## Étape 2 — Déployer sur Netlify (URL de test)

1. Créer un compte sur https://app.netlify.com (gratuit)
2. **Add new site → Import an existing project → GitHub**
3. Autoriser l'accès au dépôt `damiennass1-bit/site-web`
4. Sélectionner la branche
5. Netlify lit `netlify.toml` automatiquement : dossier publié `public/`,
   pas de commande de build
6. **Deploy**

Le site est accessible sur une URL du type `https://nom-aleatoire.netlify.app`.
`solvex-automation.com` n'est pas encore concerné : Webador continue de
tourner normalement.

Chaque `git push` redéploiera le site automatiquement.

---

## Étape 3 — Demander le code EPP à Webador

À lancer **le premier jour**, car c'est le maillon le plus lent.

1. Dans le compte Webador, section **Nom de domaine → Gérer les noms de
   domaine**
2. Désactiver le **verrouillage du transfert** (*transfer lock*)
3. Demander le **code d'autorisation** — aussi appelé code EPP ou code Auth.
   Il est envoyé par e-mail, parfois sous 24 à 48 h.
4. Vérifier que l'**e-mail du contact propriétaire** (WHOIS) est bien une
   adresse accessible : la validation du transfert y sera envoyée. Si c'est
   `info@solvex-automation.com`, qui est inactive, **la changer d'abord** pour
   une adresse relevée — sinon l'e-mail de validation sera perdu et le
   transfert échouera. C'est le point de vigilance principal de cette étape.

Le domaine étant facturé à part (20 €/an), il ne s'agit pas d'un domaine
« offert » lié au forfait, ce qui simplifie le transfert. À confirmer malgré
tout auprès du support Webador : demander explicitement si la résiliation de
l'abonnement Pro entraîne la perte du domaine.

---

## Étape 4 — Tout tester sur l'URL Netlify

- [ ] Affichage **mobile** (majorité du trafic)
- [ ] Affichage tablette et grand écran
- [ ] Toutes les **images** se chargent
- [ ] Tous les **liens** fonctionnent
- [ ] Le **formulaire de contact** envoie bien un message
- [ ] Liens `tel:` et `mailto:` opérationnels
- [ ] Test de performance : https://pagespeed.web.dev

### Formulaire de contact

Un site statique ne peut pas envoyer d'e-mail seul. **Netlify Forms** est
gratuit jusqu'à 100 envois par mois — il suffit d'ajouter
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

Les messages arrivent dans l'onglet **Forms** du tableau de bord Netlify, avec
notification par e-mail à configurer.

---

## Étape 5 — Transférer le domaine et le brancher sur Netlify

### Transfert

Une fois le code EPP reçu, chez le nouveau registrar (OVH, Gandi, Infomaniak,
Cloudflare…) : lancer la procédure de **transfert entrant**, saisir
`solvex-automation.com` et le code, payer, puis valider l'e-mail de
confirmation. Comptez environ 5 jours.

Bon à savoir : un transfert de `.com` ajoute **un an à la date d'expiration**.
Le domaine expirant au 14 janvier 2027, il serait couvert jusqu'au
14 janvier 2028.

Pendant toute la durée du transfert, le site Webador reste en ligne — les DNS
ne changent pas tant qu'on ne les modifie pas.

### Branchement sur Netlify

1. Netlify : **Site settings → Domain management → Add a domain**
2. Saisir `solvex-automation.com`
3. Créer chez le registrar les enregistrements DNS affichés par Netlify :

| Type    | Nom   | Valeur                            |
|---------|-------|-----------------------------------|
| `A`     | `@`   | *(adresse IP fournie par Netlify)* |
| `CNAME` | `www` | *(nom-du-site.netlify.app)*       |

> Utiliser **les valeurs exactes affichées par Netlify** — le tableau
> ci-dessus ne montre que le format attendu.

4. Choisir le domaine principal, avec ou sans `www`. Netlify redirige
   automatiquement l'autre vers celui-ci.
5. Activer le **certificat HTTPS** (Let's Encrypt, gratuit, un clic une fois
   les DNS propagés)

Propagation DNS : de quelques minutes à 48 h. Suivi sur https://dnschecker.org

### Recréer l'adresse e-mail

| Solution | Coût | Pour qui |
|---|---|---|
| **Redirection** `info@` → boîte Gmail perso | **0 €** — incluse chez la plupart des registrars | Le plus simple ici, vu que la boîte est inactive. Permet aussi d'*envoyer depuis* `info@` via le « Send as » de Gmail. |
| **Zoho Mail** | 0 € pour 1 utilisateur, 5 Go | Vraie boîte dédiée, gratuite |
| **Infomaniak** | ~1,50 €/mois | Hébergement en Suisse, interface en français |
| **Google Workspace** | ~6 €/mois | Si Drive, Agenda et Meet pro sont nécessaires |

Ajouter ensuite les **enregistrements MX** de la solution choisie dans les DNS.
Ils sont indépendants des enregistrements `A` et `CNAME` du site web.

---

## Étape 6 — Préserver le référencement Google

Si le site Webador avait plusieurs pages indexées, rediriger les anciennes
URLs évite les erreurs 404 et la perte de position dans les résultats.

Créer un fichier `public/_redirects` :

```
# ancienne-url    nouvelle-url    code
/a-propos         /#a-propos      301
/nos-services     /#services      301
/contact          /#contact       301
```

Le code `301` (« déplacé définitivement ») transmet le référencement à la
nouvelle adresse.

Ensuite :

- [ ] Ajouter `solvex-automation.com` à **Google Search Console**
- [ ] Soumettre le sitemap, ou au minimum l'URL d'accueil
- [ ] Vérifier après quelques jours qu'aucune erreur 404 n'est signalée
- [ ] Mettre à jour la **fiche Google Business** le cas échéant

---

## Étape 7 — Résilier Webador

**Uniquement une fois que :**

- [ ] `solvex-automation.com` est bien transféré chez le nouveau registrar
      (le confirmer dans l'interface du registrar, pas seulement par e-mail)
- [ ] Le site tourne sur le vrai domaine depuis **plusieurs jours**
- [ ] Le HTTPS est actif — cadenas visible dans le navigateur
- [ ] L'adresse `info@` fonctionne : envoi **et** réception testés
- [ ] Tout le contenu a été récupéré (étape 0)

Viser une résiliation **avant le 14 septembre 2026** pour ne pas déclencher
un mois supplémentaire. Vérifier le préavis exigé dans les conditions
générales : certaines formules imposent quelques jours avant l'échéance.

---

## Coûts

| Poste | Aujourd'hui (Webador) | Après migration |
|---|---|---|
| Hébergement + site | 12,00 €/mois → **144 €/an** | Netlify : **0 €** |
| Nom de domaine `.com` | **20 €/an** | ~10-13 €/an selon le registrar |
| Certificat HTTPS | inclus | **0 €** (Let's Encrypt) |
| Formulaire de contact | inclus | **0 €** (100 envois/mois) |
| E-mail `info@` | inclus | 0 € en redirection, ou 0-6 €/mois |
| **Total** | **164 €/an** | **~12 €/an** |

Soit environ **150 € économisés par an**, en contrepartie de la maintenance
du site — qui, pour une landing page statique, se limite à modifier du HTML et
à faire un `push`.

---

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| Le site affiche encore l'ancienne version | Cache DNS ou navigateur — tester en navigation privée, vérifier sur dnschecker.org |
| « Site non sécurisé » | Certificat pas encore émis — attendre la propagation complète, puis relancer *Verify DNS configuration* dans Netlify |
| L'e-mail de validation du transfert n'arrive pas | Il part vers le contact WHOIS. S'il pointe vers `info@` (inactive), corriger le contact chez Webador et redemander |
| Les e-mails ne partent plus | Enregistrements MX écrasés — les recréer |
| Images manquantes | Chemins absolus, ou casse des noms de fichiers |
| Transfert refusé | Domaine encore verrouillé, ou code EPP expiré (valable quelques jours seulement) |
