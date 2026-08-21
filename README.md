# site-web

Site vitrine statique de **Solvex Automation** (`solvex-automation.com`),
hébergé sur Netlify, en remplacement du site Webador.

## Structure

```
public/                  ← dossier publié en ligne
├── index.html           ← page d'accueil (CSS et JS intégrés)
├── confidentialite.html ← politique de confidentialité
├── merci.html           ← confirmation d'envoi du formulaire
├── 404.html             ← page d'erreur
├── _redirects           ← redirections 301 des anciennes URLs Webador
├── robots.txt
├── sitemap.xml
└── assets/              ← logo, portrait, captures d'écran
netlify.toml             ← configuration du déploiement
MIGRATION.md             ← guide de migration depuis Webador
```

Le site est en HTML statique autonome : pas de framework, pas de dépendance,
pas d'étape de build. Le JavaScript ne sert qu'aux animations, au menu mobile
et à l'accordéon des questions — **la totalité du contenu est lisible sans
JavaScript**, ce qui est la condition pour être correctement indexé.

## Points à connaître avant de modifier

- **Le lien « Réserver un créneau »** pointe vers `#form` faute d'URL de prise
  de rendez-vous. Un commentaire dans `public/index.html` marque l'endroit
  exact à modifier.
- **Le formulaire** utilise Netlify Forms (`data-netlify="true"`). Les envois
  arrivent dans l'onglet *Forms* du tableau de bord Netlify et le visiteur est
  redirigé vers `merci.html`. Il ne fonctionne qu'une fois déployé sur
  Netlify — en local, l'envoi échoue, c'est normal.
- **Les styles sont en ligne dans les balises**, hérités de l'outil de design
  d'origine. Les états `:hover` et `:focus` sont regroupés dans le `<style>`
  de l'en-tête, sous des classes `i1`, `i2`, etc.

## Développement local

Aucune dépendance, aucune étape de build. Pour prévisualiser :

```bash
# Python (déjà installé sur macOS et Linux)
python3 -m http.server 8000 --directory public

# ou Node
npx serve public
```

Puis ouvrir http://localhost:8000

## Mise en ligne

Chaque `push` sur la branche connectée à Netlify déclenche un déploiement
automatique. Les *deploy previews* permettent de vérifier une modification
avant de la publier.

## Migration depuis Webador

Voir **[MIGRATION.md](MIGRATION.md)** : sauvegarde du contenu existant,
transfert du nom de domaine, configuration DNS, redirections SEO et
résiliation de l'abonnement.
