import test from 'node:test';
import assert from 'node:assert/strict';
import {
  statsAppels, parHeure, parJour, meilleur, motifsRefus, appelsDePhase, fileAppel, statutApresAppel,
} from '../../src/js/lib/stats-vocal.js';
import { pct } from '../../src/js/lib/format.js';

// Jeu fictif de 20 appels, calculé à la main :
//  6 pas_de_reponse, 4 repondeur, 1 faux_numero          → 11 non joints
//  2 joint_pas_decideur, 3 joint_decideur, 2 refus,
//  1 ne_pas_rappeler, 1 rappeler                           → 9 joints (dont 0 démo)
//  + on transforme 2 joint_decideur en démo via la case    → voir plus bas
const base = (resultat, extra = {}) => ({ resultat, date_heure: '2026-10-27T11:30:00Z', ...extra });
const appels = [
  ...Array.from({ length: 6 }, () => base('pas_de_reponse')),
  ...Array.from({ length: 4 }, () => base('repondeur')),
  base('faux_numero'),
  base('joint_pas_decideur', { conversation_plus_1min: true }),
  base('joint_pas_decideur'),
  base('joint_decideur', { decideur_joint: true, conversation_plus_1min: true, demo_ou_rdv: true, sms_envoye: true }),
  base('joint_decideur', { decideur_joint: true, conversation_plus_1min: true }),
  base('demo_rdv', { decideur_joint: true, conversation_plus_1min: true, demo_ou_rdv: true }),
  base('refus', { decideur_joint: true, motif_refus: 'pas_interesse', sms_envoye: true }),
  base('refus', { motif_refus: 'deja_equipe' }),
  base('ne_pas_rappeler', { motif_refus: 'pas_interesse' }),
  base('rappeler', { decideur_joint: true }),
];

test('compteurs agent vocal', () => {
  const s = statsAppels(appels);
  assert.equal(s.appels, 20);
  assert.equal(s.joints, 9); // 20 - 6 - 4 - 1
  assert.equal(s.decideurs, 5); // 2 joint_decideur + demo_rdv(case) + refus(case) + rappeler(case)
  assert.equal(s.conversations, 4);
  assert.equal(s.demos, 2); // joint_decideur avec case démo + demo_rdv
  assert.equal(s.refus, 3); // 2 refus + 1 ne_pas_rappeler
  assert.equal(s.sms, 2);
});

test('taux agent vocal (formules du cahier des charges)', () => {
  const s = statsAppels(appels);
  assert.equal(pct(s.taux.decrochage.n, s.taux.decrochage.d), '45 % (9/20)');
  assert.equal(pct(s.taux.decideur.n, s.taux.decideur.d), '56 % (5/9)');
  assert.equal(pct(s.taux.conversation.n, s.taux.conversation.d), '44 % (4/9)');
  assert.equal(pct(s.taux.demoSurJoints.n, s.taux.demoSurJoints.d), '22 % (2/9)');
  assert.equal(pct(s.taux.demoSurAppels.n, s.taux.demoSurAppels.d), '10 % (2/20)');
  assert.equal(pct(s.taux.refus.n, s.taux.refus.d), '33 % (3/9)');
  assert.equal(s.appelsParRdv, 10); // 20 / 2
  assert.equal(s.echantillonTropPetit, true); // < 60 appels
});

test('exemple du cahier des charges : 22 % (13/60)', () => {
  assert.equal(pct(13, 60), '22 % (13/60)');
  assert.equal(pct(0, 0), '— (0/0)');
});

test('une case démo cochée sur un appel non joint ne compte pas', () => {
  const s = statsAppels([base('repondeur', { demo_ou_rdv: true, decideur_joint: true })]);
  assert.equal(s.demos, 0);
  assert.equal(s.decideurs, 0);
  assert.equal(s.appelsParRdv, null);
});

test('échantillon suffisant à partir de 60 appels', () => {
  const s = statsAppels(Array.from({ length: 60 }, () => base('repondeur')));
  assert.equal(s.echantillonTropPetit, false);
});

test('meilleur créneau horaire et meilleur jour (heure de Paris)', () => {
  // 27/10/2026 (mardi) : Paris = UTC+1. 11:30Z → 12h ; 09:10Z → 10h
  const a = [
    ...Array.from({ length: 5 }, () => base('repondeur', { date_heure: '2026-10-27T09:10:00Z' })),
    ...Array.from({ length: 4 }, () => base('repondeur', { date_heure: '2026-10-29T11:10:00Z' })),
    base('demo_rdv', { date_heure: '2026-10-29T11:40:00Z' }),
  ];
  const h = parHeure(a);
  assert.deepEqual(h.map((g) => [g.cle, g.appels, g.joints, g.demos]), [[10, 5, 0, 0], [12, 5, 1, 1]]);
  assert.equal(meilleur(h).cle, 12);
  const j = parJour(a);
  assert.deepEqual(j.map((g) => [g.cle, g.appels]), [[1, 5], [3, 5]]); // mardi, jeudi
  assert.equal(meilleur(j).cle, 3);
});

test('répartition des motifs de refus', () => {
  assert.deepEqual(motifsRefus(appels), [
    { motif: 'pas_interesse', n: 2 },
    { motif: 'deja_equipe', n: 1 },
  ]);
});

test('appels filtrés par phase et par source de lead', () => {
  const leads = [
    { id: 'l1', phase_id: 'p1', source: 'cold' },
    { id: 'l2', phase_id: 'p1', source: 'artigroup' },
    { id: 'l3', phase_id: 'p2', source: 'cold' },
  ];
  const a = [{ lead_id: 'l1' }, { lead_id: 'l1' }, { lead_id: 'l2' }, { lead_id: 'l3' }];
  assert.equal(appelsDePhase(a, leads, 'p1').length, 3);
  assert.equal(appelsDePhase(a, leads, 'p1', 'cold').length, 2);
  assert.equal(appelsDePhase(a, leads, 'p2', 'artigroup').length, 0);
});

test('file d’appel : rappels dus, puis jamais appelés, puis le reste ; ne_pas_rappeler exclu', () => {
  const leads = [
    { id: 'deja', statut: 'en_cours', created_at: '1' },
    { id: 'neuf', statut: 'a_appeler', created_at: '2' },
    { id: 'rappel', statut: 'en_cours', created_at: '3' },
    { id: 'plus_tard', statut: 'en_cours', created_at: '4' },
    { id: 'npr', statut: 'ne_pas_rappeler', created_at: '5' },
    { id: 'fini', statut: 'termine', created_at: '6' },
  ];
  const a = [
    { lead_id: 'deja', date_heure: '2026-10-26T10:00:00Z', resultat: 'repondeur' },
    { lead_id: 'rappel', date_heure: '2026-10-26T11:00:00Z', resultat: 'rappeler', rappel_le: '2026-10-27' },
    { lead_id: 'plus_tard', date_heure: '2026-10-26T11:00:00Z', resultat: 'rappeler', rappel_le: '2026-11-03' },
  ];
  const order = fileAppel(leads, a, '2026-10-27').map((i) => i.lead.id);
  assert.deepEqual(order, ['rappel', 'neuf', 'deja', 'plus_tard']);
});

test('statut du lead après appel', () => {
  assert.equal(statutApresAppel('ne_pas_rappeler'), 'ne_pas_rappeler');
  assert.equal(statutApresAppel('faux_numero'), 'a_retirer');
  assert.equal(statutApresAppel('demo_rdv'), 'termine');
  assert.equal(statutApresAppel('repondeur'), 'en_cours');
});
