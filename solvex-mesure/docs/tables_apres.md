# Vérification APRÈS création des tables Mesure (2026-10-21)

| Contrôle | Avant | Après |
|---|---|---|
| Tables existantes (hors `mesure_*`) | 92 | 92 |
| Empreinte md5 des colonnes des tables existantes | `3ea061c2660fd3176e0daff560b55d52` | `3ea061c2660fd3176e0daff560b55d52` |
| Policies RLS existantes | 55 | 55 |
| Empreinte md5 des policies existantes | `8c1d5d77bd197d4dcfd5004b471f8bde` | `8c1d5d77bd197d4dcfd5004b471f8bde` |

→ Aucune table existante n'a été modifiée, supprimée, ni ses policies changées.

Tables ajoutées (9) : mesure_conso_cibles, mesure_conso_entreprises, mesure_conso_mails,
mesure_conso_parametres, mesure_conso_rdv, mesure_conso_reseau, mesure_vocal_appels,
mesure_vocal_leads, mesure_vocal_phases. Fonction ajoutée : `public.mesure_is_owner()`.

## RLS des tables Mesure

Pour chacune des 9 tables : RLS activée **et forcée**, aucun droit pour le rôle `anon`
(`has_table_privilege('anon', …)` = false en lecture et en écriture), une seule policy
`for all to authenticated` limitée à l'e-mail `damien.nass1@gmail.com` du jeton.

Test SQL (rôle `authenticated` simulé) : un autre e-mail voit **0** phase ; le propriétaire voit 3 phases et 4 cibles.

L'audit de sécurité Supabase ne signale **aucun** problème sur les tables `mesure_*`.
Points préexistants relevés (non touchés, hors périmètre) : `voca_backup_20260911` sans RLS ;
fonction `handle_new_user` en SECURITY DEFINER exécutable par `anon` ; protection contre les mots de passe divulgués désactivée.
