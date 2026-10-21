# Solvex Mesure — deux CRM de mesure

Une seule web app, deux espaces séparés (menu en haut) :

1. **CRM Mesure agents vocaux** (offre 2, cold call)
2. **CRM Mesure prospection consulting** (offre 1, mails un par un + réseau chaud)

But : **mesurer** quel corps de métier répond le mieux, avec quel message, par quel canal, et
comparer les cibles en pourcentages vers le 4 décembre 2026.

**L'application n'envoie rien** : aucun mail, aucun SMS, aucun appel. Le bouton « Appeler » est un
simple lien `tel:` qui ouvre le téléphone ; les cases « SMS envoyé » et « Je l'ai envoyé » se cochent
*après* avoir agi soi-même. La politique de sécurité du navigateur (CSP dans `netlify.toml`)
n'autorise de toute façon que le site lui-même et Supabase.

- Deux sites Netlify construits depuis ce même code (variable `MESURE_CRM`) :
  - **CRM agents vocaux** : https://solvex-crm-agent-vocal.netlify.app (`MESURE_CRM=vocal`)
  - **CRM consulting** : https://solvex-crm-consulting.netlify.app (`MESURE_CRM=conso`)
  - sans `MESURE_CRM`, l'app affiche les deux CRM avec un menu pour passer de l'un à l'autre
- Base : projet Supabase « Solvex OS » (`kjrydhhiodvechbievod`), tables `mesure_vocal_*` et `mesure_conso_*` uniquement

## Connexion

Compte Supabase de Solvex OS réservé à `damien.nass1@gmail.com` : adresse + **le même mot de passe que
Solvex OS**, ou à défaut « Recevoir un lien par mail » (lien magique, ou code à 6 chiffres s'il figure
dans le mail). Toute autre adresse est refusée par l'interface **et** par la base (RLS).

## Utilisation

### Agent vocal

| Écran | À quoi il sert |
|---|---|
| **File d'appel** | Leads de la phase et de la semaine courantes : rappels dus d'abord, puis jamais appelés. Gros bouton « Appeler », fiche, historique. Compteurs session X/30, semaine X/60, phase X/120. |
| Saisie (même écran) | Résultat en un clic ou une touche, cases, motif de refus, note, **Enregistrer et suivant**. |
| **Leads** | Tous les leads, filtre phase/statut, changement de statut, export CSV. |
| **Import** | CSV collé ou chargé, colonnes détectées, aperçu, doublons (téléphone, ou entreprise + commune), leads « ne pas rappeler » bloqués, choix phase + semaine, modèle CSV. |
| **Rendez-vous** | Démos/RDV décrochés, date, statut (à faire, fait, devis, signé, perdu). |
| **Tableau de bord** | Un onglet par phase : compteurs, taux, meilleur créneau et meilleur jour, motifs de refus ; filtre cold / ArtiGroup / autre. |
| **Comparaison finale** | Phases côte à côte, cold vs ArtiGroup, graphiques, alerte « échantillon trop petit » (< 60 appels), **Exporter le bilan** (HTML imprimable → PDF). |
| **Phases & réglages** | Dates, cibles, créneaux et objectifs modifiables ; données de test. |

Raccourcis de saisie (hors champ texte) : `1` pas de réponse · `2` répondeur · `3` joint pas décideur ·
`4` joint décideur · `5` refus · `6` à rappeler · `7` démo/RDV · `8` faux numéro · `9` ne pas rappeler ·
`D` décideur joint · `C` conversation > 1 min · `R` démo/RDV · `S` SMS envoyé · `N` passer ·
`Entrée` enregistrer et suivant (`Ctrl + Entrée` depuis la note).

### Consulting

| Écran | À quoi il sert |
|---|---|
| **Semaine en cours** | Cible de la semaine (onglets S1…S4), ses entreprises, l'état de chaque mail, boutons Valider / Je l'ai envoyé / réponse. Alertes copier-coller et contenus interdits. |
| Fiche entreprise | Toutes les infos, information vraie + source, mail (objet + corps éditables tant qu'il n'est pas envoyé), relances, RDV. |
| **Import** | CSV `entreprise, dirigeant, fonction, taille, ville, site, mail_pro, telephone, information_vraie, url_source_information, objet, corps`. Doublons (mail pro, ou entreprise + ville), entreprises « stop » bloquées. Les mails arrivent en brouillon. |
| **Réseau chaud** | Personnes, filtre « à relancer cette semaine », « Contacté aujourd'hui », « +1 reco », compteur de recommandations. |
| **Rendez-vous** | RDV (entreprise ou personne du réseau), type, statut, montant potentiel. |
| **Tableau de bord** | Un onglet par cible + « Réseau chaud » ; heures de travail saisies dans un champ. |
| **Comparaison finale** | Cibles côte à côte + direct vs réseau chaud, alerte < 20 mails envoyés, export du bilan. |
| **Cibles & réglages** | Semaines, dates de sourcing et d'envoi modifiables ; données de test. |

Cycle d'un mail : `brouillon` → **Valider** (`valide`) → envoi par toi depuis ta messagerie →
**Je l'ai envoyé** (`envoye`) → réponse (`repondu_positif`, `repondu_neutre`, `refus`, `rendez_vous`, `stop`, `bounce`).

Règles qualité appliquées à la validation : objet, corps, mail pro, information vraie et URL de source
obligatoires ; refus si le mail contient un prix, « VocaStork » ou « ArtiGroup » ; alerte si deux mails
d'une même cible se ressemblent à plus de 80 % ; une entreprise « stop » ne peut plus recevoir de mail
ni être réimportée.

## Formules

Agent vocal (par phase) — « joint » = tout sauf `pas_de_reponse`, `repondeur`, `faux_numero` :

| Indicateur | Formule |
|---|---|
| Taux de décrochage | joints / appels passés |
| Taux de décideur | décideurs joints / joints |
| Taux de vraie conversation | conversations > 1 min / joints |
| Taux de démo/RDV sur joints | démos / joints |
| **Taux de démo/RDV sur appels** (principal) | démos / appels passés |
| Taux de refus | (refus + ne pas rappeler) / joints |
| Appels par rendez-vous | appels passés / démos |

Consulting (par cible) — l'unité est l'entreprise contactée :

| Indicateur | Formule |
|---|---|
| Taux de réponse | entreprises ayant répondu / entreprises contactées |
| Taux de réponse positive | réponses positives (dont RDV) / contactées |
| **Taux de rendez-vous** (principal) | entreprises avec RDV / contactées |
| Délai moyen de réponse | 1re réponse − 1er envoi, en jours |
| RDV par heure de travail | RDV / heures saisies |
| RDV par recommandation (réseau) | RDV issus du réseau / recommandations obtenues |
| Panier potentiel moyen | moyenne des montants potentiels des RDV |

Les pourcentages s'affichent toujours avec le nombre brut : `22 % (13/60)`.

## Schéma des tables

Migration : [`supabase/migrations/20261021_001_mesure.sql`](supabase/migrations/20261021_001_mesure.sql).
Toutes les tables ont `id uuid`, `created_at`, `est_test boolean` (données de test), RLS activée et forcée.

**Agent vocal**

- `mesure_vocal_phases` : numero, nom, cible, date_debut, date_fin, creneau_conseille, objectif_appels
- `mesure_vocal_leads` : phase_id → phases, entreprise, dirigeant_prenom, dirigeant_nom, metier, commune, departement,
  telephone (mobile), telephone_fixe, effectif, site_web, source (`cold`, `artigroup`, `autre`), raison_inclusion,
  semaine (lundi), statut (`a_appeler`, `en_cours`, `termine`, `a_retirer`, `ne_pas_rappeler`), notes
- `mesure_vocal_appels` : lead_id → leads, date_heure, tentative, resultat (9 valeurs), duree_min, decideur_joint,
  conversation_plus_1min, demo_ou_rdv, date_rdv, rdv_statut, motif_refus, motif_refus_texte, sms_envoye, rappel_le, note

**Consulting**

- `mesure_conso_cibles` : semaine (S1…), nom, description, date_sourcing, date_envoi_1, date_envoi_2, heures_travail
- `mesure_conso_entreprises` : cible_id → cibles, entreprise, dirigeant_prenom, dirigeant_nom, fonction, taille, ville,
  departement, site_web, mail_pro, telephone, source (`sourcing`, `reseau`, `recommandation`), information_vraie,
  url_source_information, statut (`actif`, `stop`)
- `mesure_conso_mails` : entreprise_id → entreprises, type (`premier`, `relance`), objet, corps, statut (9 valeurs),
  valide_le, envoye_le, reponse_le, note_reponse
- `mesure_conso_reseau` : nom, organisation, lien_avec_solvex, ce_quil_peut_apporter, dernier_contact, prochaine_action,
  prochaine_action_le, recommandations_obtenues, note
- `mesure_conso_rdv` : entreprise_id **ou** reseau_id (un seul des deux), date, type, resultat, prochaine_etape,
  montant_potentiel_eur, statut, note
- `mesure_conso_parametres` : cle, valeur (ex. `heures_reseau`)

## Ajouter une cible

Sans toucher au code :

- **Agent vocal** : onglet *Phases & réglages* → « Ajouter une phase » (numéro, nom, cible, dates, créneau, objectif).
  Elle apparaît aussitôt dans la file d'appel, l'import, le tableau de bord (nouvel onglet) et la comparaison.
- **Consulting** : onglet *Cibles & réglages* → « Ajouter une cible » (S5, nom, dates). Elle apparaît dans la semaine
  en cours, l'import, le tableau de bord et la comparaison.

## Développement

```bash
cd solvex-mesure
npm install
npm test            # formules (node:test) — 24 tests
npm run test:e2e    # parcours complets dans Chromium headless (base en mémoire) — 18 scénarios
```

Prévisualisation locale sans toucher à la base : `npm run build:test`, puis servir `dist/`
(`npx serve dist`). Le mode `memory` est refusé par le build sur Netlify.

Structure : `src/` (HTML, CSS, JS en modules, sans framework), `src/js/lib/` (formules pures testées),
`src/js/vocal/` et `src/js/conso/` (écrans), `scripts/build.mjs` (copie `src/` vers `dist/`, ajoute
supabase-js et écrit `config.js` depuis les variables d'environnement).

## Déploiement

Variables d'environnement Netlify (déjà créées sur les deux sites) : `SUPABASE_URL`,
`SUPABASE_ANON_KEY` (clé publishable, protégée par RLS), `MESURE_ALLOWED_EMAIL`, `MESURE_CRM`. Aucune n'est dans git.

| Site | Site ID | `MESURE_CRM` |
|---|---|---|
| solvex-crm-agent-vocal | `e39cfebf-d58a-4034-b7cd-839d42e065c2` | `vocal` |
| solvex-crm-consulting | `cde44730-d474-4f01-a06d-015cb5c6b5d5` | `conso` |

Depuis un poste connecté à Netlify :

```bash
cd solvex-mesure
npx netlify-cli@17 deploy --build --prod --site e39cfebf-d58a-4034-b7cd-839d42e065c2
npx netlify-cli@17 deploy --build --prod --site cde44730-d474-4f01-a06d-015cb5c6b5d5
```

Pour le lien magique (pas nécessaire avec le mot de passe), ajouter une fois dans Supabase →
*Authentication* → *URL Configuration* → *Redirect URLs* : `https://solvex-crm-agent-vocal.netlify.app/**`
et `https://solvex-crm-consulting.netlify.app/**`.
