# Migration Webador → site fait maison (Netlify)

**Domaine :** `solvex-automation.com` — servi **avec `www`** :
`https://www.solvex-automation.com`
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
| 4 | Remplacer le `CNAME www` et l'enregistrement `A` | 10 min | Webador |
| 5 | Propagation DNS puis activation du HTTPS | 1 à 24 h | — |

À l'issue de l'étape 5, le nouveau site est en ligne sur le vrai domaine.

**À l'étape 4, ne toucher qu'aux enregistrements `A` et `CNAME`.** Laisser
les `MX` intacts : ils gèrent l'e-mail, pas le site.

Le site étant servi sur `www.solvex-automation.com`, c'est le `CNAME www` qui
porte le trafic réel — le `A` sur `@` ne sert qu'à rediriger la version sans
`www`.

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
Un transfert de `.com` prend environ 5 jours. Le code d'autorisation
s'affichant directement dans l'interface Webador (voir étape 3), il n'y a
aucun délai d'attente à ce niveau : le transfert peut être lancé le jour même,
ce qui laisse une marge confortable.

| Quand | Quoi |
|---|---|
| **Jour 1** | Récupérer le code EPP (étape 3, immédiat) et lancer le transfert + envoyer la landing page dans `public/` (étape 1) |
| **Jour 1-2** | Déployer sur Netlify et tout tester sur l'URL `.netlify.app` (étapes 2 et 4) |
| **Jour 5-6** | Transfert finalisé → brancher le domaine sur Netlify, activer le HTTPS (étape 5) |
| **Jour 6-12** | Vérification en conditions réelles, redirections SEO (étape 6) |
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

## Étape 3 — Récupérer le code EPP chez Webador

Bonne nouvelle : le code s'affiche directement, il n'y a pas de délai d'envoi
par e-mail.

**Chemin exact :** Éditeur Webador → **Mon abonnement** → **Gérer les noms de
domaine** → **Transférer**. Le code apparaît à l'écran.

- [ ] Noter le code — il a une **durée de validité limitée** (quelques jours
      selon les registrars). Ne le demander que lorsque le compte chez le
      nouveau registrar est prêt.
- [ ] Vérifier au même endroit que le **verrouillage du transfert** est
      désactivé.
- [ ] Vérifier l'**e-mail du contact propriétaire** (WHOIS) : c'est là
      qu'arrivera la demande de validation du transfert. S'il pointe vers
      `info@solvex-automation.com`, qui est inactive, **le changer d'abord**
      pour une adresse réellement relevée — sinon la validation sera perdue et
      le transfert échouera.

Le domaine étant facturé à part (20 €/an), il ne s'agit pas d'un domaine
« offert » soudé au forfait, ce qui simplifie le transfert. À confirmer malgré
tout auprès du support Webador : demander explicitement si la résiliation de
l'abonnement Pro entraîne la perte du domaine.

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
| `CNAME` | `www` | *(nom-du-site.netlify.app)* — le site lui-même |
| `A`     | `@`   | *(adresse IP fournie par Netlify)* — redirige vers `www` |

> Utiliser **les valeurs exactes affichées par Netlify** — le tableau
> ci-dessus ne montre que le format attendu.

4. Définir **`www.solvex-automation.com` comme domaine principal** — c'est
   la forme actuellement indexée par Google. Netlify redirige automatiquement
   la version sans `www` vers celle-ci.
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

### Inventaire des pages actuellement indexées

Relevé le 21 août 2026 via la recherche `site:solvex-automation.com`.
**Trois pages seulement** sont indexées — le chantier de redirection est donc
minimal.

| URL actuelle | Titre indexé par Google | Description indexée |
|---|---|---|
| `/` | Solvex Automation : on regarde où vous perdez du temps… | On code l'outil dont vous avez besoin : devis, factures, suivi d'activité, gestion clients, planning pensé pour votre métier, pas un logiciel générique. |
| `/nos-solutions` | Logiciels de gestion sur mesure, automatisation, IA | Nous analysons vos processus, combinons logiciels sur mesure, automatisations et IA pour résoudre précisément vos « points douloureux ». Une approche sur mesure. |
| `/a-propos` | À propos — Damien Nass, fondateur de Solvex Automation | L'humain derrière l'agence : Damien Nass, fondateur, et notre approche généraliste de la digitalisation. Mon parcours et ma vision. |

Ces titres et descriptions sont **déjà connus de Google et déjà associés au
domaine**. Les réutiliser — ou les reprendre de près — dans les balises
`<title>` et `<meta name="description">` de la nouvelle page limite la
rupture au moment de la bascule.

Aucune page `/contact` n'est indexée : rien à rediriger de ce côté.

### Redirections

Le fichier **`public/_redirects`** est déjà en place dans ce dépôt avec ces
URLs. Les ancres de destination (`#solutions`, `#a-propos`) restent à ajuster
selon les identifiants de sections de la landing page. Si une ancre n'existe
pas, le visiteur arrive simplement en haut de la page d'accueil : la
redirection reste valide, aucun lien n'est cassé.

### Conserver le `www`

Le site est servi sur `https://www.solvex-automation.com`. C'est cette forme
que Google a indexée. Il faut donc définir **`www.solvex-automation.com`
comme domaine principal** dans Netlify (*Domain management → Options → Set as
primary domain*), et laisser Netlify rediriger la version sans `www` vers
celle-ci. Choisir l'inverse ajouterait une redirection sur chaque visite et
une réindexation inutile.

### Google Search Console

Le message « Êtes-vous le propriétaire de solvex-automation.com ? » indique
que **le domaine n'est pas encore revendiqué**. À faire :

- [ ] Créer la propriété sur https://search.google.com/search-console
- [ ] Vérifier la propriété (le plus simple : un enregistrement DNS `TXT`
      ajouté chez le registrar)
- [ ] Après la bascule, demander la réindexation des trois URLs
- [ ] Surveiller le rapport de couverture pendant deux à quatre semaines

Utile à savoir : l'outil « changement d'adresse » de la Search Console ne
s'applique pas ici — il ne sert que lorsqu'on change réellement de nom de
domaine, ce qui n'est pas le cas.

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
