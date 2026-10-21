// Écrans du CRM Mesure agents vocaux (cold call)

import { esc, pct, num } from '../lib/format.js';
import {
  todayISO, mondayOf, addDays, frDate, frDateTime, currentPeriod, JOURS, toLocalInput, fromLocalInput, parisDate,
} from '../lib/dates.js';
import { parseCSV, mapColumns, toCSV, download } from '../lib/csv.js';
import { classify, vocalKeys } from '../lib/dedupe.js';
import {
  RESULTATS, MOTIFS_REFUS, statsAppels, parHeure, parJour, meilleur, motifsRefus, appelsDePhase, appelsDeSource,
  fileAppel, statutApresAppel, estDemo, SEUIL_ECHANTILLON_VOCAL,
} from '../lib/stats-vocal.js';
import {
  toast, act, options, tabs, rate, kpis, warn, bars, exportCSV, empty, badge, table, formData, bilanHTML,
} from '../ui.js';
import { chargerTestVocal } from './testdata.js';

const T = { phases: 'mesure_vocal_phases', leads: 'mesure_vocal_leads', appels: 'mesure_vocal_appels' };

export const SOURCES = [
  { code: 'cold', label: 'Cold (sourcing Claude)' },
  { code: 'artigroup', label: 'ArtiGroup' },
  { code: 'autre', label: 'Autre' },
];
export const STATUTS_LEAD = [
  { code: 'a_appeler', label: 'À appeler' },
  { code: 'en_cours', label: 'En cours' },
  { code: 'termine', label: 'Terminé' },
  { code: 'a_retirer', label: 'À retirer' },
  { code: 'ne_pas_rappeler', label: 'Ne pas rappeler' },
];
export const STATUTS_RDV = [
  { code: 'a_faire', label: 'À faire' },
  { code: 'fait', label: 'Fait' },
  { code: 'devis', label: 'Devis' },
  { code: 'signe', label: 'Signé' },
  { code: 'perdu', label: 'Perdu' },
];

const OBJECTIF_SESSION = 30;
const OBJECTIF_SEMAINE = 60;

const label = (list, code) => list.find((x) => x.code === code)?.label || code || '';
const resultatLabel = (c) => label(RESULTATS, c);
const nomDirigeant = (l) => [l.dirigeant_prenom, l.dirigeant_nom].filter(Boolean).join(' ');
const phasesTriees = (d) => [...d.phases].sort((a, b) => a.numero - b.numero);
const phaseCourante = (d) => currentPeriod(d.phases, 'date_debut', 'date_fin');

// Lundis couverts par une phase
function semainesDePhase(phase) {
  if (!phase) return [];
  const out = [];
  for (let m = mondayOf(phase.date_debut); m <= phase.date_fin; m = addDays(m, 7)) out.push(m);
  return out;
}

// État d'écran conservé entre deux affichages
const etat = {
  phaseId: null, semaine: null, leadId: null, passes: new Set(),
  saisie: null, dashPhase: null, dashSource: '', leadsFiltre: '', leadsPhase: '',
};

function nouvelleSaisie() {
  return {
    resultat: null, decideur_joint: false, conversation_plus_1min: false, demo_ou_rdv: false, sms_envoye: false,
    motif_refus: '', motif_refus_texte: '', rappel_le: '', date_rdv: '', duree_min: '', note: '', date_heure: '',
  };
}

// ============================================================
// File d'appel + saisie après appel
// ============================================================
export async function file(root, ctx) {
  const d = ctx.data;
  const phases = phasesTriees(d);
  if (!etat.phaseId || !phases.some((p) => p.id === etat.phaseId)) etat.phaseId = phaseCourante(d)?.id || null;
  const phase = phases.find((p) => p.id === etat.phaseId);
  const semaines = semainesDePhase(phase);
  const lundi = mondayOf(todayISO());
  if (etat.semaine === null) etat.semaine = semaines.includes(lundi) ? lundi : (semaines[0] || '');
  if (!etat.saisie) etat.saisie = nouvelleSaisie();

  const today = todayISO();
  const leadsFiltres = d.leads.filter((l) => l.phase_id === etat.phaseId && (!etat.semaine || l.semaine === etat.semaine));
  const queue = fileAppel(leadsFiltres, d.appels, today);
  const visibles = queue.filter((i) => !etat.passes.has(i.lead.id));
  let courant = queue.find((i) => i.lead.id === etat.leadId) || visibles[0] || queue[0] || null;
  etat.leadId = courant?.lead.id || null;

  const appelsDuJour = d.appels.filter((a) => parisDate(a.date_heure) === today).length;
  const appelsSemaine = d.appels.filter((a) => mondayOf(parisDate(a.date_heure)) === lundi).length;
  const idsPhase = new Set(d.leads.filter((l) => l.phase_id === etat.phaseId).map((l) => l.id));
  const appelsPhase = d.appels.filter((a) => idsPhase.has(a.lead_id)).length;
  const compteur = (txt, n, obj) => `<span class="compteur${n >= obj ? ' atteint' : ''}">${txt} : ${n} / ${obj}</span>`;

  const s = etat.saisie;
  const l = courant?.lead;
  const tel = l?.telephone || l?.telephone_fixe;
  const montreMotif = s.resultat === 'refus' || s.resultat === 'ne_pas_rappeler';

  root.innerHTML = `
    <h1>File d'appel</h1>
    <div class="card">
      <div class="row">
        <label class="grow">Phase <select id="f-phase">${options(phases.map((p) => ({ code: p.id, label: `${p.nom} — ${p.cible}` })), etat.phaseId)}</select></label>
        <label>Semaine <select id="f-semaine">${options([{ code: '', label: 'Toutes les semaines' }, ...semaines.map((m) => ({ code: m, label: `Semaine du ${frDate(m)}` }))], etat.semaine)}</select></label>
      </div>
      <div class="row" style="margin-top:10px">
        <div class="compteurs">
          ${compteur('Session (aujourd’hui)', appelsDuJour, OBJECTIF_SESSION)}
          ${compteur('Semaine', appelsSemaine, OBJECTIF_SEMAINE)}
          ${compteur('Phase', appelsPhase, phase?.objectif_appels || 120)}
        </div>
        <span class="muted right">${phase ? `Créneau conseillé : <strong>${esc(phase.creneau_conseille || '—')}</strong> · ${frDate(phase.date_debut)} → ${frDate(phase.date_fin)}` : ''}</span>
      </div>
    </div>

    ${!courant ? `<div class="card">${empty(leadsFiltres.length
      ? 'Tous les leads de cette sélection ont été traités. Bravo !'
      : 'Aucun lead dans cette sélection. Importe la liste de la semaine depuis l’onglet « Import ».')}</div>` : `
    <div class="call-layout">
      <section class="card" aria-label="Fiche du lead">
        <div class="row"><p class="lead-titre">${esc(l.entreprise)}</p>
          ${courant.rang === 0 ? badge(`Rappel dû (${frDate(courant.rappel)})`, 'orange') : ''}
          ${courant.rang === 3 ? badge(`Rappel prévu le ${frDate(courant.rappel)}`, 'bleu') : ''}
          ${badge(label(SOURCES, l.source))}
        </div>
        <p class="lead-meta">${esc([nomDirigeant(l), l.metier, [l.commune, l.departement].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}
          ${l.effectif ? ` · ${esc(l.effectif)} sal.` : ''}${l.site_web ? ` · <a href="${esc(/^https?:/i.test(l.site_web) ? l.site_web : `https://${l.site_web}`)}" target="_blank" rel="noopener noreferrer">site</a>` : ''}</p>
        ${l.raison_inclusion ? `<div class="raison"><strong>Pourquoi lui :</strong> ${esc(l.raison_inclusion)}</div>` : ''}
        ${l.notes ? `<p><strong>Notes :</strong> ${esc(l.notes)}</p>` : ''}
        ${tel ? `<a class="btn-call" href="tel:${esc(tel.replace(/[^\d+]/g, ''))}" id="btn-appeler">📞 Appeler ${esc(tel)}</a>` : warn('Aucun numéro de téléphone.')}
        ${l.telephone && l.telephone_fixe ? `<p style="margin:8px 0 0"><a class="btn-call secondaire" href="tel:${esc(l.telephone_fixe.replace(/[^\d+]/g, ''))}">Fixe : ${esc(l.telephone_fixe)}</a></p>` : ''}
        ${courant.appels.length ? `<p class="muted" style="margin:12px 0 0">Historique (${courant.appels.length} tentative${courant.appels.length > 1 ? 's' : ''}) :</p>
          <ul class="historique">${courant.appels.map((a) => `<li>${frDateTime(a.date_heure)} — ${esc(resultatLabel(a.resultat))}${a.note ? ` : ${esc(a.note)}` : ''}</li>`).join('')}</ul>` : '<p class="muted">Jamais appelé.</p>'}
        <div class="row" style="margin-top:10px">
          <button type="button" class="btn small" data-act="passer">Passer ce lead <kbd>N</kbd></button>
          <button type="button" class="btn small" data-act="retirer">Marquer « à retirer »</button>
        </div>
      </section>

      <form class="card" id="saisie" aria-label="Saisie après appel">
        <h2 style="margin-top:0">Résultat de l'appel</h2>
        <div class="resultats" role="radiogroup" aria-label="Résultat">
          ${RESULTATS.map((r) => `<button type="button" role="radio" aria-checked="${s.resultat === r.code}" class="${s.resultat === r.code ? 'on' : ''}" data-resultat="${r.code}">${esc(r.label)} <kbd>${r.touche}</kbd></button>`).join('')}
        </div>
        <div class="flags">
          <label class="check"><input type="checkbox" name="decideur_joint" ${s.decideur_joint ? 'checked' : ''}> Décideur joint <kbd>D</kbd></label>
          <label class="check"><input type="checkbox" name="conversation_plus_1min" ${s.conversation_plus_1min ? 'checked' : ''}> Conversation &gt; 1 min <kbd>C</kbd></label>
          <label class="check"><input type="checkbox" name="demo_ou_rdv" ${s.demo_ou_rdv ? 'checked' : ''}> Démo / RDV <kbd>R</kbd></label>
          <label class="check"><input type="checkbox" name="sms_envoye" ${s.sms_envoye ? 'checked' : ''}> SMS envoyé (par moi) <kbd>S</kbd></label>
        </div>
        <div class="grid-2">
          <label ${montreMotif ? '' : 'hidden'}>Motif du refus <select name="motif_refus">${options(MOTIFS_REFUS, s.motif_refus, { empty: '—' })}</select></label>
          <label ${montreMotif ? '' : 'hidden'}>Précision <input name="motif_refus_texte" value="${esc(s.motif_refus_texte)}"></label>
          <label ${s.resultat === 'rappeler' ? '' : 'hidden'}>Rappeler le <input type="date" name="rappel_le" value="${esc(s.rappel_le)}"></label>
          <label ${s.demo_ou_rdv || s.resultat === 'demo_rdv' ? '' : 'hidden'}>Date de la démo / du RDV <input type="datetime-local" name="date_rdv" value="${esc(s.date_rdv)}"></label>
        </div>
        <label style="margin-top:10px">Note <textarea name="note" rows="2" placeholder="Ctrl + Entrée pour enregistrer">${esc(s.note)}</textarea></label>
        <details style="margin-top:10px"><summary>Durée, date et heure</summary>
          <div class="grid-2" style="margin-top:8px">
            <label>Durée (min, optionnel) <input type="number" min="0" step="0.5" name="duree_min" value="${esc(s.duree_min)}"></label>
            <label>Date et heure de l'appel (vide = maintenant) <input type="datetime-local" name="date_heure" value="${esc(s.date_heure)}"></label>
          </div>
        </details>
        <div class="sticky-save"><button type="submit" class="btn primary" id="enregistrer">Enregistrer et suivant <kbd>Entrée</kbd></button></div>
      </form>
    </div>`}

    <h2>File (${visibles.length} à traiter${etat.passes.size ? `, ${etat.passes.size} passé${etat.passes.size > 1 ? 's' : ''}` : ''})</h2>
    <div class="row" style="margin-bottom:8px">
      ${etat.passes.size ? '<button type="button" class="btn small" data-act="reprendre">Remettre les leads passés dans la file</button>' : ''}
      <button type="button" class="btn small" data-act="export">Exporter en CSV</button>
    </div>
    ${table(queue, [
      { label: 'Entreprise', html: (i) => `<strong>${esc(i.lead.entreprise)}</strong>${etat.passes.has(i.lead.id) ? ' ' + badge('passé') : ''}` },
      { label: 'Dirigeant', html: (i) => esc(nomDirigeant(i.lead)) },
      { label: 'Commune', html: (i) => esc(i.lead.commune) },
      { label: 'État', html: (i) => (i.rang === 0 ? badge('Rappel dû', 'orange') : i.rang === 1 ? badge('Jamais appelé', 'bleu') : i.rang === 3 ? badge(`Rappel ${frDate(i.rappel)}`) : badge(resultatLabel(i.dernier?.resultat))) },
      { label: 'Tentatives', html: (i) => String(i.appels.length) },
    ], { cls: 'cards', rowAttr: (i) => `class="clickable${i.lead.id === etat.leadId ? ' selected' : ''}" data-lead="${i.lead.id}"` })}
  `;

  const form = root.querySelector('#saisie');
  const syncSaisie = () => { if (form) Object.assign(etat.saisie, formData(form)); };

  const choisirResultat = (code) => {
    syncSaisie();
    s.resultat = code;
    if (code === 'joint_decideur') s.decideur_joint = true;
    if (code === 'demo_rdv') { s.demo_ou_rdv = true; s.decideur_joint = true; s.conversation_plus_1min = true; }
    if (code === 'rappeler' && !s.rappel_le) s.rappel_le = addDays(today, 2);
    file(root, ctx);
  };
  const toggle = (name) => {
    syncSaisie();
    s[name] = !s[name];
    file(root, ctx);
  };
  const suivant = () => {
    etat.saisie = nouvelleSaisie();
    const next = fileAppel(ctx.data.leads.filter((x) => x.phase_id === etat.phaseId && (!etat.semaine || x.semaine === etat.semaine)), ctx.data.appels, todayISO())
      .find((i) => !etat.passes.has(i.lead.id) && i.lead.id !== l?.id);
    etat.leadId = next?.lead.id || null;
    file(root, ctx);
  };

  const enregistrer = async () => {
    syncSaisie();
    if (!s.resultat) { toast('Choisis d’abord le résultat de l’appel (touches 1 à 9).', 'erreur'); return; }
    const joint = !['pas_de_reponse', 'repondeur', 'faux_numero'].includes(s.resultat);
    const demo = joint && (s.demo_ou_rdv || s.resultat === 'demo_rdv');
    const row = {
      lead_id: l.id,
      date_heure: fromLocalInput(s.date_heure) || new Date().toISOString(),
      tentative: courant.appels.length + 1,
      resultat: s.resultat,
      duree_min: s.duree_min ? Number(String(s.duree_min).replace(',', '.')) : null,
      decideur_joint: joint && (s.decideur_joint || s.resultat === 'joint_decideur'),
      conversation_plus_1min: joint && !!s.conversation_plus_1min,
      demo_ou_rdv: demo,
      date_rdv: demo && s.date_rdv ? fromLocalInput(s.date_rdv) : null,
      rdv_statut: demo ? 'a_faire' : null,
      motif_refus: s.motif_refus || null,
      motif_refus_texte: s.motif_refus_texte || null,
      sms_envoye: !!s.sms_envoye,
      rappel_le: s.resultat === 'rappeler' ? s.rappel_le || null : null,
      note: s.note || null,
      est_test: !!l.est_test,
    };
    const btn = root.querySelector('#enregistrer');
    if (btn) btn.disabled = true;
    const ok = await act(async () => {
      const [saved] = await ctx.db.insert(T.appels, row);
      ctx.data.appels.push(saved);
      const statut = statutApresAppel(s.resultat);
      if (statut !== l.statut) {
        const upd = await ctx.db.update(T.leads, l.id, { statut });
        Object.assign(l, upd);
      }
      return true;
    }, `Appel enregistré : ${resultatLabel(s.resultat)}`);
    if (ok) suivant(); else if (btn) btn.disabled = false;
  };

  root.onchange = (e) => {
    if (e.target.id === 'f-phase') {
      etat.phaseId = e.target.value;
      const sem = semainesDePhase(phases.find((p) => p.id === etat.phaseId));
      etat.semaine = sem.includes(lundi) ? lundi : (sem[0] || '');
      etat.leadId = null; etat.passes.clear(); etat.saisie = nouvelleSaisie();
      file(root, ctx);
    } else if (e.target.id === 'f-semaine') {
      etat.semaine = e.target.value; etat.leadId = null; etat.passes.clear(); etat.saisie = nouvelleSaisie();
      file(root, ctx);
    } else if (form && form.contains(e.target)) {
      syncSaisie();
      if (e.target.type === 'checkbox') file(root, ctx); // affiche / masque les champs liés
    }
  };
  root.onclick = async (e) => {
    const r = e.target.closest('[data-resultat]');
    if (r) { choisirResultat(r.dataset.resultat); return; }
    const row = e.target.closest('[data-lead]');
    if (row) { etat.leadId = row.dataset.lead; etat.saisie = nouvelleSaisie(); file(root, ctx); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'passer') { etat.passes.add(l.id); suivant(); }
    if (a === 'reprendre') { etat.passes.clear(); file(root, ctx); }
    if (a === 'retirer' && confirm(`Retirer « ${l.entreprise} » de la file ?`)) {
      await act(async () => { Object.assign(l, await ctx.db.update(T.leads, l.id, { statut: 'a_retirer' })); }, 'Lead retiré de la file');
      suivant();
    }
    if (a === 'export') exportCSV('file-appel', queue.map((i) => ({ ...i.lead, tentatives: i.appels.length, dernier_resultat: i.dernier?.resultat || '' })), COLONNES_LEAD_EXPORT.concat(['tentatives', 'dernier_resultat']));
  };
  root.onsubmit = (e) => { e.preventDefault(); if (e.target.id === 'saisie') enregistrer(); };

  document.onkeydown = (e) => {
    if (!courant || e.altKey || e.metaKey) return;
    const tag = e.target.tagName;
    const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
    if (e.key === 'Enter') {
      if ((tag === 'TEXTAREA' && !e.ctrlKey) || ['SELECT', 'BUTTON', 'A'].includes(tag)) return;
      e.preventDefault(); enregistrer(); return;
    }
    if (inField || e.ctrlKey) return;
    const res = RESULTATS.find((x) => x.touche === e.key);
    if (res) { e.preventDefault(); choisirResultat(res.code); return; }
    const map = { d: 'decideur_joint', c: 'conversation_plus_1min', r: 'demo_ou_rdv', s: 'sms_envoye' };
    const k = e.key.toLowerCase();
    if (map[k]) { e.preventDefault(); toggle(map[k]); }
    if (k === 'n') { e.preventDefault(); etat.passes.add(l.id); suivant(); }
  };
}

// ============================================================
// Leads (tableau complet, statuts, export)
// ============================================================
const COLONNES_LEAD = [
  'entreprise', 'dirigeant_prenom', 'dirigeant_nom', 'metier', 'commune', 'departement', 'telephone', 'telephone_fixe',
  'effectif', 'site_web', 'source', 'raison_inclusion', 'notes',
];
const COLONNES_LEAD_EXPORT = ['entreprise', 'dirigeant_prenom', 'dirigeant_nom', 'metier', 'commune', 'departement',
  'telephone', 'telephone_fixe', 'effectif', 'site_web', 'source', 'raison_inclusion', 'semaine', 'statut', 'notes', 'created_at'];

export async function leads(root, ctx) {
  const d = ctx.data;
  const phases = phasesTriees(d);
  const nbAppels = new Map();
  for (const a of d.appels) nbAppels.set(a.lead_id, (nbAppels.get(a.lead_id) || 0) + 1);
  const rows = d.leads
    .filter((l) => (!etat.leadsPhase || l.phase_id === etat.leadsPhase) && (!etat.leadsFiltre || l.statut === etat.leadsFiltre))
    .sort((a, b) => String(a.semaine || '').localeCompare(String(b.semaine || '')) || a.entreprise.localeCompare(b.entreprise));
  const phaseNom = (id) => phases.find((p) => p.id === id)?.nom || '—';

  root.innerHTML = `
    <h1>Leads</h1>
    <div class="card row">
      <label>Phase <select id="l-phase">${options([{ code: '', label: 'Toutes' }, ...phases.map((p) => ({ code: p.id, label: p.nom }))], etat.leadsPhase)}</select></label>
      <label>Statut <select id="l-statut">${options([{ code: '', label: 'Tous' }, ...STATUTS_LEAD], etat.leadsFiltre)}</select></label>
      <span class="muted">${rows.length} lead${rows.length > 1 ? 's' : ''}</span>
      <button type="button" class="btn right" data-act="export">Exporter en CSV</button>
    </div>
    ${table(rows, [
      { label: 'Entreprise', html: (l) => `<strong>${esc(l.entreprise)}</strong><div class="muted">${esc(l.metier || '')}</div>` },
      { label: 'Dirigeant', html: (l) => esc(nomDirigeant(l)) },
      { label: 'Commune', html: (l) => esc(l.commune) },
      { label: 'Téléphone', html: (l) => esc(l.telephone || l.telephone_fixe || '') },
      { label: 'Source', html: (l) => esc(label(SOURCES, l.source)) },
      { label: 'Phase / semaine', html: (l) => `${esc(phaseNom(l.phase_id))}<div class="muted">${l.semaine ? frDate(l.semaine) : ''}</div>` },
      { label: 'Appels', html: (l) => String(nbAppels.get(l.id) || 0) },
      { label: 'Statut', html: (l) => `<select data-statut="${l.id}" aria-label="Statut">${options(STATUTS_LEAD, l.statut)}</select>` },
      { label: '', html: (l) => `<button type="button" class="btn small danger" data-suppr="${l.id}">Supprimer</button>` },
    ], { cls: 'cards' })}
  `;
  root.onchange = async (e) => {
    if (e.target.id === 'l-phase') { etat.leadsPhase = e.target.value; leads(root, ctx); }
    if (e.target.id === 'l-statut') { etat.leadsFiltre = e.target.value; leads(root, ctx); }
    const id = e.target.dataset.statut;
    if (id) {
      const lead = d.leads.find((x) => x.id === id);
      await act(async () => Object.assign(lead, await ctx.db.update(T.leads, id, { statut: e.target.value })), 'Statut mis à jour');
    }
  };
  root.onclick = async (e) => {
    if (e.target.closest('[data-act="export"]')) exportCSV('leads-agent-vocal', rows, COLONNES_LEAD_EXPORT);
    const id = e.target.dataset.suppr;
    if (id && confirm('Supprimer ce lead et tout son historique d’appels ?')) {
      await act(() => ctx.db.remove(T.leads, id), 'Lead supprimé');
      ctx.refresh();
    }
  };
}

// ============================================================
// Import CSV
// ============================================================
const ALIASES_LEAD = {
  entreprise: ['societe', 'raison_sociale', 'nom_entreprise', 'company', 'nom_de_l_entreprise'],
  dirigeant_prenom: ['prenom', 'prenom_dirigeant', 'first_name', 'firstname'],
  dirigeant_nom: ['nom', 'nom_dirigeant', 'last_name', 'lastname'],
  dirigeant: ['gerant', 'contact', 'nom_complet', 'dirigeant_prenom_nom'],
  metier: ['activite', 'profession', 'corps_de_metier', 'secteur', 'specialite'],
  commune: ['ville', 'city', 'localite'],
  departement: ['dept', 'dep', 'code_departement', 'departement_code'],
  telephone: ['mobile', 'portable', 'tel_mobile', 'telephone_mobile', 'tel', 'phone', 'telephone_portable', 'numero'],
  telephone_fixe: ['fixe', 'tel_fixe', 'telephone_fixe', 'standard'],
  effectif: ['salaries', 'nb_salaries', 'taille', 'effectifs'],
  site_web: ['site', 'url', 'website', 'site_internet'],
  source: ['origine'],
  raison_inclusion: ['raison', 'pourquoi', 'motif_inclusion', 'raison_d_inclusion'],
  notes: ['note', 'commentaire', 'commentaires', 'remarque'],
};
const etatImport = { texte: '', apercu: null, phaseId: null, semaine: null, source: 'cold' };

function ligneVersLead(row, mapping) {
  const get = (f) => (mapping[f] ? String(row[mapping[f]] ?? '').trim() : '');
  const lead = Object.fromEntries(COLONNES_LEAD.map((f) => [f, get(f) || null]));
  if (!lead.dirigeant_prenom && !lead.dirigeant_nom && get('dirigeant')) {
    const [p, ...n] = get('dirigeant').split(/\s+/);
    lead.dirigeant_prenom = p || null;
    lead.dirigeant_nom = n.join(' ') || null;
  }
  const src = String(lead.source || '').toLowerCase();
  lead.source = src.includes('arti') ? 'artigroup' : src.includes('cold') || src.includes('claude') ? 'cold' : src ? 'autre' : null;
  return lead;
}

export async function import_(root, ctx) {
  const d = ctx.data;
  const phases = phasesTriees(d);
  if (!etatImport.phaseId || !phases.some((p) => p.id === etatImport.phaseId)) etatImport.phaseId = phaseCourante(d)?.id || null;
  const phase = phases.find((p) => p.id === etatImport.phaseId);
  const semaines = semainesDePhase(phase);
  if (!etatImport.semaine || !semaines.includes(etatImport.semaine)) {
    const prochain = mondayOf(addDays(todayISO(), 1));
    etatImport.semaine = semaines.find((m) => m >= prochain) || semaines[0] || mondayOf(todayISO());
  }
  const ap = etatImport.apercu;
  const nb = (e) => (ap ? ap.lignes.filter((x) => x.etat === e).length : 0);
  const ETATS = { nouveau: ['Nouveau', 'vert'], doublon: ['Doublon (déjà en base)', 'orange'], doublon_fichier: ['Doublon dans le fichier', 'orange'], bloque: ['Bloqué : ne pas rappeler', 'rouge'], invalide: ['Entreprise manquante', 'rouge'] };

  root.innerHTML = `
    <h1>Import de leads (CSV)</h1>
    <div class="card">
      <p class="muted">Colle le contenu du CSV ou choisis un fichier. Les colonnes sont détectées automatiquement (séparateur « ; », « , » ou tabulation).
        Les doublons (même téléphone, ou même entreprise + commune) et les leads « ne pas rappeler » ne sont jamais importés.</p>
      <div class="row">
        <label class="grow">Fichier CSV <input type="file" id="i-file" accept=".csv,text/csv,text/plain"></label>
        <button type="button" class="btn" data-act="modele">Télécharger le modèle CSV</button>
      </div>
      <label style="margin-top:10px">… ou colle le contenu ici <textarea id="i-texte" rows="6" placeholder="entreprise;dirigeant_prenom;dirigeant_nom;metier;commune;telephone;…">${esc(etatImport.texte)}</textarea></label>
      <div class="row" style="margin-top:10px">
        <label class="grow">Phase <select id="i-phase">${options(phases.map((p) => ({ code: p.id, label: `${p.nom} — ${p.cible}` })), etatImport.phaseId)}</select></label>
        <label>Semaine (lundi) <select id="i-semaine">${options(semaines.map((m) => ({ code: m, label: `Semaine du ${frDate(m)}` })), etatImport.semaine)}</select></label>
        <label>Source par défaut <select id="i-source">${options(SOURCES, etatImport.source)}</select></label>
        <button type="button" class="btn primary" data-act="apercu">Aperçu</button>
      </div>
    </div>
    ${ap ? `
      <div class="card">
        <h2 style="margin-top:0">Aperçu : ${ap.lignes.length} ligne${ap.lignes.length > 1 ? 's' : ''}</h2>
        <p class="muted">Colonnes détectées : ${Object.entries(ap.mapping).map(([f, c]) => `<strong>${esc(f)}</strong> ← « ${esc(c)} »`).join(', ') || 'aucune'}</p>
        ${!ap.mapping.entreprise && !ap.mapping.dirigeant ? warn('Colonne « entreprise » introuvable : vérifie la première ligne du fichier.') : ''}
        <div class="compteurs" style="margin:8px 0">${Object.entries(ETATS).map(([k, [t]]) => (nb(k) ? `<span class="compteur">${t} : ${nb(k)}</span>` : '')).join('')}</div>
        ${table(ap.lignes, [
          { label: 'État', html: (x) => badge(ETATS[x.etat][0], ETATS[x.etat][1]) },
          { label: 'Entreprise', html: (x) => esc(x.lead.entreprise) },
          { label: 'Dirigeant', html: (x) => esc(nomDirigeant(x.lead)) },
          { label: 'Commune', html: (x) => esc(x.lead.commune) },
          { label: 'Téléphone', html: (x) => esc(x.lead.telephone || x.lead.telephone_fixe || '') },
          { label: 'Source', html: (x) => esc(label(SOURCES, x.lead.source || etatImport.source)) },
          { label: 'Raison', html: (x) => esc(x.lead.raison_inclusion) },
        ], { cls: 'cards' })}
        <div class="row" style="margin-top:12px">
          <button type="button" class="btn primary" data-act="importer" ${nb('nouveau') ? '' : 'disabled'}>Importer ${nb('nouveau')} lead${nb('nouveau') > 1 ? 's' : ''} en ${esc(phase?.nom || '')}, semaine du ${frDate(etatImport.semaine)}</button>
          <button type="button" class="btn" data-act="annuler">Annuler</button>
        </div>
      </div>` : ''}
  `;

  const apercu = () => {
    etatImport.texte = root.querySelector('#i-texte').value;
    const { headers, rows } = parseCSV(etatImport.texte);
    const mapping = mapColumns(headers, ALIASES_LEAD);
    const parsed = rows.map((r) => ligneVersLead(r, mapping));
    const classes = classify(parsed.filter((x) => x.entreprise), d.leads, vocalKeys, (x) => x.statut === 'ne_pas_rappeler');
    let k = 0;
    etatImport.apercu = {
      mapping,
      lignes: parsed.map((lead) => (lead.entreprise ? { lead, etat: classes[k++].etat } : { lead, etat: 'invalide' })),
    };
    import_(root, ctx);
  };

  root.onchange = async (e) => {
    if (e.target.id === 'i-file' && e.target.files[0]) {
      root.querySelector('#i-texte').value = await e.target.files[0].text();
      apercu();
    }
    if (e.target.id === 'i-phase') { etatImport.phaseId = e.target.value; etatImport.semaine = null; etatImport.texte = root.querySelector('#i-texte').value; import_(root, ctx); }
    if (e.target.id === 'i-semaine') etatImport.semaine = e.target.value;
    if (e.target.id === 'i-source') etatImport.source = e.target.value;
  };
  root.onclick = async (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'modele') {
      download('modele-leads-agent-vocal.csv', toCSV([{
        entreprise: 'TEST Plomberie Exemple', dirigeant_prenom: 'Jean', dirigeant_nom: 'TEST', metier: 'Plombier',
        commune: 'Mulhouse', departement: '68', telephone: '0600000000', telephone_fixe: '', effectif: '3',
        site_web: '', source: 'cold', raison_inclusion: 'Dépannage 7j/7 affiché sur son site, seul à décrocher', notes: '',
      }], COLONNES_LEAD));
    }
    if (a === 'apercu') apercu();
    if (a === 'annuler') { etatImport.apercu = null; import_(root, ctx); }
    if (a === 'importer') {
      const rows = etatImport.apercu.lignes.filter((x) => x.etat === 'nouveau').map((x) => ({
        ...x.lead,
        source: x.lead.source || etatImport.source,
        phase_id: etatImport.phaseId,
        semaine: etatImport.semaine,
        statut: 'a_appeler',
        est_test: /^test\b/i.test(x.lead.entreprise),
      }));
      const ok = await act(() => ctx.db.insert(T.leads, rows), `${rows.length} lead${rows.length > 1 ? 's' : ''} importé${rows.length > 1 ? 's' : ''}`);
      if (ok) { etatImport.apercu = null; etatImport.texte = ''; ctx.refresh(); }
    }
  };
}
export { import_ as import };

// ============================================================
// Rendez-vous / démos
// ============================================================
export async function rdv(root, ctx) {
  const d = ctx.data;
  const leadsById = new Map(d.leads.map((l) => [l.id, l]));
  const phases = new Map(d.phases.map((p) => [p.id, p]));
  const rows = d.appels.filter(estDemo)
    .map((a) => ({ a, l: leadsById.get(a.lead_id) || {} }))
    .sort((x, y) => String(x.a.date_rdv || x.a.date_heure).localeCompare(String(y.a.date_rdv || y.a.date_heure)));
  root.innerHTML = `
    <h1>Rendez-vous et démos décrochés</h1>
    <div class="card row"><span class="muted">${rows.length} démo${rows.length > 1 ? 's' : ''} / RDV</span>
      <button type="button" class="btn right" data-act="export">Exporter en CSV</button></div>
    ${table(rows, [
      { label: 'Date du RDV', html: (r) => `<input type="datetime-local" data-daterdv="${r.a.id}" value="${r.a.date_rdv ? toLocalInput(r.a.date_rdv) : ''}" aria-label="Date du RDV">` },
      { label: 'Entreprise', html: (r) => `<strong>${esc(r.l.entreprise)}</strong><div class="muted">${esc(nomDirigeant(r.l))} · ${esc(r.l.commune || '')}</div>` },
      { label: 'Téléphone', html: (r) => esc(r.l.telephone || r.l.telephone_fixe || '') },
      { label: 'Phase', html: (r) => esc(phases.get(r.l.phase_id)?.nom || '—') },
      { label: 'Décroché le', html: (r) => frDateTime(r.a.date_heure) },
      { label: 'Statut', html: (r) => `<select data-rdvstatut="${r.a.id}" aria-label="Statut du RDV">${options(STATUTS_RDV, r.a.rdv_statut || 'a_faire')}</select>` },
      { label: 'Note', html: (r) => esc(r.a.note || '') },
    ], { cls: 'cards' })}
  `;
  root.onchange = async (e) => {
    const id = e.target.dataset.rdvstatut || e.target.dataset.daterdv;
    if (!id) return;
    const appel = d.appels.find((x) => x.id === id);
    const patch = e.target.dataset.rdvstatut ? { rdv_statut: e.target.value } : { date_rdv: fromLocalInput(e.target.value) };
    await act(async () => Object.assign(appel, await ctx.db.update(T.appels, id, patch)), 'Rendez-vous mis à jour');
  };
  root.onclick = (e) => {
    if (e.target.closest('[data-act="export"]')) {
      exportCSV('rdv-agent-vocal', rows.map((r) => ({
        date_rdv: r.a.date_rdv ? frDateTime(r.a.date_rdv) : '', entreprise: r.l.entreprise, dirigeant: nomDirigeant(r.l),
        commune: r.l.commune, telephone: r.l.telephone || r.l.telephone_fixe, phase: phases.get(r.l.phase_id)?.nom,
        source: r.l.source, decroche_le: frDateTime(r.a.date_heure), statut: label(STATUTS_RDV, r.a.rdv_statut || 'a_faire'), note: r.a.note,
      })));
    }
  };
}

// ============================================================
// Tableau de bord par phase
// ============================================================
function lignesIndicateurs(s) {
  return [
    ['Appels passés', String(s.appels)],
    ['Joints (une vraie personne a décroché)', String(s.joints)],
    ['Décideurs joints', String(s.decideurs)],
    ['Conversations > 1 min', String(s.conversations)],
    ['Démos / RDV', String(s.demos)],
    ['Refus', String(s.refus)],
    ['SMS envoyés', String(s.sms)],
    ['Taux de décrochage (joints / appels)', rate(s.taux.decrochage)],
    ['Taux de décideur (décideurs / joints)', rate(s.taux.decideur)],
    ['Taux de vraie conversation (> 1 min / joints)', rate(s.taux.conversation)],
    ['Taux de démo/RDV sur joints', rate(s.taux.demoSurJoints)],
    ['Taux de démo/RDV sur appels ★ indicateur principal', rate(s.taux.demoSurAppels)],
    ['Taux de refus (refus / joints)', rate(s.taux.refus)],
    ['Appels par rendez-vous', s.appelsParRdv === null ? '—' : num(s.appelsParRdv)],
  ];
}

const creneauLabel = (h) => `${h}h-${h + 1}h`;

export async function dashboard(root, ctx) {
  const d = ctx.data;
  const phases = phasesTriees(d);
  if (!etat.dashPhase || !phases.some((p) => p.id === etat.dashPhase)) etat.dashPhase = phaseCourante(d)?.id || phases[0]?.id;
  const phase = phases.find((p) => p.id === etat.dashPhase);
  const appels = phase ? appelsDePhase(d.appels, d.leads, phase.id, etat.dashSource || null) : [];
  const s = statsAppels(appels);
  const heures = parHeure(appels);
  const jours = parJour(appels);
  const bh = meilleur(heures);
  const bj = meilleur(jours);
  const motifs = motifsRefus(appels);
  const leadsPhase = d.leads.filter((l) => l.phase_id === phase?.id && (!etat.dashSource || l.source === etat.dashSource));

  root.innerHTML = `
    <h1>Tableau de bord par phase</h1>
    ${tabs(phases.map((p) => ({ id: p.id, label: p.nom })), etat.dashPhase)}
    ${phase ? `
    <div class="card">
      <div class="row">
        <div class="grow"><strong>${esc(phase.cible)}</strong><div class="muted">${frDate(phase.date_debut)} → ${frDate(phase.date_fin)} · créneau conseillé ${esc(phase.creneau_conseille || '—')} · ${leadsPhase.length} leads</div></div>
        <label>Source des leads <select id="d-source">${options([{ code: '', label: 'Toutes' }, ...SOURCES], etat.dashSource)}</select></label>
        <button type="button" class="btn" data-act="export">Exporter en CSV</button>
      </div>
    </div>
    ${s.echantillonTropPetit ? warn(`Échantillon trop petit pour conclure : ${s.appels} appel${s.appels > 1 ? 's' : ''} passé${s.appels > 1 ? 's' : ''} (minimum ${SEUIL_ECHANTILLON_VOCAL}).`) : ''}
    ${kpis([
      ['Appels passés', String(s.appels), `objectif ${phase.objectif_appels}`],
      ['Joints', String(s.joints)],
      ['Décideurs joints', String(s.decideurs)],
      ['Conversations > 1 min', String(s.conversations)],
      ['Démos / RDV', String(s.demos)],
      ['Refus', String(s.refus)],
      ['SMS envoyés', String(s.sms)],
    ])}
    <div class="card">
      <h2 style="margin-top:0">Taux</h2>
      ${table(lignesIndicateurs(s).slice(7), [
        { label: 'Indicateur', html: (r) => esc(r[0]) }, { label: 'Valeur', html: (r) => `<strong>${esc(r[1])}</strong>` },
      ], { cls: 'compare' })}
    </div>
    <div class="grid-2">
      <div class="card">
        <h2 style="margin-top:0">Par créneau horaire</h2>
        <p>Meilleur créneau : <strong>${bh ? `${creneauLabel(bh.cle)} — démo ${pct(bh.demos, bh.appels)}, décrochage ${pct(bh.joints, bh.appels)}` : '—'}</strong></p>
        ${table(heures, [
          { label: 'Créneau', html: (g) => creneauLabel(g.cle) }, { label: 'Appels', html: (g) => String(g.appels) },
          { label: 'Décrochage', html: (g) => pct(g.joints, g.appels) }, { label: 'Démos', html: (g) => pct(g.demos, g.appels) },
        ], { cls: 'compare' })}
      </div>
      <div class="card">
        <h2 style="margin-top:0">Par jour</h2>
        <p>Meilleur jour : <strong>${bj ? `${JOURS[bj.cle]} — démo ${pct(bj.demos, bj.appels)}, décrochage ${pct(bj.joints, bj.appels)}` : '—'}</strong></p>
        ${table(jours, [
          { label: 'Jour', html: (g) => JOURS[g.cle] }, { label: 'Appels', html: (g) => String(g.appels) },
          { label: 'Décrochage', html: (g) => pct(g.joints, g.appels) }, { label: 'Démos', html: (g) => pct(g.demos, g.appels) },
        ], { cls: 'compare' })}
      </div>
    </div>
    <div class="card">
      <h2 style="margin-top:0">Motifs de refus</h2>
      ${motifs.length ? bars('Répartition des refus', motifs.map((m) => ({ label: m.motif === 'non_renseigne' ? 'Non renseigné' : label(MOTIFS_REFUS, m.motif), value: m.n, text: pct(m.n, s.refus) }))) : empty('Aucun refus pour l’instant.')}
    </div>` : empty('Aucune phase. Crée-en une dans « Phases & réglages ».')}
  `;
  root.onclick = (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { etat.dashPhase = t.dataset.tab; dashboard(root, ctx); return; }
    if (e.target.closest('[data-act="export"]')) {
      const rows = [
        ...lignesIndicateurs(s).map(([k, v]) => ({ section: 'Indicateurs', indicateur: k, valeur: v })),
        ...heures.map((g) => ({ section: 'Créneaux', indicateur: creneauLabel(g.cle), valeur: `${g.appels} appels ; décrochage ${pct(g.joints, g.appels)} ; démos ${pct(g.demos, g.appels)}` })),
        ...jours.map((g) => ({ section: 'Jours', indicateur: JOURS[g.cle], valeur: `${g.appels} appels ; décrochage ${pct(g.joints, g.appels)} ; démos ${pct(g.demos, g.appels)}` })),
        ...motifs.map((m) => ({ section: 'Motifs de refus', indicateur: label(MOTIFS_REFUS, m.motif) || 'Non renseigné', valeur: pct(m.n, s.refus) })),
      ];
      exportCSV(`tableau-de-bord-${phase.nom.toLowerCase().replace(/\s+/g, '-')}${etat.dashSource ? `-${etat.dashSource}` : ''}`, rows, ['section', 'indicateur', 'valeur']);
    }
  };
  root.onchange = (e) => { if (e.target.id === 'd-source') { etat.dashSource = e.target.value; dashboard(root, ctx); } };
}

// ============================================================
// Comparaison finale
// ============================================================
function comparaisonData(d) {
  const phases = phasesTriees(d);
  const parPhase = phases.map((p) => ({ p, s: statsAppels(appelsDePhase(d.appels, d.leads, p.id)) }));
  const parSource = SOURCES.map((src) => ({ src, s: statsAppels(appelsDeSource(d.appels, d.leads, src.code)) }));
  const croise = phases.map((p) => ({ p, cols: SOURCES.map((src) => statsAppels(appelsDePhase(d.appels, d.leads, p.id, src.code))) }));
  return { phases, parPhase, parSource, croise };
}

function comparaisonHTML({ parPhase, parSource, croise }) {
  const indic = (s) => lignesIndicateurs(s);
  const head = (cols) => [{ label: 'Indicateur', html: (r) => esc(r.k) }, ...cols.map((c, i) => ({ label: c, html: (r) => esc(r.v[i]) }))];
  const rowsFor = (list) => indic(list[0]?.s || statsAppels([])).map(([k], i) => ({ k, v: list.map((x) => indic(x.s)[i][1]) }));
  const petits = parPhase.filter((x) => x.s.echantillonTropPetit);
  return `
    ${petits.length ? warn(`Échantillon trop petit pour conclure (moins de ${SEUIL_ECHANTILLON_VOCAL} appels passés) : ${petits.map((x) => `${x.p.nom} (${x.s.appels})`).join(', ')}.`) : ''}
    <h2>Les phases côte à côte</h2>
    ${table(rowsFor(parPhase), head(parPhase.map((x) => `${x.p.nom}${x.s.echantillonTropPetit ? ' ⚠' : ''}`)), { cls: 'compare' })}
    ${bars('Taux de démo/RDV sur appels (indicateur principal)', parPhase.map((x) => ({ label: `${x.p.nom}`, value: x.s.taux.demoSurAppels.d ? x.s.taux.demoSurAppels.n / x.s.taux.demoSurAppels.d : null, text: rate(x.s.taux.demoSurAppels) })))}
    ${bars('Taux de décrochage', parPhase.map((x) => ({ label: `${x.p.nom}`, value: x.s.taux.decrochage.d ? x.s.taux.decrochage.n / x.s.taux.decrochage.d : null, text: rate(x.s.taux.decrochage) })))}
    <h2>Leads cold vs ArtiGroup (toutes phases)</h2>
    ${table(rowsFor(parSource), head(parSource.map((x) => `${x.src.label}${x.s.echantillonTropPetit ? ' ⚠' : ''}`)), { cls: 'compare' })}
    <h2>Indicateur principal par phase et par source</h2>
    ${table(croise, [{ label: 'Phase', html: (r) => esc(r.p.nom) }, ...SOURCES.map((src, i) => ({ label: src.label, html: (r) => esc(rate(r.cols[i].taux.demoSurAppels)) }))], { cls: 'compare' })}
    <p class="muted">⚠ = moins de ${SEUIL_ECHANTILLON_VOCAL} appels passés : ne pas tirer de conclusion. « Joint » = une vraie personne a décroché (tout sauf pas de réponse, répondeur, faux numéro). Refus = « refus » + « ne pas rappeler ».</p>
  `;
}

export async function comparaison(root, ctx) {
  const c = comparaisonData(ctx.data);
  root.innerHTML = `
    <h1>Comparaison finale — agent vocal</h1>
    <div class="card row no-print">
      <span class="muted">Les ${c.phases.length} phases côte à côte, pourcentages avec le nombre brut entre parenthèses.</span>
      <button type="button" class="btn right" data-act="csv">Exporter en CSV</button>
      <button type="button" class="btn primary" data-act="bilan">Exporter le bilan</button>
    </div>
    ${comparaisonHTML(c)}
  `;
  root.onclick = (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'csv') {
      const rows = lignesIndicateurs(statsAppels([])).map(([k], i) => Object.fromEntries([
        ['indicateur', k],
        ...c.parPhase.map((x) => [x.p.nom, lignesIndicateurs(x.s)[i][1]]),
        ...c.parSource.map((x) => [x.src.label, lignesIndicateurs(x.s)[i][1]]),
      ]));
      exportCSV('comparaison-agent-vocal', rows);
    }
    if (a === 'bilan') {
      const body = `<h1>Bilan — CRM Mesure agents vocaux</h1><p class="meta">Solvex Automation · généré le ${frDateTime(new Date())}</p>${comparaisonHTML(c)}`;
      download(`bilan-agent-vocal-${todayISO()}.html`, bilanHTML('Bilan agent vocal — Solvex Mesure', body), 'text/html;charset=utf-8');
    }
  };
}

// ============================================================
// Phases & réglages (+ données de test)
// ============================================================
export async function phases(root, ctx) {
  const d = ctx.data;
  const list = phasesTriees(d);
  const nbTest = d.leads.filter((l) => l.est_test).length + d.appels.filter((a) => a.est_test).length;
  const champs = (p = {}) => `
    <label>N° <input type="number" name="numero" min="1" value="${esc(p.numero ?? list.length + 1)}" required></label>
    <label>Nom <input name="nom" value="${esc(p.nom ?? `Phase ${list.length + 1}`)}" required></label>
    <label class="grow">Cible <input name="cible" value="${esc(p.cible ?? '')}" required></label>
    <label>Début <input type="date" name="date_debut" value="${esc(p.date_debut ?? '')}" required></label>
    <label>Fin <input type="date" name="date_fin" value="${esc(p.date_fin ?? '')}" required></label>
    <label>Créneau conseillé <input name="creneau_conseille" value="${esc(p.creneau_conseille ?? '')}" placeholder="10h-12h"></label>
    <label>Objectif d'appels <input type="number" min="0" name="objectif_appels" value="${esc(p.objectif_appels ?? 120)}"></label>`;
  root.innerHTML = `
    <h1>Phases & réglages — agent vocal</h1>
    <p class="muted">Décale une date ou ajoute une cible ici : les filtres, la file d'appel et les tableaux de bord suivent automatiquement.</p>
    ${list.map((p) => `<form class="card row" data-phase="${p.id}">${champs(p)}
      <button type="submit" class="btn primary">Enregistrer</button>
      <button type="button" class="btn danger" data-suppr="${p.id}">Supprimer</button></form>`).join('')}
    <h2>Ajouter une phase</h2>
    <form class="card row" data-phase="">${champs()}<button type="submit" class="btn primary">Ajouter</button></form>

    <h2>Données de test</h2>
    <div class="card">
      <p class="muted">Données fictives évidentes (entreprises « TEST … », numéros 06 00 00 00 xx) pour essayer l'application. Elles ne touchent jamais aux données réelles.</p>
      <div class="row">
        <button type="button" class="btn" data-act="charger">Charger des données de test</button>
        <button type="button" class="btn danger" data-act="vider" ${nbTest ? '' : 'disabled'}>Vider les données de test (${nbTest})</button>
      </div>
    </div>
  `;
  root.onsubmit = async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    f.numero = Number(f.numero);
    f.objectif_appels = Number(f.objectif_appels || 0);
    if (f.date_fin < f.date_debut) { toast('La date de fin doit être après la date de début.', 'erreur'); return; }
    const id = e.target.dataset.phase;
    const ok = await act(() => (id ? ctx.db.update(T.phases, id, f) : ctx.db.insert(T.phases, f)), id ? 'Phase enregistrée' : 'Phase ajoutée');
    if (ok) ctx.refresh();
  };
  root.onclick = async (e) => {
    const id = e.target.dataset.suppr;
    if (id) {
      if (d.leads.some((l) => l.phase_id === id)) { toast('Cette phase contient des leads : déplace-les ou supprime-les d’abord.', 'erreur'); return; }
      if (confirm('Supprimer cette phase ?')) { await act(() => ctx.db.remove(T.phases, id), 'Phase supprimée'); ctx.refresh(); }
    }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'charger') { await act(() => chargerTestVocal(ctx.db, d), 'Données de test chargées'); ctx.refresh(); }
    if (a === 'vider' && confirm('Supprimer toutes les données de test du CRM agent vocal ?')) {
      await act(async () => { await ctx.db.removeTest(T.appels); await ctx.db.removeTest(T.leads); }, 'Données de test supprimées');
      etat.leadId = null;
      ctx.refresh();
    }
  };
}
