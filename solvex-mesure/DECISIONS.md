# DECISIONS — choix faits sans demander

1. **Dossier séparé `solvex-mesure/`** dans le dépôt `site-web`, car le dépôt contient déjà le site vitrine
   Solvex (non touché). Le site Netlify `solvex-mesure` a son propre `netlify.toml` dans ce dossier.
2. **Front en HTML/CSS/JS natif** (modules ES, sans framework ni bundler). Seule dépendance :
   `@supabase/supabase-js` 2.117.2, copiée dans `dist/vendor/` au build (aucun CDN).
3. **Table des phases** : le cahier des charges cite à la fois `mesure_phases` et `mesure_vocal_phases`.
   Pour respecter les préfixes imposés, les phases vocales sont dans `mesure_vocal_phases` et le calendrier
   consulting dans `mesure_conso_cibles`. Rien n'est partagé entre les deux CRM.
4. **Colonnes ajoutées** au schéma demandé : `est_test` partout (bouton « Vider les données de test »),
   `numero` et `objectif_appels` sur les phases, `notes` sur les leads, `rdv_statut` sur les appels
   (statut du RDV vocal sans table supplémentaire), `description` et `heures_travail` sur les cibles,
   `statut` (`actif`/`stop`) sur les entreprises, table `mesure_conso_parametres` pour les heures du réseau chaud.
   `dirigeant` est découpé en `dirigeant_prenom` / `dirigeant_nom`.
5. **Sécurité** : une fonction `public.mesure_is_owner()` compare l'e-mail du jeton à
   `damien.nass1@gmail.com` ; une policy unique par table (`to authenticated`), RLS forcée, droits du rôle
   `anon` retirés. L'interface refuse aussi toute autre adresse avant l'envoi du lien.
6. **Configuration sans secret dans git** : `scripts/build.mjs` écrit `config.js` à partir des variables
   Netlify. La clé utilisée est la clé *publishable* Supabase : elle est publique par nature (visible dans le
   navigateur) et ne donne accès à rien sans connexion grâce à la RLS.
7. **Connexion** : lien magique Supabase (PKCE) + champ « code » de secours si le modèle de mail Supabase
   contient le code. Pas de mot de passe.
8. **« Joint »** = tout sauf `pas_de_reponse`, `repondeur`, `faux_numero` (règle du cahier des charges).
   Décideur / conversation / démo ne comptent que sur un appel joint (une case cochée sur un répondeur est
   ignorée). Choisir « Joint le décideur » coche « décideur » ; choisir « Démo / RDV » coche décideur,
   conversation et démo.
9. **Refus** = `refus` + `ne_pas_rappeler` (les deux sont des refus du prospect).
10. **Statut du lead après appel** : `ne_pas_rappeler` → ne_pas_rappeler (sort définitivement de la file) ;
    `faux_numero` → a_retirer ; `refus` et `demo_rdv` → termine ; le reste → en_cours.
11. **File d'appel** : rappels dus (date ≤ aujourd'hui) → jamais appelés → déjà appelés (dernier appel le plus
    ancien d'abord) → rappels prévus plus tard. « Passer » est mémorisé pour la session seulement.
12. **Compteurs** : « session » = appels du jour (une session = mardi ou jeudi), « semaine » = appels de la
    semaine calendaire, « phase » = appels sur les leads de la phase.
13. **Meilleur créneau / jour** : meilleur taux de démo/RDV sur appels, puis meilleur décrochage, parmi les
    créneaux d'au moins 5 appels (tous si aucun n'atteint 5). Heures et jours calculés en heure de Paris.
14. **Consulting, unité de mesure = l'entreprise** : « mails envoyés » = entreprises dont le premier mail est
    envoyé ; les relances sont comptées à part ; une réponse au premier mail ou à la relance compte une fois.
    Les bounces restent dans les envoyés (ils ont été envoyés) et sont affichés à part.
15. **Réponse « rendez_vous »** sur un mail : crée automatiquement un RDV « à faire » si l'entreprise n'en a pas.
    **Réponse « stop »** : passe l'entreprise en `stop` (plus aucun envoi, réimport bloqué).
16. **Validation bloquante** si objet, corps, mail pro, information vraie ou URL de source (http/https) manquent,
    ou si le mail contient un prix, « VocaStork » ou « ArtiGroup ». La similarité > 80 % est une **alerte**
    (non bloquante) : deux mails personnalisés peuvent partager une signature. Similarité = coefficient de Dice
    sur les paires de mots consécutifs.
17. **Modifier un mail validé** le repasse en brouillon ; un mail envoyé n'est plus modifiable (seules ses
    dates et la note de réponse le sont).
18. **Réseau chaud** : « sollicité » = dernier contact renseigné ; RDV réseau = RDV rattachés à une personne
    du réseau + RDV d'entreprises venues du réseau ou d'une recommandation. « RDV par contact sollicité »
    est affiché comme un **ratio** et non un pourcentage (une recommandation peut amener un RDV sans
    sollicitation directe, ce qui donnerait plus de 100 %).
19. **Direct vs réseau** : direct = entreprises de source `sourcing` ; heures du direct = somme des heures
    saisies sur les cibles.
20. **Échantillon trop petit** : < 60 appels passés par phase (vocal), < 20 mails envoyés par cible (consulting).
21. **Export du bilan** en HTML autonome téléchargé (bouton « Imprimer / enregistrer en PDF » dedans) plutôt
    qu'un PDF généré, pour éviter une dépendance.
22. **Données importées dont le nom commence par « TEST »** sont marquées `est_test` : elles partent aussi avec
    « Vider les données de test ».
23. **Déploiement** : le build sur les serveurs Netlify a échoué sans journal accessible (alors que le même
    build passe en local). Les deux sites ont donc été construits ici (`MESURE_CRM=vocal` / `conso`), testés,
    puis envoyés déjà construits (zip avec `publish = "."`, mêmes en-têtes de sécurité). Le `config.js` ainsi
    publié contient l'URL et la clé publishable Supabase, publiques par nature ; rien de cela n'est dans git.
25. **Deux web apps, un seul code** : à la demande de Damien, chaque CRM a son propre site Netlify
    (`solvex-crm-agent-vocal`, `solvex-crm-consulting`). La variable `MESURE_CRM` choisit le CRM affiché ;
    le menu de bascule est masqué. Les données restent séparées (tables distinctes) comme avant.
26. **Connexion par mot de passe** ajoutée en plus du lien magique : même compte et même mot de passe que
    Solvex OS (même projet Supabase). Évite d'avoir à configurer les URL de redirection Supabase.
24. **Problèmes préexistants** de Solvex OS relevés par l'audit Supabase (table `voca_backup_20260911`
    sans RLS, fonction `handle_new_user`) : signalés dans `docs/tables_apres.md`, **non corrigés** (interdiction
    de toucher aux tables existantes).
