// Indicateurs du CRM agent vocal. Toutes les fonctions sont pures (testées dans tests/unit).

import { parisHour, parisWeekday } from './dates.js';

export const RESULTATS = [
  { code: 'pas_de_reponse', label: 'Pas de réponse', touche: '1' },
  { code: 'repondeur', label: 'Répondeur', touche: '2' },
  { code: 'joint_pas_decideur', label: 'Joint, pas le décideur', touche: '3' },
  { code: 'joint_decideur', label: 'Joint le décideur', touche: '4' },
  { code: 'refus', label: 'Refus', touche: '5' },
  { code: 'rappeler', label: 'À rappeler', touche: '6' },
  { code: 'demo_rdv', label: 'Démo / RDV', touche: '7' },
  { code: 'faux_numero', label: 'Faux numéro', touche: '8' },
  { code: 'ne_pas_rappeler', label: 'Ne pas rappeler', touche: '9' },
];

export const MOTIFS_REFUS = [
  { code: 'pas_interesse', label: 'Pas intéressé' },
  { code: 'deja_equipe', label: 'Déjà équipé / secrétariat' },
  { code: 'trop_cher', label: 'Trop cher' },
  { code: 'pas_le_temps', label: 'Pas le temps' },
  { code: 'mefiance_ia', label: "Méfiance envers l'IA" },
  { code: 'pas_assez_appels', label: "Pas assez d'appels" },
  { code: 'autre', label: 'Autre' },
];

export const SEUIL_ECHANTILLON_VOCAL = 60;

const NON_JOINT = new Set(['pas_de_reponse', 'repondeur', 'faux_numero']);

// « joint » = une vraie personne a décroché
export const estJoint = (a) => !NON_JOINT.has(a.resultat);
export const estDecideur = (a) => estJoint(a) && (a.decideur_joint || a.resultat === 'joint_decideur');
export const estConversation = (a) => estJoint(a) && !!a.conversation_plus_1min;
export const estDemo = (a) => estJoint(a) && (a.demo_ou_rdv || a.resultat === 'demo_rdv');
export const estRefus = (a) => a.resultat === 'refus' || a.resultat === 'ne_pas_rappeler';

// Compteurs + taux (chaque taux = { n, d }, la mise en forme est faite ailleurs)
export function statsAppels(appels) {
  const c = {
    appels: appels.length,
    joints: appels.filter(estJoint).length,
    decideurs: appels.filter(estDecideur).length,
    conversations: appels.filter(estConversation).length,
    demos: appels.filter(estDemo).length,
    refus: appels.filter(estRefus).length,
    sms: appels.filter((a) => a.sms_envoye).length,
  };
  return {
    ...c,
    taux: {
      decrochage: { n: c.joints, d: c.appels },
      decideur: { n: c.decideurs, d: c.joints },
      conversation: { n: c.conversations, d: c.joints },
      demoSurJoints: { n: c.demos, d: c.joints },
      demoSurAppels: { n: c.demos, d: c.appels },
      refus: { n: c.refus, d: c.joints },
    },
    appelsParRdv: c.demos ? c.appels / c.demos : null,
    echantillonTropPetit: c.appels < SEUIL_ECHANTILLON_VOCAL,
  };
}

// Regroupe les appels par clé et calcule appels / joints / démos pour chaque groupe
function groupBy(appels, keyFn) {
  const m = new Map();
  for (const a of appels) {
    const k = keyFn(a);
    const g = m.get(k) || { cle: k, appels: 0, joints: 0, demos: 0 };
    g.appels += 1;
    if (estJoint(a)) g.joints += 1;
    if (estDemo(a)) g.demos += 1;
    m.set(k, g);
  }
  return [...m.values()].sort((x, y) => x.cle - y.cle);
}

export const parHeure = (appels) => groupBy(appels, (a) => parisHour(a.date_heure));
export const parJour = (appels) => groupBy(appels, (a) => parisWeekday(a.date_heure));

// Meilleur groupe : plus fort taux de démo/RDV, puis plus fort taux de décrochage,
// parmi les groupes d'au moins `min` appels (tous les groupes si aucun ne l'atteint)
export function meilleur(groupes, min = 5) {
  if (!groupes.length) return null;
  const eligibles = groupes.filter((g) => g.appels >= min);
  const pool = eligibles.length ? eligibles : groupes;
  return [...pool].sort((x, y) =>
    (y.demos / y.appels) - (x.demos / x.appels) ||
    (y.joints / y.appels) - (x.joints / x.appels) ||
    y.appels - x.appels)[0];
}

export function motifsRefus(appels) {
  const m = new Map();
  for (const a of appels.filter(estRefus)) {
    const k = a.motif_refus || 'non_renseigne';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([motif, n]) => ({ motif, n })).sort((x, y) => y.n - x.n);
}

// Appels d'une phase (via le lead), éventuellement filtrés par source de lead
export function appelsDePhase(appels, leads, phaseId, source = null) {
  const ids = new Set(leads.filter((l) => l.phase_id === phaseId && (!source || l.source === source)).map((l) => l.id));
  return appels.filter((a) => ids.has(a.lead_id));
}

export function appelsDeSource(appels, leads, source) {
  const ids = new Set(leads.filter((l) => l.source === source).map((l) => l.id));
  return appels.filter((a) => ids.has(a.lead_id));
}

// Nouveau statut du lead après un appel
export function statutApresAppel(resultat) {
  switch (resultat) {
    case 'ne_pas_rappeler': return 'ne_pas_rappeler';
    case 'faux_numero': return 'a_retirer';
    case 'refus':
    case 'demo_rdv': return 'termine';
    default: return 'en_cours';
  }
}

// File d'appel : rappels dus d'abord, puis jamais appelés, puis les autres (dernier appel le plus ancien d'abord)
export function fileAppel(leads, appels, today) {
  const parLead = new Map();
  for (const a of appels) {
    const list = parLead.get(a.lead_id) || [];
    list.push(a);
    parLead.set(a.lead_id, list);
  }
  const actifs = leads.filter((l) => l.statut === 'a_appeler' || l.statut === 'en_cours');
  const items = actifs.map((l) => {
    const hist = (parLead.get(l.id) || []).sort((x, y) => (x.date_heure < y.date_heure ? -1 : 1));
    const dernier = hist[hist.length - 1] || null;
    const rappel = dernier?.rappel_le || null;
    let rang = 2;
    if (rappel && rappel <= today) rang = 0;
    else if (!hist.length) rang = 1;
    else if (rappel) rang = 3; // rappel prévu plus tard : en fin de file

    return { lead: l, appels: hist, dernier, rappel, rang };
  });
  return items.sort((x, y) =>
    x.rang - y.rang ||
    (x.rang === 0 ? (x.rappel < y.rappel ? -1 : x.rappel > y.rappel ? 1 : 0) : 0) ||
    (x.dernier?.date_heure || '').localeCompare(y.dernier?.date_heure || '') ||
    String(x.lead.created_at || '').localeCompare(String(y.lead.created_at || '')));
}
