# PLAN — Solvex Mesure (2 CRM de mesure)

- [ ] 1. Inventaire : liste des tables existantes de Solvex OS (avant), dossier `solvex-mesure/` séparé du site vitrine
- [ ] 2. Tables Supabase `mesure_vocal_*` et `mesure_conso_*` + RLS (accès réservé à damien.nass1@gmail.com)
- [ ] 3. Calendrier de référence en base (3 phases agent vocal, 4 cibles consulting), modifiable dans l'interface
- [ ] 4. Authentification Supabase par lien magique (ou code), limitée à une adresse
- [ ] 5. CRM agent vocal : import CSV (doublons, modèle), file d'appel, saisie après appel (raccourcis), rendez-vous
- [ ] 6. CRM agent vocal : tableau de bord par phase + comparaison finale (cold / artigroup)
- [ ] 7. CRM consulting : import CSV, semaine en cours, fiche entreprise, réseau chaud, rendez-vous
- [ ] 8. CRM consulting : règles qualité (validation, similarité > 80 %, mots interdits, prix, stop)
- [ ] 9. CRM consulting : tableau de bord par cible + réseau chaud + comparaison finale
- [ ] 10. Exports CSV partout + « Exporter le bilan » (HTML imprimable)
- [ ] 11. Données de test (« TEST ») + bouton « Vider les données de test »
- [ ] 12. Tests unitaires des formules (calculs à la main) + tests navigateur headless (Playwright)
- [ ] 13. Vérifications finales : aucun secret dans git, RLS active, aucun envoi externe, tables existantes intactes (avant / après)
- [ ] 14. Déploiement Netlify `solvex-mesure`, test de l'URL en production
- [ ] 15. README.md, DECISIONS.md, compte rendu final
