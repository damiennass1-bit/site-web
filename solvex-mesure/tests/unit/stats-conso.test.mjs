import test from 'node:test';
import assert from 'node:assert/strict';
import { statsCible, statsReseau, aRelancer } from '../../src/js/lib/stats-conso.js';
import { pct } from '../../src/js/lib/format.js';

// 6 entreprises fictives d'une même cible, calculées à la main :
//  e1 : premier envoyé, réponse positive 2 jours après          → réponse, positive
//  e2 : premier envoyé + relance envoyée, RDV sur la relance 4 j → réponse, positive, RDV (+ rdv 9000 €)
//  e3 : premier envoyé, refus 1 jour après                       → réponse, refus
//  e4 : premier envoyé, bounce                                   → envoyé, bounce
//  e5 : premier envoyé, sans réponse + relance envoyée            → envoyé
//  e6 : brouillon jamais envoyé                                   → non compté
const ents = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].map((id) => ({ id, cible_id: 'c1', source: 'sourcing' }));
const J = (d) => `2026-10-${String(d).padStart(2, '0')}T09:00:00Z`;
const mails = [
  { entreprise_id: 'e1', type: 'premier', statut: 'repondu_positif', envoye_le: J(26), reponse_le: J(28) },
  { entreprise_id: 'e2', type: 'premier', statut: 'envoye', envoye_le: J(26) },
  { entreprise_id: 'e2', type: 'relance', statut: 'rendez_vous', envoye_le: J(28), reponse_le: J(30) },
  { entreprise_id: 'e3', type: 'premier', statut: 'refus', envoye_le: J(26), reponse_le: J(27) },
  { entreprise_id: 'e4', type: 'premier', statut: 'bounce', envoye_le: J(26) },
  { entreprise_id: 'e5', type: 'premier', statut: 'envoye', envoye_le: J(26) },
  { entreprise_id: 'e5', type: 'relance', statut: 'envoye', envoye_le: J(28) },
  { entreprise_id: 'e6', type: 'premier', statut: 'brouillon' },
];
const rdvs = [{ entreprise_id: 'e2', montant_potentiel_eur: 9000 }];

test('compteurs consulting', () => {
  const s = statsCible(ents, mails, rdvs, 4);
  assert.equal(s.envoyes, 5);
  assert.equal(s.relances, 2);
  assert.equal(s.reponses, 3);
  assert.equal(s.positives, 2);
  assert.equal(s.rdv, 1);
  assert.equal(s.refus, 1);
  assert.equal(s.bounces, 1);
});

test('taux consulting (formules du cahier des charges)', () => {
  const s = statsCible(ents, mails, rdvs, 4);
  assert.equal(pct(s.taux.reponse.n, s.taux.reponse.d), '60 % (3/5)');
  assert.equal(pct(s.taux.positive.n, s.taux.positive.d), '40 % (2/5)');
  assert.equal(pct(s.taux.rdv.n, s.taux.rdv.d), '20 % (1/5)');
  // délais : e1 2 j, e2 4 j (depuis le premier envoi), e3 1 j → 7/3
  assert.ok(Math.abs(s.delaiMoyenJours - 7 / 3) < 1e-9);
  assert.equal(s.rdvParHeure, 0.25); // 1 RDV / 4 h
  assert.equal(s.panierMoyen, 9000);
  assert.equal(s.echantillonTropPetit, true); // < 20 envoyés
});

test('sans heures saisies, rendez-vous par heure non calculé', () => {
  assert.equal(statsCible(ents, mails, rdvs, 0).rdvParHeure, null);
});

test('un RDV sans mail envoyé ne gonfle pas le taux', () => {
  const s = statsCible([{ id: 'x' }], [], [{ entreprise_id: 'x' }]);
  assert.equal(s.envoyes, 0);
  assert.equal(s.rdv, 0);
});

test('réseau chaud : sollicités, recommandations, RDV par recommandation', () => {
  const reseau = [
    { id: 'r1', dernier_contact: '2026-10-30', recommandations_obtenues: 2, prochaine_action_le: '2026-11-01' },
    { id: 'r2', dernier_contact: '2026-10-23', recommandations_obtenues: 1, prochaine_action_le: '2026-11-10' },
    { id: 'r3', dernier_contact: null, recommandations_obtenues: 0 },
  ];
  const entreprises = [{ id: 'eR', source: 'recommandation' }, { id: 'eS', source: 'sourcing' }];
  const r = [
    { reseau_id: 'r1', montant_potentiel_eur: 8000 },
    { entreprise_id: 'eR', montant_potentiel_eur: 10000 },
    { entreprise_id: 'eS', montant_potentiel_eur: 5000 }, // direct : ignoré ici
  ];
  const s = statsReseau(reseau, r, entreprises, 2);
  assert.equal(s.sollicites, 2);
  assert.equal(s.recommandations, 3);
  assert.equal(s.rdv, 2);
  assert.ok(Math.abs(s.rdvParRecommandation - 2 / 3) < 1e-9);
  assert.equal(s.rdvParHeure, 1);
  assert.equal(s.panierMoyen, 9000);
  assert.equal(pct(s.taux.rdvParSollicite.n, s.taux.rdvParSollicite.d), '100 % (2/2)');
  assert.deepEqual(aRelancer(reseau, '2026-11-01').map((p) => p.id), ['r1']);
});
