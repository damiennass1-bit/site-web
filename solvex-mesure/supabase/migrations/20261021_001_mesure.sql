-- Solvex Mesure : deux CRM de mesure (agent vocal / consulting)
-- Crée UNIQUEMENT de nouvelles tables préfixées mesure_vocal_ et mesure_conso_.
-- Ne lit, ne modifie et ne supprime aucune table existante de Solvex OS.

-- Accès réservé à une seule adresse (le propriétaire). Utilisé par toutes les policies RLS.
create or replace function public.mesure_is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'damien.nass1@gmail.com'
$$;

-- ============================================================
-- CRM 1 : agent vocal (cold call)
-- ============================================================

create table public.mesure_vocal_phases (
  id uuid primary key default gen_random_uuid(),
  numero int not null,
  nom text not null,
  cible text not null,
  date_debut date not null,
  date_fin date not null,
  creneau_conseille text,
  objectif_appels int not null default 120,
  created_at timestamptz not null default now()
);

create table public.mesure_vocal_leads (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid references public.mesure_vocal_phases(id) on delete set null,
  entreprise text not null,
  dirigeant_prenom text,
  dirigeant_nom text,
  metier text,
  commune text,
  departement text,
  telephone text,
  telephone_fixe text,
  effectif text,
  site_web text,
  source text not null default 'cold' check (source in ('cold', 'artigroup', 'autre')),
  raison_inclusion text,
  semaine date,
  statut text not null default 'a_appeler'
    check (statut in ('a_appeler', 'en_cours', 'termine', 'a_retirer', 'ne_pas_rappeler')),
  notes text,
  est_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index mesure_vocal_leads_phase_idx on public.mesure_vocal_leads(phase_id);

create table public.mesure_vocal_appels (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.mesure_vocal_leads(id) on delete cascade,
  date_heure timestamptz not null default now(),
  tentative int not null default 1,
  resultat text not null check (resultat in (
    'pas_de_reponse', 'repondeur', 'joint_pas_decideur', 'joint_decideur', 'refus',
    'rappeler', 'demo_rdv', 'faux_numero', 'ne_pas_rappeler')),
  duree_min numeric,
  decideur_joint boolean not null default false,
  conversation_plus_1min boolean not null default false,
  demo_ou_rdv boolean not null default false,
  date_rdv timestamptz,
  rdv_statut text check (rdv_statut in ('a_faire', 'fait', 'devis', 'signe', 'perdu')),
  motif_refus text,
  motif_refus_texte text,
  sms_envoye boolean not null default false,
  rappel_le date,
  note text,
  est_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index mesure_vocal_appels_lead_idx on public.mesure_vocal_appels(lead_id);

-- ============================================================
-- CRM 2 : prospection consulting (mails + réseau chaud)
-- ============================================================

create table public.mesure_conso_cibles (
  id uuid primary key default gen_random_uuid(),
  semaine text not null,
  nom text not null,
  description text,
  date_sourcing date,
  date_envoi_1 date,
  date_envoi_2 date,
  heures_travail numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.mesure_conso_entreprises (
  id uuid primary key default gen_random_uuid(),
  cible_id uuid references public.mesure_conso_cibles(id) on delete set null,
  entreprise text not null,
  dirigeant_prenom text,
  dirigeant_nom text,
  fonction text,
  taille text,
  ville text,
  departement text,
  site_web text,
  mail_pro text,
  telephone text,
  source text not null default 'sourcing' check (source in ('sourcing', 'reseau', 'recommandation')),
  information_vraie text,
  url_source_information text,
  statut text not null default 'actif' check (statut in ('actif', 'stop')),
  est_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index mesure_conso_entreprises_cible_idx on public.mesure_conso_entreprises(cible_id);

create table public.mesure_conso_mails (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.mesure_conso_entreprises(id) on delete cascade,
  type text not null default 'premier' check (type in ('premier', 'relance')),
  objet text,
  corps text,
  statut text not null default 'brouillon' check (statut in (
    'brouillon', 'valide', 'envoye', 'repondu_positif', 'repondu_neutre', 'refus',
    'rendez_vous', 'stop', 'bounce')),
  valide_le timestamptz,
  envoye_le timestamptz,
  reponse_le timestamptz,
  note_reponse text,
  est_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index mesure_conso_mails_entreprise_idx on public.mesure_conso_mails(entreprise_id);

create table public.mesure_conso_reseau (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  organisation text,
  lien_avec_solvex text check (lien_avec_solvex in (
    'ancien_client', 'client_en_cours', 'partenaire', 'apporteur', 'connaissance', 'fede', 'comptable')),
  ce_quil_peut_apporter text,
  dernier_contact date,
  prochaine_action text,
  prochaine_action_le date,
  recommandations_obtenues int not null default 0,
  note text,
  est_test boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.mesure_conso_rdv (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid references public.mesure_conso_entreprises(id) on delete cascade,
  reseau_id uuid references public.mesure_conso_reseau(id) on delete cascade,
  date timestamptz,
  type text not null default 'decouverte' check (type in ('decouverte', 'proposition', 'suivi')),
  resultat text,
  prochaine_etape text,
  montant_potentiel_eur numeric,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'fait', 'devis', 'signe', 'perdu')),
  note text,
  est_test boolean not null default false,
  created_at timestamptz not null default now(),
  constraint mesure_conso_rdv_un_seul_lien check (num_nonnulls(entreprise_id, reseau_id) = 1)
);

-- Heures de travail du réseau chaud et autres réglages simples
create table public.mesure_conso_parametres (
  cle text primary key,
  valeur text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Sécurité : RLS sur toutes les tables, accès propriétaire uniquement
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'mesure_vocal_phases', 'mesure_vocal_leads', 'mesure_vocal_appels',
    'mesure_conso_cibles', 'mesure_conso_entreprises', 'mesure_conso_mails',
    'mesure_conso_reseau', 'mesure_conso_rdv', 'mesure_conso_parametres']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.mesure_is_owner())) with check ((select public.mesure_is_owner()))',
      t || '_proprietaire', t);
  end loop;
end $$;

-- ============================================================
-- Calendrier de référence (modifiable ensuite dans l'interface)
-- ============================================================

insert into public.mesure_vocal_phases (numero, nom, cible, date_debut, date_fin, creneau_conseille, objectif_appels) values
  (1, 'Phase 1', 'Artisans du dépannage (plombiers, chauffagistes, serruriers, électriciens)', '2026-10-26', '2026-11-06', '12h-14h', 120),
  (2, 'Phase 2', 'Médical (cabinets, kinés, infirmiers, dentistes)', '2026-11-09', '2026-11-20', '10h-12h', 120),
  (3, 'Phase 3', 'Immobilier (agences, syndics)', '2026-11-23', '2026-12-04', '10h-12h', 120);

insert into public.mesure_conso_cibles (semaine, nom, description, date_sourcing, date_envoi_1, date_envoi_2) values
  ('S1', 'PME BTP', 'PME BTP 10-20 salariés (partenariat Fédé du BTP 68)', '2026-10-25', '2026-10-26', '2026-10-28'),
  ('S2', 'Experts-comptables', 'Experts-comptables', '2026-11-01', '2026-11-02', '2026-11-04'),
  ('S3', 'Avocats', 'Avocats', '2026-11-08', '2026-11-09', '2026-11-11'),
  ('S4', 'Immobilier', 'Agences immobilières', '2026-11-15', '2026-11-16', '2026-11-18');

insert into public.mesure_conso_parametres (cle, valeur) values ('heures_reseau', '0');
