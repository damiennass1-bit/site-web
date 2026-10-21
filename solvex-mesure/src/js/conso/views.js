// Écrans du CRM Mesure prospection consulting (mails un par un + réseau chaud)
// Règle forte : l'application n'envoie AUCUN mail. Elle enregistre ce que Damien fait lui-même.

import { esc, pct, num, euro } from '../lib/format.js';
import {
  todayISO, mondayOf, addDays, frDate, frDateTime, currentPeriod, toLocalInput, fromLocalInput,
} from '../lib/dates.js';
import { parseCSV, mapColumns, toCSV, download } from '../lib/csv.js';
import { classify, consoKeys } from '../lib/dedupe.js';
import { similarPairs, forbiddenIssues, validationErrors } from '../lib/quality.js';
import {
  STATUTS_MAIL, REPONSES, ENVOYES, statsCible, statsReseau, aRelancer, SEUIL_ECHANTILLON_CONSO, estEnvoye,
} from '../lib/stats-conso.js';
import {
  toast, act, options, tabs, rate, kpis, warn, bars, exportCSV, empty, badge, table, formData, bilanHTML,
} from '../ui.js';
import { chargerTestConso } from './testdata.js';

const T = {
  cibles: 'mesure_conso_cibles', entreprises: 'mesure_conso_entreprises', mails: 'mesure_conso_mails',
  reseau: 'mesure_conso_reseau', rdv: 'mesure_conso_rdv', parametres: 'mesure_conso_parametres',
};

const SOURCES = [
  { code: 'sourcing', label: 'Sourcing' },
  { code: 'reseau', label: 'Réseau' },
  { code: 'recommandation', label: 'Recommandation' },
];
const LIENS = [
  { code: 'ancien_client', label: 'Ancien client' }, { code: 'client_en_cours', label: 'Client en cours' },
  { code: 'partenaire', label: 'Partenaire' }, { code: 'apporteur', label: "Apporteur d'affaires" },
  { code: 'connaissance', label: 'Connaissance' }, { code: 'fede', label: 'Fédé' }, { code: 'comptable', label: 'Comptable' },
];
const TYPES_RDV = [{ code: 'decouverte', label: 'Découverte' }, { code: 'proposition', label: 'Proposition' }, { code: 'suivi', label: 'Suivi' }];
const STATUTS_RDV = [
  { code: 'a_faire', label: 'À faire' }, { code: 'fait', label: 'Fait' }, { code: 'devis', label: 'Devis' },
  { code: 'signe', label: 'Signé' }, { code: 'perdu', label: 'Perdu' },
];
const COULEUR_STATUT = {
  brouillon: '', valide: 'bleu', envoye: 'bleu', repondu_positif: 'vert', rendez_vous: 'vert',
  repondu_neutre: 'orange', refus: 'rouge', stop: 'rouge', bounce: 'rouge',
};

const label = (list, code) => list.find((x) => x.code === code)?.label || code || '';
const nomDirigeant = (e) => [e.dirigeant_prenom, e.dirigeant_nom].filter(Boolean).join(' ');
const statutBadge = (m) => badge(label(STATUTS_MAIL, m.statut), COULEUR_STATUT[m.statut]);
const nowISO = () => new Date().toISOString();

function ciblesTriees(d) {
  return [...d.cibles]
    .map((c) => ({ ...c, debut: c.date_sourcing || c.date_envoi_1, fin: addDays(c.date_sourcing || c.date_envoi_1 || todayISO(), 6) }))
    .sort((a, b) => String(a.semaine).localeCompare(String(b.semaine), 'fr', { numeric: true }) || String(a.debut).localeCompare(String(b.debut)));
}
const cibleCourante = (d) => currentPeriod(ciblesTriees(d).filter((c) => c.debut), 'debut', 'fin');

const parametre = (d, cle) => d.parametres.find((p) => p.cle === cle)?.valeur;

function mailsDe(d, entrepriseId) {
  return d.mails.filter((m) => m.entreprise_id === entrepriseId)
    .sort((a, b) => (a.type === b.type ? String(a.created_at).localeCompare(String(b.created_at)) : a.type === 'premier' ? -1 : 1));
}

// Alertes qualité d'une cible : copier-coller (> 80 %) et contenus interdits
function alertesQualite(d, cibleId) {
  const ents = new Map(d.entreprises.filter((e) => e.cible_id === cibleId).map((e) => [e.id, e]));
  const mails = d.mails.filter((m) => ents.has(m.entreprise_id)).map((m) => ({ ...m, cible_id: cibleId }));
  const similaires = new Map();
  for (const p of similarPairs(mails)) {
    for (const [x, y] of [[p.a, p.b], [p.b, p.a]]) {
      const autre = ents.get(mails.find((m) => m.id === y).entreprise_id);
      similaires.set(x, [...(similaires.get(x) || []), { nom: autre?.entreprise || '?', score: p.score }]);
    }
  }
  const interdits = new Map(mails.map((m) => [m.id, forbiddenIssues(m)]).filter(([, v]) => v.length));
  return { similaires, interdits, ents };
}

// Change le statut d'un mail en appliquant les règles (validation, stop, RDV)
async function changerStatut(ctx, mail, statut) {
  const d = ctx.data;
  const ent = d.entreprises.find((e) => e.id === mail.entreprise_id);
  const patch = { statut };
  if (statut === 'valide') {
    const errs = validationErrors(mail, ent);
    if (errs.length) { errs.forEach((m) => toast(m, 'erreur')); return false; }
    patch.valide_le = nowISO();
  } else if (statut === 'brouillon') {
    if (estEnvoye(mail)) { toast('Ce mail est déjà envoyé : il ne peut plus repasser en brouillon.', 'erreur'); return false; }
    patch.valide_le = null;
  } else if (statut === 'envoye') {
    if (!estEnvoye(mail) && mail.statut !== 'valide') { toast('Valide d’abord le mail avant de le marquer envoyé.', 'erreur'); return false; }
    if (!estEnvoye(mail) && ent?.statut === 'stop') { toast('Entreprise marquée « stop » : plus aucun envoi.', 'erreur'); return false; }
    patch.envoye_le = mail.envoye_le || nowISO();
    patch.reponse_le = null;
  } else if (ENVOYES.has(statut)) {
    if (!estEnvoye(mail)) { toast('Marque d’abord le mail comme envoyé.', 'erreur'); return false; }
    patch.reponse_le = REPONSES.has(statut) ? mail.reponse_le || nowISO() : null;
  }
  return act(async () => {
    Object.assign(mail, await ctx.db.update(T.mails, mail.id, patch));
    if (statut === 'stop' && ent && ent.statut !== 'stop') {
      Object.assign(ent, await ctx.db.update(T.entreprises, ent.id, { statut: 'stop' }));
    }
    if (statut === 'rendez_vous' && !d.rdv.some((r) => r.entreprise_id === mail.entreprise_id)) {
      const [r] = await ctx.db.insert(T.rdv, {
        entreprise_id: mail.entreprise_id, type: 'decouverte', statut: 'a_faire', est_test: !!mail.est_test,
        note: 'Créé automatiquement depuis la réponse au mail',
      });
      d.rdv.push(r);
      toast('Rendez-vous ajouté dans l’onglet « Rendez-vous » : complète la date et le montant potentiel.');
    }
    return true;
  }, `Mail : ${label(STATUTS_MAIL, statut)}`);
}

// Boutons d'action d'un mail selon son statut
function actionsMail(m, ent) {
  if (m.statut === 'brouillon') return `<button type="button" class="btn small primary" data-statut="valide" data-mail="${m.id}">Valider</button>`;
  if (m.statut === 'valide') {
    return `<button type="button" class="btn small primary" data-statut="envoye" data-mail="${m.id}" ${ent?.statut === 'stop' ? 'disabled' : ''}>Je l'ai envoyé</button>
      <button type="button" class="btn small" data-statut="brouillon" data-mail="${m.id}">Repasser en brouillon</button>`;
  }
  return `<select data-reponse="${m.id}" aria-label="Réponse">${options(STATUTS_MAIL.filter((s) => ENVOYES.has(s.code)), m.statut)}</select>`;
}

function gererActionsMail(ctx, e, rerender) {
  const b = e.target.closest('[data-statut][data-mail]');
  if (!b) return false;
  const mail = ctx.data.mails.find((m) => m.id === b.dataset.mail);
  changerStatut(ctx, mail, b.dataset.statut).then((ok) => { if (ok) rerender(); });
  return true;
}
function gererReponse(ctx, e, rerender) {
  const id = e.target.dataset.reponse;
  if (!id) return false;
  const mail = ctx.data.mails.find((m) => m.id === id);
  changerStatut(ctx, mail, e.target.value).then((ok) => rerender(ok));
  return true;
}

// ============================================================
// Semaine en cours
// ============================================================
const etat = { cibleId: null, filtre: '', dashTab: null, reseauFiltre: false, rdvForm: false };

export async function semaine(root, ctx) {
  const d = ctx.data;
  const cibles = ciblesTriees(d);
  if (!etat.cibleId || !cibles.some((c) => c.id === etat.cibleId)) etat.cibleId = cibleCourante(d)?.id || cibles[0]?.id;
  const cible = cibles.find((c) => c.id === etat.cibleId);
  const { similaires, interdits } = alertesQualite(d, etat.cibleId);
  const FILTRES = [
    { code: '', label: 'Tous les mails' }, { code: 'brouillon', label: 'Brouillons' }, { code: 'valide', label: 'Validés (à envoyer)' },
    { code: 'envoye', label: 'Envoyés sans réponse' }, { code: 'reponse', label: 'Avec réponse' }, { code: 'stop', label: 'Stop / bounce' },
  ];
  const ents = d.entreprises.filter((e) => e.cible_id === etat.cibleId)
    .map((e) => ({ e, mails: mailsDe(d, e.id) }))
    .filter(({ e, mails }) => {
      const p = mails.find((m) => m.type === 'premier') || mails[0];
      const st = mails.map((m) => m.statut);
      switch (etat.filtre) {
        case 'brouillon': return st.includes('brouillon') || !mails.length;
        case 'valide': return st.includes('valide');
        case 'envoye': return p && mails.every((m) => !REPONSES.has(m.statut) && m.statut !== 'bounce') && mails.some(estEnvoye);
        case 'reponse': return mails.some((m) => REPONSES.has(m.statut));
        case 'stop': return e.statut === 'stop' || st.includes('bounce');
        default: return true;
      }
    })
    .sort((a, b) => a.e.entreprise.localeCompare(b.e.entreprise));
  const tousMails = d.mails.filter((m) => d.entreprises.some((e) => e.id === m.entreprise_id && e.cible_id === etat.cibleId));
  const compte = (pred) => tousMails.filter(pred).length;

  root.innerHTML = `
    <h1>Semaine en cours</h1>
    ${tabs(cibles.map((c) => ({ id: c.id, label: `${c.semaine} · ${c.nom}` })), etat.cibleId)}
    ${cible ? `
    <div class="card">
      <div class="row">
        <div class="grow"><strong>${esc(cible.description || cible.nom)}</strong>
          <div class="muted">Sourcing ${frDate(cible.date_sourcing)} · envois ${frDate(cible.date_envoi_1)} et ${frDate(cible.date_envoi_2)} (9h-10h30)</div></div>
        <label>Filtre <select id="s-filtre">${options(FILTRES, etat.filtre)}</select></label>
        <button type="button" class="btn" data-act="export">Exporter en CSV</button>
      </div>
      <div class="compteurs" style="margin-top:10px">
        <span class="compteur">Entreprises : ${d.entreprises.filter((e) => e.cible_id === etat.cibleId).length}</span>
        <span class="compteur">Brouillons : ${compte((m) => m.statut === 'brouillon')}</span>
        <span class="compteur">Validés : ${compte((m) => m.statut === 'valide')}</span>
        <span class="compteur">Envoyés : ${compte(estEnvoye)}</span>
        <span class="compteur">Réponses : ${compte((m) => REPONSES.has(m.statut))}</span>
      </div>
      <p class="muted" style="margin:10px 0 0">Rien n'est envoyé par l'application : tu valides, tu envoies toi-même depuis ta messagerie, puis tu cliques « Je l'ai envoyé ».</p>
    </div>
    ${similaires.size ? `<div class="alerte rouge"><strong>Copier-coller détecté :</strong> ${similaires.size} mail${similaires.size > 1 ? 's de cette cible ont' : ' de cette cible a'} un corps identique à plus de 80 % à un autre. Personnalise-les.</div>` : ''}
    ${interdits.size ? `<div class="alerte rouge"><strong>Contenu interdit :</strong> ${interdits.size} mail${interdits.size > 1 ? 's contiennent' : ' contient'} un prix, « VocaStork » ou « ArtiGroup ». Ils ne peuvent pas être validés.</div>` : ''}
    ${table(ents, [
      { label: 'Entreprise', html: ({ e }) => `<a href="#/conso/entreprise/${e.id}"><strong>${esc(e.entreprise)}</strong></a>${e.statut === 'stop' ? ` ${badge('STOP', 'rouge')}` : ''}<div class="muted">${esc([nomDirigeant(e), e.fonction, e.ville].filter(Boolean).join(' · '))}</div>` },
      { label: 'Information vraie', html: ({ e }) => (e.information_vraie ? `${esc(e.information_vraie)}${e.url_source_information ? ` <a href="${esc(e.url_source_information)}" target="_blank" rel="noopener noreferrer">source</a>` : ` ${badge('source manquante', 'rouge')}`}` : badge('manquante', 'rouge')) },
      { label: 'Mails', html: ({ e, mails }) => (mails.length ? mails.map((m) => `<div style="margin-bottom:6px">${m.type === 'relance' ? 'Relance' : '1er mail'} ${statutBadge(m)}
          ${similaires.has(m.id) ? badge(`≈ ${similaires.get(m.id).map((x) => x.nom).join(', ')}`, 'rouge') : ''}
          ${interdits.has(m.id) ? badge(`contient ${interdits.get(m.id).join(', ')}`, 'rouge') : ''}
          <div class="row" style="margin-top:4px">${actionsMail(m, e)}</div></div>`).join('') : `<span class="muted">Aucun mail</span> <a href="#/conso/entreprise/${e.id}">rédiger</a>`) },
    ], { cls: 'cards' })}
    ` : empty('Aucune cible. Crée-en une dans « Cibles & réglages ».')}
  `;
  const rerender = () => semaine(root, ctx);
  root.onclick = (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { etat.cibleId = t.dataset.tab; rerender(); return; }
    if (gererActionsMail(ctx, e, rerender)) return;
    if (e.target.closest('[data-act="export"]')) {
      exportCSV(`semaine-${cible.semaine}-${cible.nom}`, ents.flatMap(({ e: en, mails }) => (mails.length ? mails : [{}]).map((m) => ({
        entreprise: en.entreprise, dirigeant: nomDirigeant(en), fonction: en.fonction, ville: en.ville, mail_pro: en.mail_pro,
        information_vraie: en.information_vraie, url_source_information: en.url_source_information, type: m.type || '',
        objet: m.objet || '', statut: m.statut || '', envoye_le: m.envoye_le ? frDateTime(m.envoye_le) : '', reponse_le: m.reponse_le ? frDateTime(m.reponse_le) : '',
      }))));
    }
  };
  root.onchange = (e) => {
    if (e.target.id === 's-filtre') { etat.filtre = e.target.value; rerender(); return; }
    gererReponse(ctx, e, rerender);
  };
}

// ============================================================
// Fiche entreprise
// ============================================================
const CHAMPS_ENT = [
  ['entreprise', 'Entreprise', 'text', true], ['dirigeant_prenom', 'Prénom du dirigeant'], ['dirigeant_nom', 'Nom du dirigeant'],
  ['fonction', 'Fonction'], ['taille', 'Taille (effectif ou tranche)'], ['ville', 'Ville'], ['departement', 'Département'],
  ['site_web', 'Site web', 'url'], ['mail_pro', 'Mail pro', 'email'], ['telephone', 'Téléphone', 'tel'],
];

export async function entreprise(root, ctx) {
  const d = ctx.data;
  const e = d.entreprises.find((x) => x.id === ctx.params[0]);
  if (!e) { root.innerHTML = `${empty('Entreprise introuvable.')}<a href="#/conso/semaine">Retour</a>`; return; }
  const cibles = ciblesTriees(d);
  const mails = mailsDe(d, e.id);
  const rdvs = d.rdv.filter((r) => r.entreprise_id === e.id);
  const { similaires, interdits } = alertesQualite(d, e.cible_id);
  const premierEnvoye = mails.some((m) => m.type === 'premier' && estEnvoye(m));

  root.innerHTML = `
    <p><a href="#/conso/semaine">← Semaine en cours</a></p>
    <h1>${esc(e.entreprise)} ${e.statut === 'stop' ? badge('STOP — plus aucun envoi', 'rouge') : ''}</h1>
    <form class="card" id="f-ent">
      <div class="grid-3">
        ${CHAMPS_ENT.map(([k, l, type = 'text', req]) => `<label>${l} <input type="${type}" name="${k}" value="${esc(e[k] ?? '')}" ${req ? 'required' : ''}></label>`).join('')}
        <label>Cible <select name="cible_id">${options(cibles.map((c) => ({ code: c.id, label: `${c.semaine} · ${c.nom}` })), e.cible_id)}</select></label>
        <label>Source <select name="source">${options(SOURCES, e.source)}</select></label>
        <label>Statut <select name="statut">${options([{ code: 'actif', label: 'Actif' }, { code: 'stop', label: 'Stop (plus aucun envoi)' }], e.statut)}</select></label>
      </div>
      <label style="margin-top:10px">Information vraie (fait récent et vérifiable utilisé dans le mail) — obligatoire pour valider
        <textarea name="information_vraie" rows="2">${esc(e.information_vraie ?? '')}</textarea></label>
      <label style="margin-top:10px">URL de la source de l'information — obligatoire
        <input type="url" name="url_source_information" value="${esc(e.url_source_information ?? '')}" placeholder="https://…"></label>
      ${e.url_source_information ? `<p class="muted"><a href="${esc(e.url_source_information)}" target="_blank" rel="noopener noreferrer">Ouvrir la source pour vérifier</a></p>` : ''}
      <div class="row" style="margin-top:10px">
        <button type="submit" class="btn primary">Enregistrer la fiche</button>
        <button type="button" class="btn danger right" data-act="suppr">Supprimer l'entreprise</button>
      </div>
    </form>

    <h2>Mails</h2>
    ${mails.map((m) => {
      const verrouille = estEnvoye(m);
      return `<form class="card" data-mailform="${m.id}">
        <div class="row"><strong>${m.type === 'relance' ? 'Relance' : 'Premier mail'}</strong> ${statutBadge(m)}
          ${similaires.has(m.id) ? badge(`Corps identique à plus de 80 % : ${similaires.get(m.id).map((x) => `${x.nom} (${Math.round(x.score * 100)} %)`).join(', ')}`, 'rouge') : ''}
          ${interdits.has(m.id) ? badge(`Contient ${interdits.get(m.id).join(', ')}`, 'rouge') : ''}</div>
        <label style="margin-top:8px">Objet <input name="objet" value="${esc(m.objet ?? '')}" ${verrouille ? 'readonly' : ''}></label>
        <label style="margin-top:8px">Corps <textarea name="corps" rows="9" ${verrouille ? 'readonly' : ''}>${esc(m.corps ?? '')}</textarea></label>
        ${verrouille ? `<div class="grid-3" style="margin-top:8px">
          <label>Envoyé le <input type="datetime-local" name="envoye_le" value="${m.envoye_le ? toLocalInput(m.envoye_le) : ''}"></label>
          <label>Réponse le <input type="datetime-local" name="reponse_le" value="${m.reponse_le ? toLocalInput(m.reponse_le) : ''}"></label>
          <label>Note sur la réponse <input name="note_reponse" value="${esc(m.note_reponse ?? '')}"></label></div>` : ''}
        <p class="muted">${m.valide_le ? `Validé le ${frDateTime(m.valide_le)}. ` : ''}${m.envoye_le ? `Envoyé le ${frDateTime(m.envoye_le)}. ` : ''}${m.reponse_le ? `Réponse le ${frDateTime(m.reponse_le)}.` : ''}
          ${!verrouille && m.statut === 'valide' ? 'Modifier le texte repasse le mail en brouillon.' : ''}</p>
        <div class="row">
          <button type="submit" class="btn">Enregistrer ${verrouille ? 'les dates' : 'le texte'}</button>
          ${actionsMail(m, e)}
          ${!verrouille ? `<button type="button" class="btn small danger right" data-supprmail="${m.id}">Supprimer ce mail</button>` : ''}
        </div>
      </form>`;
    }).join('') || empty('Aucun mail pour cette entreprise.')}
    <div class="row">
      ${!mails.some((m) => m.type === 'premier') ? '<button type="button" class="btn" data-act="premier">Rédiger le premier mail</button>' : ''}
      ${premierEnvoye && e.statut !== 'stop' ? '<button type="button" class="btn" data-act="relance">Ajouter une relance</button>' : ''}
    </div>

    <h2>Rendez-vous</h2>
    ${table(rdvs, [
      { label: 'Date', html: (r) => (r.date ? frDateTime(r.date) : '—') },
      { label: 'Type', html: (r) => esc(label(TYPES_RDV, r.type)) },
      { label: 'Statut', html: (r) => esc(label(STATUTS_RDV, r.statut)) },
      { label: 'Montant potentiel', html: (r) => euro(r.montant_potentiel_eur) },
      { label: 'Prochaine étape', html: (r) => esc(r.prochaine_etape ?? '') },
    ], { cls: 'cards' })}
    <p><a href="#/conso/rdv">Gérer les rendez-vous</a></p>
  `;
  const rerender = () => entreprise(root, ctx);
  root.onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (f.id === 'f-ent') {
      const patch = formData(f);
      if (e.statut === 'stop' && patch.statut !== 'stop' && !confirm('Cette entreprise avait demandé « stop ». La réactiver quand même ?')) return;
      const ok = await act(async () => Object.assign(e, await ctx.db.update(T.entreprises, e.id, patch)), 'Fiche enregistrée');
      if (ok) rerender();
      return;
    }
    const id = f.dataset.mailform;
    if (id) {
      const m = d.mails.find((x) => x.id === id);
      const v = formData(f);
      let patch;
      if (estEnvoye(m)) {
        patch = { envoye_le: fromLocalInput(v.envoye_le) || m.envoye_le, reponse_le: fromLocalInput(v.reponse_le), note_reponse: v.note_reponse };
      } else {
        patch = { objet: v.objet, corps: v.corps };
        if (m.statut === 'valide' && (v.objet !== (m.objet || null) || v.corps !== (m.corps || null))) {
          patch.statut = 'brouillon'; patch.valide_le = null;
        }
      }
      const ok = await act(async () => Object.assign(m, await ctx.db.update(T.mails, id, patch)), patch.statut === 'brouillon' ? 'Texte modifié : le mail repasse en brouillon' : 'Mail enregistré');
      if (ok) rerender();
    }
  };
  root.onclick = async (ev) => {
    if (gererActionsMail(ctx, ev, rerender)) return;
    const a = ev.target.closest('[data-act]')?.dataset.act;
    if (a === 'premier' || a === 'relance') {
      if (e.statut === 'stop') { toast('Entreprise marquée « stop » : plus aucun envoi.', 'erreur'); return; }
      await act(async () => { d.mails.push(...await ctx.db.insert(T.mails, { entreprise_id: e.id, type: a, statut: 'brouillon', est_test: !!e.est_test })); });
      rerender();
    }
    if (a === 'suppr' && confirm(`Supprimer « ${e.entreprise} », ses mails et ses rendez-vous ?`)) {
      await act(() => ctx.db.remove(T.entreprises, e.id), 'Entreprise supprimée');
      location.hash = '#/conso/semaine';
      ctx.refresh();
    }
    const sm = ev.target.dataset.supprmail;
    if (sm && confirm('Supprimer ce mail (non envoyé) ?')) {
      await act(() => ctx.db.remove(T.mails, sm), 'Mail supprimé');
      ctx.refresh();
    }
  };
  root.onchange = (ev) => { gererReponse(ctx, ev, rerender); };
}

// ============================================================
// Import CSV
// ============================================================
const ALIASES_ENT = {
  entreprise: ['societe', 'raison_sociale', 'nom_entreprise', 'company', 'cabinet'],
  dirigeant_prenom: ['prenom', 'prenom_dirigeant', 'first_name'],
  dirigeant_nom: ['nom', 'nom_dirigeant', 'last_name'],
  dirigeant: ['contact', 'nom_complet', 'gerant'],
  fonction: ['poste', 'titre', 'role'],
  taille: ['effectif', 'salaries', 'nb_salaries', 'tranche_effectif'],
  ville: ['commune', 'city', 'localite'],
  departement: ['dept', 'dep', 'code_departement'],
  site_web: ['site', 'url', 'website', 'site_internet'],
  mail_pro: ['email', 'mail', 'e_mail', 'email_pro', 'adresse_mail', 'courriel'],
  telephone: ['tel', 'phone', 'mobile', 'portable'],
  source: ['origine'],
  information_vraie: ['information', 'info_vraie', 'fait_recent', 'accroche', 'info'],
  url_source_information: ['url_source', 'source_information', 'lien_source', 'source_url', 'url_information'],
  objet: ['sujet', 'subject', 'objet_mail'],
  corps: ['message', 'body', 'texte', 'corps_mail', 'contenu'],
};
const COLONNES_MODELE = ['entreprise', 'dirigeant', 'fonction', 'taille', 'ville', 'site', 'mail_pro', 'telephone', 'information_vraie', 'url_source_information', 'objet', 'corps'];
const etatImport = { texte: '', apercu: null, cibleId: null };

function ligneVersEntreprise(row, mapping) {
  const get = (f) => (mapping[f] ? String(row[mapping[f]] ?? '').trim() : '');
  const e = {};
  for (const f of ['entreprise', 'dirigeant_prenom', 'dirigeant_nom', 'fonction', 'taille', 'ville', 'departement', 'site_web', 'mail_pro', 'telephone', 'information_vraie', 'url_source_information']) e[f] = get(f) || null;
  if (!e.dirigeant_prenom && !e.dirigeant_nom && get('dirigeant')) {
    const [p, ...n] = get('dirigeant').split(/\s+/);
    e.dirigeant_prenom = p || null;
    e.dirigeant_nom = n.join(' ') || null;
  }
  const src = get('source').toLowerCase();
  e.source = src.startsWith('reco') ? 'recommandation' : src.startsWith('res') || src.startsWith('rés') ? 'reseau' : 'sourcing';
  return { e, mail: { objet: get('objet') || null, corps: get('corps') || null } };
}

export async function import_(root, ctx) {
  const d = ctx.data;
  const cibles = ciblesTriees(d);
  if (!etatImport.cibleId || !cibles.some((c) => c.id === etatImport.cibleId)) {
    const prochaine = cibles.find((c) => c.debut && c.debut >= todayISO()) || cibleCourante(d);
    etatImport.cibleId = prochaine?.id || cibles[0]?.id;
  }
  const ap = etatImport.apercu;
  const nb = (k) => (ap ? ap.lignes.filter((x) => x.etat === k).length : 0);
  const ETATS = { nouveau: ['Nouveau', 'vert'], doublon: ['Doublon (déjà en base)', 'orange'], doublon_fichier: ['Doublon dans le fichier', 'orange'], bloque: ['Bloqué : stop', 'rouge'], invalide: ['Entreprise manquante', 'rouge'] };

  root.innerHTML = `
    <h1>Import d'entreprises avec mails rédigés (CSV)</h1>
    <div class="card">
      <p class="muted">Colonnes : ${COLONNES_MODELE.join(', ')}. Détection automatique des colonnes et du séparateur.
        Doublons : même mail pro, ou même entreprise + ville. Les entreprises « stop » ne sont jamais réimportées. Chaque mail importé arrive en <strong>brouillon</strong> : tu le valides toi-même.</p>
      <div class="row">
        <label class="grow">Fichier CSV <input type="file" id="i-file" accept=".csv,text/csv,text/plain"></label>
        <button type="button" class="btn" data-act="modele">Télécharger le modèle CSV</button>
      </div>
      <label style="margin-top:10px">… ou colle le contenu ici <textarea id="i-texte" rows="6">${esc(etatImport.texte)}</textarea></label>
      <div class="row" style="margin-top:10px">
        <label class="grow">Cible <select id="i-cible">${options(cibles.map((c) => ({ code: c.id, label: `${c.semaine} · ${c.nom}` })), etatImport.cibleId)}</select></label>
        <button type="button" class="btn primary" data-act="apercu">Aperçu</button>
      </div>
    </div>
    ${ap ? `<div class="card">
      <h2 style="margin-top:0">Aperçu : ${ap.lignes.length} ligne${ap.lignes.length > 1 ? 's' : ''}</h2>
      <p class="muted">Colonnes détectées : ${Object.entries(ap.mapping).map(([f, c]) => `<strong>${esc(f)}</strong> ← « ${esc(c)} »`).join(', ') || 'aucune'}</p>
      <div class="compteurs" style="margin:8px 0">${Object.entries(ETATS).map(([k, [t]]) => (nb(k) ? `<span class="compteur">${t} : ${nb(k)}</span>` : '')).join('')}</div>
      ${table(ap.lignes, [
        { label: 'État', html: (x) => badge(ETATS[x.etat][0], ETATS[x.etat][1]) },
        { label: 'Entreprise', html: (x) => esc(x.e.entreprise) },
        { label: 'Dirigeant', html: (x) => esc(nomDirigeant(x.e)) },
        { label: 'Ville', html: (x) => esc(x.e.ville) },
        { label: 'Mail pro', html: (x) => esc(x.e.mail_pro) },
        { label: 'Contrôles', html: (x) => {
          const errs = validationErrors(x.mail, x.e);
          return errs.length ? `<span class="muted">${errs.length} point${errs.length > 1 ? 's' : ''} à corriger avant validation</span>` : badge('validable', 'vert');
        } },
      ], { cls: 'cards' })}
      <div class="row" style="margin-top:12px">
        <button type="button" class="btn primary" data-act="importer" ${nb('nouveau') ? '' : 'disabled'}>Importer ${nb('nouveau')} entreprise${nb('nouveau') > 1 ? 's' : ''}</button>
        <button type="button" class="btn" data-act="annuler">Annuler</button>
      </div></div>` : ''}
  `;

  const apercu = () => {
    etatImport.texte = root.querySelector('#i-texte').value;
    const { headers, rows } = parseCSV(etatImport.texte);
    const mapping = mapColumns(headers, ALIASES_ENT);
    const parsed = rows.map((r) => ligneVersEntreprise(r, mapping));
    const valides = parsed.filter((x) => x.e.entreprise);
    const classes = classify(valides.map((x) => x.e), d.entreprises, consoKeys, (x) => x.statut === 'stop');
    let k = 0;
    etatImport.apercu = { mapping, lignes: parsed.map((x) => ({ ...x, etat: x.e.entreprise ? classes[k++].etat : 'invalide' })) };
    import_(root, ctx);
  };
  root.onchange = async (e) => {
    if (e.target.id === 'i-file' && e.target.files[0]) { root.querySelector('#i-texte').value = await e.target.files[0].text(); apercu(); }
    if (e.target.id === 'i-cible') etatImport.cibleId = e.target.value;
  };
  root.onclick = async (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'modele') {
      download('modele-entreprises-consulting.csv', toCSV([{
        entreprise: 'TEST BTP Exemple', dirigeant: 'Prénom TEST', fonction: 'Gérant', taille: '10-20', ville: 'Mulhouse',
        site: 'https://exemple.invalid', mail_pro: 'contact@exemple.invalid', telephone: '0600000000',
        information_vraie: 'A remporté en septembre 2026 le lot gros œuvre de la future médiathèque de Mulhouse',
        url_source_information: 'https://exemple.invalid/article', objet: 'Votre chantier de la médiathèque',
        corps: 'Bonjour Prénom,\n\nJ’ai lu que …',
      }], COLONNES_MODELE));
    }
    if (a === 'apercu') apercu();
    if (a === 'annuler') { etatImport.apercu = null; import_(root, ctx); }
    if (a === 'importer') {
      const lignes = etatImport.apercu.lignes.filter((x) => x.etat === 'nouveau');
      const ents = [];
      const mails = [];
      for (const x of lignes) {
        const id = crypto.randomUUID();
        const est_test = /^test\b/i.test(x.e.entreprise);
        ents.push({ ...x.e, id, cible_id: etatImport.cibleId, statut: 'actif', est_test });
        if (x.mail.objet || x.mail.corps) mails.push({ entreprise_id: id, type: 'premier', statut: 'brouillon', ...x.mail, est_test });
      }
      const ok = await act(async () => {
        await ctx.db.insert(T.entreprises, ents);
        if (mails.length) await ctx.db.insert(T.mails, mails);
        return true;
      }, `${ents.length} entreprise${ents.length > 1 ? 's' : ''} et ${mails.length} mail${mails.length > 1 ? 's' : ''} importés (en brouillon)`);
      if (ok) { etatImport.apercu = null; etatImport.texte = ''; etat.cibleId = etatImport.cibleId; ctx.refresh(); }
    }
  };
}
export { import_ as import };

// ============================================================
// Réseau chaud
// ============================================================
const CHAMPS_RESEAU = (p = {}) => `
  <label>Nom <input name="nom" value="${esc(p.nom ?? '')}" required></label>
  <label>Organisation <input name="organisation" value="${esc(p.organisation ?? '')}"></label>
  <label>Lien avec Solvex <select name="lien_avec_solvex">${options(LIENS, p.lien_avec_solvex, { empty: '—' })}</select></label>
  <label>Ce qu'il peut apporter <input name="ce_quil_peut_apporter" value="${esc(p.ce_quil_peut_apporter ?? '')}"></label>
  <label>Dernier contact <input type="date" name="dernier_contact" value="${esc(p.dernier_contact ?? '')}"></label>
  <label>Prochaine action <input name="prochaine_action" value="${esc(p.prochaine_action ?? '')}"></label>
  <label>Prochaine action le <input type="date" name="prochaine_action_le" value="${esc(p.prochaine_action_le ?? '')}"></label>
  <label>Recommandations obtenues <input type="number" min="0" name="recommandations_obtenues" value="${esc(p.recommandations_obtenues ?? 0)}"></label>
  <label>Note <input name="note" value="${esc(p.note ?? '')}"></label>`;

export async function reseau(root, ctx) {
  const d = ctx.data;
  const today = todayISO();
  const finSemaine = addDays(mondayOf(today), 6);
  const relancer = new Set(aRelancer(d.reseau, finSemaine).map((p) => p.id));
  const rows = d.reseau.filter((p) => !etat.reseauFiltre || relancer.has(p.id))
    .sort((a, b) => String(a.prochaine_action_le || '9999').localeCompare(String(b.prochaine_action_le || '9999')) || a.nom.localeCompare(b.nom));
  const totalRecos = d.reseau.reduce((s, p) => s + (Number(p.recommandations_obtenues) || 0), 0);
  const editId = etat.reseauEdit;

  root.innerHTML = `
    <h1>Réseau chaud / apport d'affaires</h1>
    <div class="card">
      <div class="row">
        <div class="compteurs">
          <span class="compteur">Personnes : ${d.reseau.length}</span>
          <span class="compteur">À relancer cette semaine : ${relancer.size}</span>
          <span class="compteur atteint">Recommandations obtenues : ${totalRecos}</span>
        </div>
        <label class="check right"><input type="checkbox" id="r-filtre" ${etat.reseauFiltre ? 'checked' : ''}> À relancer cette semaine</label>
        <button type="button" class="btn" data-act="export">Exporter en CSV</button>
      </div>
      <p class="muted" style="margin:8px 0 0">Créneau conseillé : vendredi 14h-16h.</p>
    </div>
    ${table(rows, [
      { label: 'Personne', html: (p) => `<strong>${esc(p.nom)}</strong><div class="muted">${esc([p.organisation, label(LIENS, p.lien_avec_solvex)].filter(Boolean).join(' · '))}</div>` },
      { label: 'Peut apporter', html: (p) => esc(p.ce_quil_peut_apporter ?? '') },
      { label: 'Dernier contact', html: (p) => (p.dernier_contact ? frDate(p.dernier_contact) : '—') },
      { label: 'Prochaine action', html: (p) => `${esc(p.prochaine_action ?? '')}${p.prochaine_action_le ? ` <span class="muted">(${frDate(p.prochaine_action_le)})</span>` : ''} ${relancer.has(p.id) ? badge('à relancer', 'orange') : ''}` },
      { label: 'Recos', html: (p) => `<strong>${Number(p.recommandations_obtenues) || 0}</strong>` },
      { label: 'Actions', html: (p) => `<div class="row">
        <button type="button" class="btn small primary" data-contact="${p.id}">Contacté aujourd'hui</button>
        <button type="button" class="btn small" data-reco="${p.id}">+1 reco</button>
        <button type="button" class="btn small" data-edit="${p.id}">Modifier</button></div>` },
    ], { cls: 'cards' })}
    ${editId ? (() => {
      const p = d.reseau.find((x) => x.id === editId);
      return `<h2>Modifier ${esc(p?.nom)}</h2><form class="card grid-3" data-reseau="${editId}">${CHAMPS_RESEAU(p)}
        <div class="row"><button type="submit" class="btn primary">Enregistrer</button><button type="button" class="btn" data-act="fermer">Fermer</button>
        <button type="button" class="btn danger" data-supprreseau="${editId}">Supprimer</button></div></form>`;
    })() : ''}
    <h2>Ajouter une personne</h2>
    <form class="card grid-3" data-reseau="">${CHAMPS_RESEAU()}<div class="row"><button type="submit" class="btn primary">Ajouter</button></div></form>
  `;
  const rerender = () => reseau(root, ctx);
  const maj = async (id, patch, msg) => {
    const p = d.reseau.find((x) => x.id === id);
    const ok = await act(async () => Object.assign(p, await ctx.db.update(T.reseau, id, patch)), msg);
    if (ok) rerender();
  };
  root.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.contact) maj(t.dataset.contact, { dernier_contact: today }, 'Dernier contact : aujourd’hui');
    if (t.dataset.reco) {
      const p = d.reseau.find((x) => x.id === t.dataset.reco);
      maj(p.id, { recommandations_obtenues: (Number(p.recommandations_obtenues) || 0) + 1 }, 'Recommandation ajoutée');
    }
    if (t.dataset.edit) { etat.reseauEdit = t.dataset.edit; rerender(); }
    if (t.dataset.act === 'fermer') { etat.reseauEdit = null; rerender(); }
    if (t.dataset.supprreseau && confirm('Supprimer cette personne (et ses rendez-vous rattachés) ?')) {
      await act(() => ctx.db.remove(T.reseau, t.dataset.supprreseau), 'Personne supprimée');
      etat.reseauEdit = null;
      ctx.refresh();
    }
    if (t.dataset.act === 'export') {
      exportCSV('reseau-chaud', rows.map((p) => ({ ...p, lien_avec_solvex: label(LIENS, p.lien_avec_solvex) })),
        ['nom', 'organisation', 'lien_avec_solvex', 'ce_quil_peut_apporter', 'dernier_contact', 'prochaine_action', 'prochaine_action_le', 'recommandations_obtenues', 'note']);
    }
  };
  root.onchange = (e) => { if (e.target.id === 'r-filtre') { etat.reseauFiltre = e.target.checked; rerender(); } };
  root.onsubmit = async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    f.recommandations_obtenues = Number(f.recommandations_obtenues || 0);
    const id = e.target.dataset.reseau;
    if (!id) f.est_test = /^test\b/i.test(f.nom);
    const ok = await act(() => (id ? ctx.db.update(T.reseau, id, f) : ctx.db.insert(T.reseau, f)), id ? 'Personne enregistrée' : 'Personne ajoutée');
    if (ok) { etat.reseauEdit = null; ctx.refresh(); }
  };
}

// ============================================================
// Rendez-vous
// ============================================================
export async function rdv(root, ctx) {
  const d = ctx.data;
  const ents = new Map(d.entreprises.map((e) => [e.id, e]));
  const pers = new Map(d.reseau.map((p) => [p.id, p]));
  const cibles = new Map(d.cibles.map((c) => [c.id, c]));
  const nomLien = (r) => (r.entreprise_id ? ents.get(r.entreprise_id)?.entreprise : `${pers.get(r.reseau_id)?.nom || '?'} (réseau)`);
  const origine = (r) => {
    if (r.reseau_id) return 'Réseau chaud';
    const e = ents.get(r.entreprise_id);
    return e?.source === 'sourcing' ? `Direct · ${cibles.get(e.cible_id)?.nom || ''}` : `${label(SOURCES, e?.source)} · ${cibles.get(e?.cible_id)?.nom || ''}`;
  };
  const rows = [...d.rdv].sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));

  root.innerHTML = `
    <h1>Rendez-vous — consulting</h1>
    <div class="card row"><span class="muted">${rows.length} rendez-vous · montant potentiel total ${euro(rows.reduce((s, r) => s + (Number(r.montant_potentiel_eur) || 0), 0))}</span>
      <button type="button" class="btn right" data-act="export">Exporter en CSV</button></div>
    ${table(rows, [
      { label: 'Date', html: (r) => `<input type="datetime-local" data-champ="date" data-id="${r.id}" value="${r.date ? toLocalInput(r.date) : ''}" aria-label="Date">` },
      { label: 'Avec', html: (r) => `<strong>${r.entreprise_id ? `<a href="#/conso/entreprise/${r.entreprise_id}">${esc(nomLien(r))}</a>` : esc(nomLien(r))}</strong><div class="muted">${esc(origine(r))}</div>` },
      { label: 'Type', html: (r) => `<select data-champ="type" data-id="${r.id}" aria-label="Type">${options(TYPES_RDV, r.type)}</select>` },
      { label: 'Statut', html: (r) => `<select data-champ="statut" data-id="${r.id}" aria-label="Statut">${options(STATUTS_RDV, r.statut)}</select>` },
      { label: 'Montant potentiel (€)', html: (r) => `<input type="number" min="0" step="100" data-champ="montant_potentiel_eur" data-id="${r.id}" value="${esc(r.montant_potentiel_eur ?? '')}" aria-label="Montant potentiel">` },
      { label: 'Résultat', html: (r) => `<input data-champ="resultat" data-id="${r.id}" value="${esc(r.resultat ?? '')}" aria-label="Résultat">` },
      { label: 'Prochaine étape', html: (r) => `<input data-champ="prochaine_etape" data-id="${r.id}" value="${esc(r.prochaine_etape ?? '')}" aria-label="Prochaine étape">` },
      { label: '', html: (r) => `<button type="button" class="btn small danger" data-suppr="${r.id}">Supprimer</button>` },
    ], { cls: 'cards' })}
    <h2>Ajouter un rendez-vous</h2>
    <form class="card grid-3" id="f-rdv">
      <label>Avec <select name="lien" required>${options([
        ...[...d.entreprises].sort((a, b) => a.entreprise.localeCompare(b.entreprise)).map((e) => ({ code: `e:${e.id}`, label: `${e.entreprise} — ${cibles.get(e.cible_id)?.nom || ''}` })),
        ...d.reseau.map((p) => ({ code: `r:${p.id}`, label: `${p.nom} (réseau chaud)` })),
      ], '', { empty: 'Choisir une entreprise ou une personne du réseau' })}</select></label>
      <label>Date <input type="datetime-local" name="date"></label>
      <label>Type <select name="type">${options(TYPES_RDV, 'decouverte')}</select></label>
      <label>Statut <select name="statut">${options(STATUTS_RDV, 'a_faire')}</select></label>
      <label>Montant potentiel (€) <input type="number" min="0" step="100" name="montant_potentiel_eur"></label>
      <label>Prochaine étape <input name="prochaine_etape"></label>
      <label>Résultat <input name="resultat"></label>
      <label>Note <input name="note"></label>
      <div class="row"><button type="submit" class="btn primary">Ajouter</button></div>
    </form>
  `;
  root.onchange = async (e) => {
    const { champ, id } = e.target.dataset;
    if (!champ) return;
    let v = e.target.value.trim() === '' ? null : e.target.value;
    if (champ === 'date') v = fromLocalInput(v);
    if (champ === 'montant_potentiel_eur' && v !== null) v = Number(v);
    const r = d.rdv.find((x) => x.id === id);
    await act(async () => Object.assign(r, await ctx.db.update(T.rdv, id, { [champ]: v })), 'Rendez-vous mis à jour');
  };
  root.onsubmit = async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const [kind, ref] = String(f.lien || '').split(':');
    if (!ref) { toast('Choisis avec qui est le rendez-vous.', 'erreur'); return; }
    const lie = kind === 'e' ? ents.get(ref) : pers.get(ref);
    const row = {
      entreprise_id: kind === 'e' ? ref : null, reseau_id: kind === 'r' ? ref : null,
      date: fromLocalInput(f.date), type: f.type, statut: f.statut,
      montant_potentiel_eur: f.montant_potentiel_eur === null ? null : Number(f.montant_potentiel_eur),
      prochaine_etape: f.prochaine_etape, resultat: f.resultat, note: f.note, est_test: !!lie?.est_test,
    };
    const ok = await act(() => ctx.db.insert(T.rdv, row), 'Rendez-vous ajouté');
    if (ok) ctx.refresh();
  };
  root.onclick = async (e) => {
    if (e.target.dataset.suppr && confirm('Supprimer ce rendez-vous ?')) {
      await act(() => ctx.db.remove(T.rdv, e.target.dataset.suppr), 'Rendez-vous supprimé');
      ctx.refresh();
    }
    if (e.target.closest('[data-act="export"]')) {
      exportCSV('rdv-consulting', rows.map((r) => ({
        date: r.date ? frDateTime(r.date) : '', avec: nomLien(r), origine: origine(r), type: label(TYPES_RDV, r.type),
        statut: label(STATUTS_RDV, r.statut), montant_potentiel_eur: r.montant_potentiel_eur, resultat: r.resultat,
        prochaine_etape: r.prochaine_etape, note: r.note,
      })));
    }
  };
}

// ============================================================
// Tableau de bord
// ============================================================
function indicateursCible(s) {
  return [
    ['Mails envoyés (entreprises contactées)', String(s.envoyes)],
    ['Relances envoyées', String(s.relances)],
    ['Réponses', String(s.reponses)],
    ['Réponses positives', String(s.positives)],
    ['Rendez-vous', String(s.rdv)],
    ['Refus (dont stop)', String(s.refus)],
    ['Bounces', String(s.bounces)],
    ['Taux de réponse (réponses / envoyés)', rate(s.taux.reponse)],
    ['Taux de réponse positive (positives / envoyés)', rate(s.taux.positive)],
    ['Taux de rendez-vous (RDV / envoyés) ★ indicateur principal', rate(s.taux.rdv)],
    ['Délai moyen de réponse', s.delaiMoyenJours === null ? '—' : `${num(s.delaiMoyenJours)} jour(s)`],
    ['Heures de travail saisies', s.heures ? `${num(s.heures)} h` : '—'],
    ['Rendez-vous par heure de travail', s.rdvParHeure === null ? '—' : num(s.rdvParHeure, 2)],
    ['Panier potentiel moyen', euro(s.panierMoyen)],
  ];
}
function indicateursReseau(s) {
  return [
    ['Personnes dans le réseau', String(s.contacts)],
    ['Contacts sollicités', String(s.sollicites)],
    ['Recommandations obtenues', String(s.recommandations)],
    ['Rendez-vous issus du réseau', String(s.rdv)],
    ['Rendez-vous par contact sollicité', s.rdvParSollicite === null ? '—' : num(s.rdvParSollicite, 2)],
    ['Rendez-vous par recommandation', s.rdvParRecommandation === null ? '—' : num(s.rdvParRecommandation, 2)],
    ['Heures de travail saisies', s.heures ? `${num(s.heures)} h` : '—'],
    ['Rendez-vous par heure de travail', s.rdvParHeure === null ? '—' : num(s.rdvParHeure, 2)],
    ['Panier potentiel moyen', euro(s.panierMoyen)],
  ];
}

const statsDeCible = (d, c) => {
  const ents = d.entreprises.filter((e) => e.cible_id === c.id);
  return statsCible(ents, d.mails, d.rdv, c.heures_travail);
};
const statsDuReseau = (d) => statsReseau(d.reseau, d.rdv, d.entreprises, parametre(d, 'heures_reseau'));

export async function dashboard(root, ctx) {
  const d = ctx.data;
  const cibles = ciblesTriees(d);
  const onglets = [...cibles.map((c) => ({ id: c.id, label: `${c.semaine} · ${c.nom}` })), { id: 'reseau', label: 'Réseau chaud' }];
  if (!etat.dashTab || !onglets.some((o) => o.id === etat.dashTab)) etat.dashTab = cibleCourante(d)?.id || onglets[0].id;
  const c = cibles.find((x) => x.id === etat.dashTab);
  const s = c ? statsDeCible(d, c) : statsDuReseau(d);
  const lignes = c ? indicateursCible(s) : indicateursReseau(s);

  root.innerHTML = `
    <h1>Tableau de bord — consulting</h1>
    ${tabs(onglets, etat.dashTab)}
    <div class="card row">
      <div class="grow"><strong>${esc(c ? c.description || c.nom : 'Réseau chaud / apport d’affaires')}</strong>
        <div class="muted">${c ? `${s.entreprises} entreprise${s.entreprises > 1 ? 's' : ''} dans la cible` : 'Suivi continu (vendredi 14h-16h)'}</div></div>
      <label>Heures de travail ${c ? 'sur cette cible' : 'sur le réseau'} <input type="number" min="0" step="0.5" id="d-heures" value="${esc(c ? c.heures_travail ?? 0 : parametre(d, 'heures_reseau') ?? 0)}" style="max-width:120px"></label>
      <button type="button" class="btn" data-act="export">Exporter en CSV</button>
    </div>
    ${c && s.echantillonTropPetit ? warn(`Échantillon trop petit pour conclure : ${s.envoyes} mail${s.envoyes > 1 ? 's' : ''} envoyé${s.envoyes > 1 ? 's' : ''} (minimum ${SEUIL_ECHANTILLON_CONSO}).`) : ''}
    ${c ? kpis([
      ['Mails envoyés', String(s.envoyes)], ['Relances', String(s.relances)], ['Réponses', String(s.reponses)],
      ['Réponses positives', String(s.positives)], ['Rendez-vous', String(s.rdv)], ['Refus', String(s.refus)], ['Bounces', String(s.bounces)],
    ]) : kpis([
      ['Contacts sollicités', String(s.sollicites)], ['Recommandations', String(s.recommandations)], ['RDV issus du réseau', String(s.rdv)],
    ])}
    <div class="card">
      ${table(lignes, [{ label: 'Indicateur', html: (r) => esc(r[0]) }, { label: 'Valeur', html: (r) => `<strong>${esc(r[1])}</strong>` }], { cls: 'compare' })}
    </div>
    <p class="muted">Une entreprise = un envoi : une réponse obtenue sur le premier mail ou sur la relance compte une seule fois.</p>
  `;
  root.onclick = (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { etat.dashTab = t.dataset.tab; dashboard(root, ctx); return; }
    if (e.target.closest('[data-act="export"]')) {
      exportCSV(`tableau-de-bord-${c ? `${c.semaine}-${c.nom}` : 'reseau-chaud'}`, lignes.map(([k, v]) => ({ indicateur: k, valeur: v })), ['indicateur', 'valeur']);
    }
  };
  root.onchange = async (e) => {
    if (e.target.id !== 'd-heures') return;
    const h = Number(String(e.target.value).replace(',', '.')) || 0;
    const ok = c
      ? await act(async () => Object.assign(c, await ctx.db.update(T.cibles, c.id, { heures_travail: h })), 'Heures enregistrées')
      : await act(() => ctx.db.upsert(T.parametres, { cle: 'heures_reseau', valeur: String(h) }), 'Heures enregistrées');
    if (ok) ctx.refresh();
  };
}

// ============================================================
// Comparaison finale
// ============================================================
function comparaisonData(d) {
  const cibles = ciblesTriees(d);
  const parCible = cibles.map((c) => ({ c, s: statsDeCible(d, c) }));
  const heuresDirect = cibles.reduce((t, c) => t + (Number(c.heures_travail) || 0), 0);
  const direct = statsCible(d.entreprises.filter((e) => e.source === 'sourcing'), d.mails, d.rdv, heuresDirect);
  const res = statsDuReseau(d);
  return { parCible, direct, res };
}

function comparaisonHTML({ parCible, direct, res }) {
  const petits = parCible.filter((x) => x.s.echantillonTropPetit);
  const rows = indicateursCible(statsCible([], [], [])).map(([k], i) => ({ k, v: parCible.map((x) => indicateursCible(x.s)[i][1]) }));
  const ratioVal = (t) => (t.d ? t.n / t.d : null);
  // ratio et non pourcentage : côté réseau, un RDV peut venir d'une recommandation non sollicitée
  const parContact = (n, d) => (d ? `${num(n / d, 2)} (${n}/${d})` : `— (${n}/0)`);
  const dvr = [
    ['Contacts', `${direct.envoyes} entreprise${direct.envoyes > 1 ? 's' : ''} contactée${direct.envoyes > 1 ? 's' : ''}`, `${res.sollicites} personne${res.sollicites > 1 ? 's' : ''} sollicitée${res.sollicites > 1 ? 's' : ''}`],
    ['Rendez-vous', String(direct.rdv), String(res.rdv)],
    ['Rendez-vous par contact', parContact(direct.rdv, direct.envoyes), parContact(res.rdv, res.sollicites)],
    ['Heures de travail', direct.heures ? `${num(direct.heures)} h` : '—', res.heures ? `${num(res.heures)} h` : '—'],
    ['Rendez-vous par heure de travail', direct.rdvParHeure === null ? '—' : num(direct.rdvParHeure, 2), res.rdvParHeure === null ? '—' : num(res.rdvParHeure, 2)],
    ['Panier potentiel moyen', euro(direct.panierMoyen), euro(res.panierMoyen)],
  ];
  return `
    ${petits.length ? warn(`Échantillon trop petit pour conclure (moins de ${SEUIL_ECHANTILLON_CONSO} mails envoyés) : ${petits.map((x) => `${x.c.semaine} ${x.c.nom} (${x.s.envoyes})`).join(', ')}.`) : ''}
    <h2>Les cibles côte à côte</h2>
    ${table(rows, [{ label: 'Indicateur', html: (r) => esc(r.k) }, ...parCible.map((x, i) => ({ label: `${x.c.semaine} · ${x.c.nom}${x.s.echantillonTropPetit ? ' ⚠' : ''}`, html: (r) => esc(r.v[i]) }))], { cls: 'compare' })}
    ${bars('Taux de rendez-vous sur mails envoyés (indicateur principal)', parCible.map((x) => ({ label: `${x.c.semaine} · ${x.c.nom}`, value: ratioVal(x.s.taux.rdv), text: rate(x.s.taux.rdv) })))}
    ${bars('Taux de réponse', parCible.map((x) => ({ label: `${x.c.semaine} · ${x.c.nom}`, value: ratioVal(x.s.taux.reponse), text: rate(x.s.taux.reponse) })))}
    <h2>Direct (mails) vs réseau chaud</h2>
    ${table(dvr, [{ label: 'Indicateur', html: (r) => esc(r[0]) }, { label: 'Direct (sourcing)', html: (r) => esc(r[1]) }, { label: 'Réseau chaud', html: (r) => esc(r[2]) }], { cls: 'compare' })}
    ${bars('Rendez-vous par contact', [
      { label: 'Direct', value: ratioVal(direct.taux.rdv), text: parContact(direct.rdv, direct.envoyes) },
      { label: 'Réseau chaud', value: res.rdvParSollicite, text: parContact(res.rdv, res.sollicites) },
    ])}
    <p class="muted">⚠ = moins de ${SEUIL_ECHANTILLON_CONSO} mails envoyés : ne pas tirer de conclusion. Une entreprise = un envoi (premier mail) ; les relances sont comptées à part.
      RDV réseau = RDV rattachés à une personne du réseau + RDV d'entreprises venues du réseau ou d'une recommandation.
      « Rendez-vous par contact » est un ratio (et non un pourcentage) : côté réseau, une recommandation peut amener un RDV sans sollicitation directe.</p>
  `;
}

export async function comparaison(root, ctx) {
  const c = comparaisonData(ctx.data);
  root.innerHTML = `
    <h1>Comparaison finale — consulting</h1>
    <div class="card row no-print">
      <span class="muted">Les cibles côte à côte, plus direct vs réseau chaud.</span>
      <button type="button" class="btn right" data-act="csv">Exporter en CSV</button>
      <button type="button" class="btn primary" data-act="bilan">Exporter le bilan</button>
    </div>
    ${comparaisonHTML(c)}
  `;
  root.onclick = (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'csv') {
      const rows = indicateursCible(statsCible([], [], [])).map(([k], i) => Object.fromEntries([
        ['indicateur', k], ...c.parCible.map((x) => [`${x.c.semaine} ${x.c.nom}`, indicateursCible(x.s)[i][1]]),
        ['Direct (toutes cibles)', indicateursCible(c.direct)[i][1]],
      ]));
      exportCSV('comparaison-consulting', rows);
    }
    if (a === 'bilan') {
      const body = `<h1>Bilan — CRM Mesure prospection consulting</h1><p class="meta">Solvex Automation · généré le ${frDateTime(new Date())}</p>${comparaisonHTML(c)}`;
      download(`bilan-consulting-${todayISO()}.html`, bilanHTML('Bilan consulting — Solvex Mesure', body), 'text/html;charset=utf-8');
    }
  };
}

// ============================================================
// Cibles & réglages (+ données de test)
// ============================================================
export async function cibles(root, ctx) {
  const d = ctx.data;
  const list = ciblesTriees(d);
  const nbTest = ['entreprises', 'mails', 'reseau', 'rdv'].reduce((s, k) => s + d[k].filter((x) => x.est_test).length, 0);
  const champs = (c = {}) => `
    <label>Semaine <input name="semaine" value="${esc(c.semaine ?? `S${list.length + 1}`)}" required style="max-width:90px"></label>
    <label>Nom <input name="nom" value="${esc(c.nom ?? '')}" required></label>
    <label class="grow">Description <input name="description" value="${esc(c.description ?? '')}"></label>
    <label>Sourcing <input type="date" name="date_sourcing" value="${esc(c.date_sourcing ?? '')}"></label>
    <label>Envoi 1 <input type="date" name="date_envoi_1" value="${esc(c.date_envoi_1 ?? '')}"></label>
    <label>Envoi 2 <input type="date" name="date_envoi_2" value="${esc(c.date_envoi_2 ?? '')}"></label>`;
  root.innerHTML = `
    <h1>Cibles & réglages — consulting</h1>
    <p class="muted">Un corps de métier par semaine. Décale une date ou ajoute une cible ici, sans toucher au code.</p>
    ${list.map((c) => `<form class="card row" data-cible="${c.id}">${champs(c)}
      <button type="submit" class="btn primary">Enregistrer</button>
      <button type="button" class="btn danger" data-suppr="${c.id}">Supprimer</button></form>`).join('')}
    <h2>Ajouter une cible</h2>
    <form class="card row" data-cible="">${champs()}<button type="submit" class="btn primary">Ajouter</button></form>
    <h2>Données de test</h2>
    <div class="card">
      <p class="muted">Données fictives évidentes (« TEST … », adresses en .invalid) pour essayer l'application, y compris les alertes qualité.</p>
      <div class="row">
        <button type="button" class="btn" data-act="charger">Charger des données de test</button>
        <button type="button" class="btn danger" data-act="vider" ${nbTest ? '' : 'disabled'}>Vider les données de test (${nbTest})</button>
      </div>
    </div>
  `;
  root.onsubmit = async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const id = e.target.dataset.cible;
    const ok = await act(() => (id ? ctx.db.update(T.cibles, id, f) : ctx.db.insert(T.cibles, f)), id ? 'Cible enregistrée' : 'Cible ajoutée');
    if (ok) ctx.refresh();
  };
  root.onclick = async (e) => {
    const id = e.target.dataset.suppr;
    if (id) {
      if (d.entreprises.some((x) => x.cible_id === id)) { toast('Cette cible contient des entreprises : déplace-les ou supprime-les d’abord.', 'erreur'); return; }
      if (confirm('Supprimer cette cible ?')) { await act(() => ctx.db.remove(T.cibles, id), 'Cible supprimée'); ctx.refresh(); }
    }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'charger') { await act(() => chargerTestConso(ctx.db, d), 'Données de test chargées'); ctx.refresh(); }
    if (a === 'vider' && confirm('Supprimer toutes les données de test du CRM consulting ?')) {
      await act(async () => {
        for (const t of [T.rdv, T.mails, T.reseau, T.entreprises]) await ctx.db.removeTest(t);
      }, 'Données de test supprimées');
      ctx.refresh();
    }
  };
}
