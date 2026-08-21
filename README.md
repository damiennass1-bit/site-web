# site-web

Site vitrine statique de **Solvex Automation** (`solvex-automation.com`),
hébergé sur Netlify, en remplacement du site Webador.

## Structure

```
public/            ← dossier publié en ligne
├── index.html     ← page d'accueil (landing page)
├── 404.html       ← page d'erreur
├── robots.txt
└── assets/        ← images, CSS, JS, polices
netlify.toml       ← configuration du déploiement
MIGRATION.md       ← guide de migration depuis Webador
```

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
