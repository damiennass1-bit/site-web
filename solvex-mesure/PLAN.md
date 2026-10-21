# PLAN — Solvex Mesure (2 CRM de mesure)

- [x] 1. Inventaire : liste des tables existantes de Solvex OS (avant), dossier `solvex-mesure/` séparé du site vitrine
- [x] 2. Tables Supabase `mesure_vocal_*` et `mesure_conso_*` + RLS (accès réservé à damien.nass1@gmail.com)
- [x] 3. Calendrier de référence en base (3 phases agent vocal, 4 cibles consulting), modifiable dans l'interface
- [x] 4. Authentification Supabase par lien magique (ou code), limitée à une adresse
- [x] 5. CRM agent vocal : import CSV (doublons, modèle), file d'appel, saisie après appel (raccourcis), rendez-vous
- [x] 6. CRM agent vocal : tableau de bord par phase + comparaison finale (cold / artigroup)
- [x] 7. CRM consulting : import CSV, semaine en cours, fiche entreprise, réseau chaud, rendez-vous
- [x] 8. CRM consulting : règles qualité (validation, similarité > 80 %, mots interdits, prix, stop)
- [x] 9. CRM consulting : tableau de bord par cible + réseau chaud + comparaison finale
- [x] 10. Exports CSV partout + « Exporter le bilan » (HTML imprimable)
- [x] 11. Données de test (« TEST ») + bouton « Vider les données de test »
- [x] 12. Tests unitaires des formules (calculs à la main) + tests navigateur headless (Playwright)
- [x] 13. Vérifications finales : aucun secret dans git, RLS active, aucun envoi externe, tables existantes intactes (avant / après)
- [x] 14. Déploiement Netlify (un site par CRM), test des URL en production
- [x] 15. README.md, DECISIONS.md, compte rendu final
