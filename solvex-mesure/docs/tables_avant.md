# Inventaire de la base Solvex OS AVANT création des tables Mesure (2026-10-21)

Requête : `information_schema.tables` (hors pg_catalog / information_schema).

- Nombre de tables (tous schémas, hors `mesure_*`) : **92**
- Empreinte md5 des colonnes (nom, type, défaut, nullabilité) des tables existantes : `3ea061c2660fd3176e0daff560b55d52`
- Nombre de policies RLS existantes : **55**, empreinte md5 : `8c1d5d77bd197d4dcfd5004b471f8bde`

Tables du schéma `public` : activity_log, agent_chat, agent_inbox, agent_log, agent_runs, agent_settings,
agent_vocal_btp_leads, app_state, archive_20261018_client_journey, archive_20261018_developers,
archive_20261018_handoff_notes, archive_20261018_partners, archive_20261018_task_groups,
archive_20261018_tasks, call_logs, cashflow, client_groups, client_journey, clients, developers,
handoff_notes, invoice_groups, invoices, jarvis_conversations, jarvis_messages, leads, partners,
process_steps, profiles, projects, prospection_campaign_stats, prospection_campaigns,
prospection_touches, prospection_weekly_reports, task_groups, tasks, tasks_archive, test_leads,
voca_backup_20260911, voca_leads.

Aucune de ces tables n'a été lue (contenu), modifiée ou supprimée par ce projet.

Remarque de sécurité relevée par l'audit Supabase (non corrigée, car hors périmètre) :
`public.voca_backup_20260911` n'a **pas** de Row Level Security. À décider par Damien :
`ALTER TABLE public.voca_backup_20260911 ENABLE ROW LEVEL SECURITY;` (bloque tout accès client tant qu'aucune policy n'est ajoutée).
