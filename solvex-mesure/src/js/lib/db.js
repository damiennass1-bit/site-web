// Accès aux données. Deux implémentations de la même interface :
//  - supabase : la vraie base (projet Solvex OS, tables mesure_*), protégée par RLS
//  - memory   : base en mémoire, uniquement pour les tests automatisés (jamais en production)
//
// Interface : all(table) · insert(table, rows) · update(table, id, patch) · remove(table, id)
//             removeTest(table) · auth.{session, onChange, sendLink, verifyCode, signOut}

const SEED = {
  mesure_vocal_phases: [
    { numero: 1, nom: 'Phase 1', cible: 'Artisans du dépannage (plombiers, chauffagistes, serruriers, électriciens)', date_debut: '2026-10-26', date_fin: '2026-11-06', creneau_conseille: '12h-14h', objectif_appels: 120 },
    { numero: 2, nom: 'Phase 2', cible: 'Médical (cabinets, kinés, infirmiers, dentistes)', date_debut: '2026-11-09', date_fin: '2026-11-20', creneau_conseille: '10h-12h', objectif_appels: 120 },
    { numero: 3, nom: 'Phase 3', cible: 'Immobilier (agences, syndics)', date_debut: '2026-11-23', date_fin: '2026-12-04', creneau_conseille: '10h-12h', objectif_appels: 120 },
  ],
  mesure_conso_cibles: [
    { semaine: 'S1', nom: 'PME BTP', description: 'PME BTP 10-20 salariés (partenariat Fédé du BTP 68)', date_sourcing: '2026-10-25', date_envoi_1: '2026-10-26', date_envoi_2: '2026-10-28', heures_travail: 0 },
    { semaine: 'S2', nom: 'Experts-comptables', description: 'Experts-comptables', date_sourcing: '2026-11-01', date_envoi_1: '2026-11-02', date_envoi_2: '2026-11-04', heures_travail: 0 },
    { semaine: 'S3', nom: 'Avocats', description: 'Avocats', date_sourcing: '2026-11-08', date_envoi_1: '2026-11-09', date_envoi_2: '2026-11-11', heures_travail: 0 },
    { semaine: 'S4', nom: 'Immobilier', description: 'Agences immobilières', date_sourcing: '2026-11-15', date_envoi_1: '2026-11-16', date_envoi_2: '2026-11-18', heures_travail: 0 },
  ],
  mesure_conso_parametres: [{ cle: 'heures_reseau', valeur: '0' }],
};

// Valeurs par défaut appliquées par la base (reproduites en mémoire)
const DEFAULTS = {
  mesure_vocal_leads: { source: 'cold', statut: 'a_appeler', est_test: false },
  mesure_vocal_appels: { tentative: 1, decideur_joint: false, conversation_plus_1min: false, demo_ou_rdv: false, sms_envoye: false, est_test: false },
  mesure_conso_entreprises: { source: 'sourcing', statut: 'actif', est_test: false },
  mesure_conso_mails: { type: 'premier', statut: 'brouillon', est_test: false },
  mesure_conso_reseau: { recommandations_obtenues: 0, est_test: false },
  mesure_conso_rdv: { type: 'decouverte', statut: 'a_faire', est_test: false },
};

// Suppressions en cascade (clés étrangères « on delete cascade » de la base)
const CASCADE = {
  mesure_vocal_leads: [['mesure_vocal_appels', 'lead_id']],
  mesure_conso_entreprises: [['mesure_conso_mails', 'entreprise_id'], ['mesure_conso_rdv', 'entreprise_id']],
  mesure_conso_reseau: [['mesure_conso_rdv', 'reseau_id']],
};

const PK = { mesure_conso_parametres: 'cle' };
const pk = (table) => PK[table] || 'id';

function memoryBackend() {
  const KEY = 'solvex-mesure-memory';
  let store = null;
  try { store = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { store = null; }
  if (!store) {
    store = {};
    for (const [t, rows] of Object.entries(SEED)) {
      store[t] = rows.map((r) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r }));
    }
  }
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(store)); } catch { /* stockage indisponible */ } };
  const rows = (t) => (store[t] ||= []);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const removeIds = (table, ids) => {
    for (const [child, fk] of CASCADE[table] || []) {
      removeIds(child, new Set(rows(child).filter((r) => ids.has(r[fk])).map((r) => r.id)));
    }
    store[table] = rows(table).filter((r) => !ids.has(r[pk(table)]));
  };
  return {
    kind: 'memory',
    async all(table) { return clone(rows(table)); },
    async insert(table, input) {
      const list = (Array.isArray(input) ? input : [input]).map((r) => ({
        id: crypto.randomUUID(), created_at: new Date().toISOString(), ...(DEFAULTS[table] || {}), ...r,
      }));
      rows(table).push(...list);
      save();
      return clone(list);
    },
    async update(table, id, patch) {
      const r = rows(table).find((x) => x[pk(table)] === id);
      if (!r) throw new Error('Ligne introuvable');
      Object.assign(r, patch);
      save();
      return clone(r);
    },
    async upsert(table, row) {
      const r = rows(table).find((x) => x[pk(table)] === row[pk(table)]);
      if (r) Object.assign(r, row); else rows(table).push({ created_at: new Date().toISOString(), ...row });
      save();
      return clone(row);
    },
    async remove(table, id) { removeIds(table, new Set([id])); save(); },
    async removeTest(table) {
      removeIds(table, new Set(rows(table).filter((r) => r.est_test).map((r) => r.id)));
      save();
    },
    auth: {
      async session() { return { user: { email: window.MESURE_CONFIG.allowedEmail } }; },
      onChange() {},
      async sendLink() {},
      async verifyCode() {},
      async signOut() { location.reload(); },
    },
  };
}

function supabaseBackend(cfg) {
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  const check = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  return {
    kind: 'supabase',
    async all(table) {
      const out = [];
      const size = 1000;
      for (let from = 0; ; from += size) {
        const page = check(await client.from(table).select('*').order(pk(table)).range(from, from + size - 1));
        out.push(...page);
        if (page.length < size) break;
      }
      return out;
    },
    async insert(table, input) {
      const list = Array.isArray(input) ? input : [input];
      const out = [];
      for (let i = 0; i < list.length; i += 500) {
        out.push(...check(await client.from(table).insert(list.slice(i, i + 500)).select()));
      }
      return out;
    },
    async update(table, id, patch) {
      return check(await client.from(table).update(patch).eq(pk(table), id).select().single());
    },
    async upsert(table, row) {
      return check(await client.from(table).upsert(row).select().single());
    },
    async remove(table, id) { check(await client.from(table).delete().eq(pk(table), id)); },
    async removeTest(table) { check(await client.from(table).delete().eq('est_test', true)); },
    auth: {
      async session() { return check(await client.auth.getSession()).session; },
      onChange(fn) { client.auth.onAuthStateChange((_e, session) => fn(session)); },
      async sendLink(email) {
        check(await client.auth.signInWithOtp({
          email, options: { emailRedirectTo: `${location.origin}${location.pathname}`, shouldCreateUser: true },
        }));
      },
      async verifyCode(email, token) { check(await client.auth.verifyOtp({ email, token, type: 'email' })); },
      async signOut() { await client.auth.signOut(); location.reload(); },
    },
  };
}

export function createDb(cfg) {
  if (cfg.backend === 'memory') return memoryBackend();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) throw new Error('Configuration Supabase manquante (variables SUPABASE_URL et SUPABASE_ANON_KEY).');
  return supabaseBackend(cfg);
}
