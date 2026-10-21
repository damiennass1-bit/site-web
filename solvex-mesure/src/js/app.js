// Point d'entrée : authentification, chargement des données, routage par « #/crm/ecran »

import { createDb } from './lib/db.js';
import { toast } from './ui.js';
import * as vocal from './vocal/views.js';
import * as conso from './conso/views.js';

const cfg = window.MESURE_CONFIG || {};
const app = document.getElementById('app');

const CRMS = {
  vocal: {
    titre: 'CRM Mesure agents vocaux',
    ecrans: [
      ['file', "File d'appel"], ['leads', 'Leads'], ['import', 'Import'], ['rdv', 'Rendez-vous'],
      ['dashboard', 'Tableau de bord'], ['comparaison', 'Comparaison finale'], ['phases', 'Phases & réglages'],
    ],
    views: vocal,
    tables: ['mesure_vocal_phases', 'mesure_vocal_leads', 'mesure_vocal_appels'],
  },
  conso: {
    titre: 'CRM Mesure prospection consulting',
    ecrans: [
      ['semaine', 'Semaine en cours'], ['import', 'Import'], ['reseau', 'Réseau chaud'], ['rdv', 'Rendez-vous'],
      ['dashboard', 'Tableau de bord'], ['comparaison', 'Comparaison finale'], ['cibles', 'Cibles & réglages'],
    ],
    views: conso,
    extra: ['entreprise'],
    tables: ['mesure_conso_cibles', 'mesure_conso_entreprises', 'mesure_conso_mails', 'mesure_conso_reseau', 'mesure_conso_rdv', 'mesure_conso_parametres'],
  },
};

let db;
const data = { vocal: null, conso: null };
let started = false;
let dernierEcran = '';

async function load(crm) {
  const t = CRMS[crm].tables;
  const rows = await Promise.all(t.map((name) => db.all(name)));
  const short = (name) => name.replace(/^mesure_(vocal|conso)_/, '');
  data[crm] = Object.fromEntries(t.map((name, i) => [short(name), rows[i]]));
  return data[crm];
}

function parseHash() {
  const [crm, ecran, ...params] = location.hash.replace(/^#\/?/, '').split('/');
  return { crm, ecran, params };
}

async function route() {
  let { crm, ecran, params } = parseHash();
  if (!CRMS[crm]) { location.replace('#/vocal/file'); return; }
  const def = CRMS[crm];
  const ids = [...def.ecrans.map(([id]) => id), ...(def.extra || [])];
  if (!ids.includes(ecran)) { ecran = def.ecrans[0][0]; history.replaceState(null, '', `#/${crm}/${ecran}`); }

  document.querySelectorAll('.crm-switch a').forEach((a) => a.classList.toggle('active', a.dataset.crm === crm));
  const sub = document.getElementById('subnav');
  sub.innerHTML = def.ecrans.map(([id, label]) => `<a href="#/${crm}/${id}" class="${id === ecran || (ecran === 'entreprise' && id === 'semaine') ? 'active' : ''}">${label}</a>`).join('');
  document.title = `${def.ecrans.find(([id]) => id === ecran)?.[1] || 'Fiche'} · ${def.titre}`;

  const cle = `${crm}/${ecran}/${params.join('/')}`;
  if (cle !== dernierEcran) { window.scrollTo(0, 0); dernierEcran = cle; }

  document.onkeydown = null; // chaque écran installe ses propres raccourcis
  app.onclick = null;
  app.onchange = null;
  app.oninput = null;
  app.onsubmit = null;

  if (!data[crm]) {
    app.innerHTML = '<p class="chargement">Chargement des données…</p>';
    try { await load(crm); } catch (e) {
      app.innerHTML = `<div class="alerte rouge">Impossible de charger les données : ${e.message}</div>`;
      return;
    }
  }
  const ctx = {
    db, cfg, crm, params, data: data[crm], titre: def.titre,
    // recharge les données du CRM puis réaffiche l'écran courant
    async refresh() { await load(crm); ctx.data = data[crm]; await route(); },
    rerender() { route(); },
  };
  try {
    await def.views[ecran](app, ctx);
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="alerte rouge">Erreur d'affichage : ${e.message}</div>`;
  }
}

function showLogin(message = '') {
  document.getElementById('topbar').hidden = true;
  app.hidden = true;
  const login = document.getElementById('login');
  login.hidden = false;
  document.getElementById('login-email').value = cfg.allowedEmail || '';
  document.getElementById('login-err').textContent = message;
}

function allowed(session) {
  return session?.user?.email && session.user.email.toLowerCase() === String(cfg.allowedEmail || '').toLowerCase();
}

function start() {
  if (started) return;
  started = true;
  document.getElementById('login').hidden = true;
  document.getElementById('topbar').hidden = false;
  app.hidden = false;
  window.addEventListener('hashchange', route);
  route();
}

async function boot() {
  try {
    db = createDb(cfg);
  } catch (e) {
    app.innerHTML = `<div class="alerte rouge">${e.message}</div>`;
    return;
  }

  document.getElementById('logout').addEventListener('click', () => db.auth.signOut());

  const loginForm = document.getElementById('login-form');
  const codeForm = document.getElementById('code-form');
  const err = document.getElementById('login-err');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.email.value.trim().toLowerCase();
    err.textContent = '';
    if (email !== String(cfg.allowedEmail).toLowerCase()) {
      err.textContent = 'Cette adresse n’a pas accès à Solvex Mesure.';
      return;
    }
    try {
      await db.auth.sendLink(email);
      codeForm.hidden = false;
    } catch (ex) { err.textContent = `Envoi impossible : ${ex.message}`; }
  });
  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await db.auth.verifyCode(loginForm.email.value.trim().toLowerCase(), codeForm.code.value.trim());
    } catch (ex) { err.textContent = `Code refusé : ${ex.message}`; }
  });

  db.auth.onChange((session) => {
    if (allowed(session)) start();
  });

  let session = null;
  try { session = await db.auth.session(); } catch (e) { toast(e.message, 'erreur'); }
  if (allowed(session)) start();
  else if (session) {
    showLogin('Ce compte n’a pas accès à Solvex Mesure.');
    db.auth.signOut();
  } else showLogin();
}

boot();
