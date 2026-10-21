// Construit dist/ : copie src/, ajoute supabase-js et écrit config.js à partir des variables d'environnement.
// Aucune clé n'est stockée dans le dépôt : SUPABASE_URL et SUPABASE_ANON_KEY viennent de Netlify.

import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const env = process.env;

const backend = env.MESURE_BACKEND === 'memory' ? 'memory' : 'supabase';
if (backend === 'memory' && env.NETLIFY === 'true') {
  console.error('MESURE_BACKEND=memory est réservé aux tests locaux, jamais sur Netlify.');
  process.exit(1);
}
if (backend === 'supabase' && (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY)) {
  console.error('Variables manquantes : SUPABASE_URL et SUPABASE_ANON_KEY (à définir dans Netlify).');
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
cpSync(join(root, 'src'), dist, { recursive: true });

const umd = join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js');
if (!existsSync(umd)) {
  console.error('supabase-js introuvable : lancer « npm install » avant le build.');
  process.exit(1);
}
mkdirSync(join(dist, 'vendor'), { recursive: true });
cpSync(umd, join(dist, 'vendor/supabase.js'));

const config = {
  backend,
  supabaseUrl: backend === 'supabase' ? env.SUPABASE_URL : '',
  supabaseKey: backend === 'supabase' ? env.SUPABASE_ANON_KEY : '',
  allowedEmail: (env.MESURE_ALLOWED_EMAIL || 'damien.nass1@gmail.com').toLowerCase(),
  // vocal | conso : le site n'affiche que ce CRM ; vide : les deux
  crm: ['vocal', 'conso'].includes(env.MESURE_CRM) ? env.MESURE_CRM : '',
};
writeFileSync(join(dist, 'config.js'), `window.MESURE_CONFIG = ${JSON.stringify(config)};\n`);
console.log(`Build OK (${backend}${config.crm ? `, CRM ${config.crm}` : ''}) → dist/`);
