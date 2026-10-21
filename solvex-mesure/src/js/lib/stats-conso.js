// Indicateurs du CRM consulting. Toutes les fonctions sont pures (testées dans tests/unit).
//
// Unité de mesure : l'entreprise contactée. « Mails envoyés » = premiers mails envoyés
// (une entreprise = un envoi) ; les relances sont comptées à part. Une réponse obtenue
// sur le premier mail ou sur une relance compte une fois pour l'entreprise.

import { daysBetween } from './dates.js';

export const STATUTS_MAIL = [
  { code: 'brouillon', label: 'Brouillon' },
  { code: 'valide', label: 'Validé' },
  { code: 'envoye', label: 'Envoyé' },
  { code: 'repondu_positif', label: 'Réponse positive' },
  { code: 'repondu_neutre', label: 'Réponse neutre' },
  { code: 'refus', label: 'Refus' },
  { code: 'rendez_vous', label: 'Rendez-vous' },
  { code: 'stop', label: 'Stop' },
  { code: 'bounce', label: 'Bounce' },
];

export const SEUIL_ECHANTILLON_CONSO = 20;

export const ENVOYES = new Set(['envoye', 'repondu_positif', 'repondu_neutre', 'refus', 'rendez_vous', 'stop', 'bounce']);
export const REPONSES = new Set(['repondu_positif', 'repondu_neutre', 'refus', 'rendez_vous', 'stop']);
export const POSITIVES = new Set(['repondu_positif', 'rendez_vous']);

export const estEnvoye = (m) => ENVOYES.has(m.statut) || !!m.envoye_le;

// Agrège mails + rendez-vous par entreprise
export function parEntreprise(entreprises, mails, rdvs) {
  const mailsPar = new Map();
  for (const m of mails) {
    const l = mailsPar.get(m.entreprise_id) || [];
    l.push(m);
    mailsPar.set(m.entreprise_id, l);
  }
  const rdvPar = new Map();
  for (const r of rdvs) if (r.entreprise_id) {
    const l = rdvPar.get(r.entreprise_id) || [];
    l.push(r);
    rdvPar.set(r.entreprise_id, l);
  }
  return entreprises.map((e) => {
    const ms = (mailsPar.get(e.id) || []).slice().sort((a, b) => String(a.envoye_le || a.created_at || '').localeCompare(String(b.envoye_le || b.created_at || '')));
    const rs = rdvPar.get(e.id) || [];
    const premiers = ms.filter((m) => m.type !== 'relance' && estEnvoye(m));
    const relances = ms.filter((m) => m.type === 'relance' && estEnvoye(m));
    const contacte = premiers.length > 0 || relances.length > 0;
    const repondus = ms.filter((m) => REPONSES.has(m.statut));
    const premierEnvoi = [...premiers, ...relances].map((m) => m.envoye_le).filter(Boolean).sort()[0] || null;
    const premiereReponse = repondus.map((m) => m.reponse_le).filter(Boolean).sort()[0] || null;
    return {
      entreprise: e,
      contacte,
      relances: relances.length,
      repondu: repondus.length > 0,
      positif: ms.some((m) => POSITIVES.has(m.statut)) || rs.length > 0,
      rdv: ms.some((m) => m.statut === 'rendez_vous') || rs.length > 0,
      refus: ms.some((m) => m.statut === 'refus' || m.statut === 'stop'),
      bounce: ms.some((m) => m.statut === 'bounce'),
      delaiJours: premierEnvoi && premiereReponse ? daysBetween(premierEnvoi, premiereReponse) : null,
      montants: rs.map((r) => Number(r.montant_potentiel_eur)).filter((v) => Number.isFinite(v) && v > 0),
    };
  });
}

// Indicateurs d'un ensemble d'entreprises (une cible, ou tout le « direct »)
export function statsCible(entreprises, mails, rdvs, heures = 0) {
  // seules les entreprises réellement contactées par mail comptent (numérateurs ⊂ dénominateur)
  const agg = parEntreprise(entreprises, mails, rdvs).filter((a) => a.contacte);
  const envoyes = agg.length;
  const reponses = agg.filter((a) => a.repondu).length;
  const positives = agg.filter((a) => a.positif).length;
  const rdv = agg.filter((a) => a.rdv).length;
  const delais = agg.map((a) => a.delaiJours).filter((v) => v !== null && v >= 0);
  const montants = agg.flatMap((a) => a.montants);
  return {
    entreprises: entreprises.length,
    envoyes,
    relances: agg.reduce((s, a) => s + a.relances, 0),
    reponses,
    positives,
    rdv,
    refus: agg.filter((a) => a.refus).length,
    bounces: agg.filter((a) => a.bounce).length,
    taux: {
      reponse: { n: reponses, d: envoyes },
      positive: { n: positives, d: envoyes },
      rdv: { n: rdv, d: envoyes },
    },
    delaiMoyenJours: delais.length ? delais.reduce((s, v) => s + v, 0) / delais.length : null,
    heures: Number(heures) || 0,
    rdvParHeure: Number(heures) > 0 ? rdv / Number(heures) : null,
    panierMoyen: montants.length ? montants.reduce((s, v) => s + v, 0) / montants.length : null,
    echantillonTropPetit: envoyes < SEUIL_ECHANTILLON_CONSO,
  };
}

// Réseau chaud : contacts sollicités = personnes avec au moins un « dernier contact » renseigné.
// RDV issus du réseau = RDV rattachés à une personne du réseau + RDV d'entreprises venues
// du réseau ou d'une recommandation.
export function statsReseau(reseau, rdvs, entreprises, heures = 0) {
  const entReseau = new Set(entreprises.filter((e) => e.source === 'reseau' || e.source === 'recommandation').map((e) => e.id));
  const rdvReseau = rdvs.filter((r) => r.reseau_id || (r.entreprise_id && entReseau.has(r.entreprise_id)));
  const sollicites = reseau.filter((p) => p.dernier_contact).length;
  const recommandations = reseau.reduce((s, p) => s + (Number(p.recommandations_obtenues) || 0), 0);
  const montants = rdvReseau.map((r) => Number(r.montant_potentiel_eur)).filter((v) => Number.isFinite(v) && v > 0);
  return {
    contacts: reseau.length,
    sollicites,
    recommandations,
    rdv: rdvReseau.length,
    // pas un pourcentage : un RDV peut venir d'une recommandation sans que la personne ait été sollicitée
    rdvParSollicite: sollicites ? rdvReseau.length / sollicites : null,
    rdvParRecommandation: recommandations ? rdvReseau.length / recommandations : null,
    heures: Number(heures) || 0,
    rdvParHeure: Number(heures) > 0 ? rdvReseau.length / Number(heures) : null,
    panierMoyen: montants.length ? montants.reduce((s, v) => s + v, 0) / montants.length : null,
  };
}

// Personnes du réseau à relancer d'ici la fin de la semaine (dimanche inclus)
export function aRelancer(reseau, finSemaine) {
  return reseau.filter((p) => p.prochaine_action_le && p.prochaine_action_le <= finSemaine);
}
