import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, detectDelimiter, mapColumns, toCSV } from '../../src/js/lib/csv.js';
import { classify, vocalKeys, consoKeys, normPhone } from '../../src/js/lib/dedupe.js';
import { similarity, similarPairs, forbiddenIssues, validationErrors } from '../../src/js/lib/quality.js';
import { mondayOf, addDays, currentPeriod } from '../../src/js/lib/dates.js';

test('CSV : séparateur, guillemets, retours ligne', () => {
  const txt = '﻿Entreprise;Téléphone;Note\r\n"TEST ""Plomberie""";06 00 00 00 01;"ligne1\nligne2"\r\nTEST B;0600000002;\r\n';
  assert.equal(detectDelimiter(txt), ';');
  const { headers, rows } = parseCSV(txt);
  assert.deepEqual(headers, ['Entreprise', 'Téléphone', 'Note']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].Entreprise, 'TEST "Plomberie"');
  assert.equal(rows[0].Note, 'ligne1\nligne2');
  assert.equal(detectDelimiter('a,b,c\n1,2,3'), ',');
});

test('CSV : détection automatique des colonnes', () => {
  const m = mapColumns(['Société', 'Tél. mobile', 'Ville'], {
    entreprise: ['societe', 'raison_sociale'], telephone: ['tel_mobile', 'mobile'], commune: ['ville'],
  });
  assert.deepEqual(m, { entreprise: 'Société', telephone: 'Tél. mobile', commune: 'Ville' });
});

test('CSV : export avec point-virgule et échappement', () => {
  const out = toCSV([{ a: 'x;y', b: true }], ['a', 'b']);
  assert.equal(out, '﻿a;b\r\n"x;y";oui\r\n');
});

test('doublons vocal : téléphone ou entreprise + commune, et blocage ne_pas_rappeler', () => {
  assert.equal(normPhone('+33 6 00 00 00 01'), '0600000001');
  const existing = [
    { entreprise: 'TEST Plomberie Dupont', commune: 'Mulhouse', telephone: '0600000001', statut: 'en_cours' },
    { entreprise: 'TEST Serrurerie', commune: 'Colmar', telephone: '0600000009', statut: 'ne_pas_rappeler' },
  ];
  const rows = [
    { entreprise: 'Autre', commune: 'X', telephone: '06.00.00.00.01' }, // même tél
    { entreprise: 'test plomberie dupont', commune: 'MULHOUSE', telephone: '' }, // même entreprise + commune
    { entreprise: 'TEST Serrurerie', commune: 'Colmar', telephone: '' }, // bloqué
    { entreprise: 'TEST Neuf', commune: 'Kingersheim', telephone: '0600000005' },
    { entreprise: 'TEST Neuf bis', commune: 'Kingersheim', telephone: '0600000005' }, // doublon dans le fichier
  ];
  const etats = classify(rows, existing, vocalKeys, (l) => l.statut === 'ne_pas_rappeler').map((c) => c.etat);
  assert.deepEqual(etats, ['doublon', 'doublon', 'bloque', 'nouveau', 'doublon_fichier']);
});

test('doublons consulting : mail pro ou entreprise + ville, et blocage stop', () => {
  const existing = [{ entreprise: 'TEST Cabinet', ville: 'Mulhouse', mail_pro: 'a@test.invalid', statut: 'stop' }];
  const rows = [{ entreprise: 'Y', ville: 'Z', mail_pro: 'A@TEST.invalid' }, { entreprise: 'TEST Autre', ville: 'Colmar', mail_pro: '' }];
  assert.deepEqual(classify(rows, existing, consoKeys, (e) => e.statut === 'stop').map((c) => c.etat), ['bloque', 'nouveau']);
});

test('similarité : copier-coller détecté au-delà de 80 %', () => {
  const modele = 'Bonjour, j’ai vu que votre entreprise a remporté le chantier de la nouvelle école de Kingersheim et je voulais vous proposer un échange sur la gestion de vos devis et de vos plannings.';
  const copie = modele.replace('Kingersheim', 'Wittenheim');
  const autre = 'Bonjour Madame, félicitations pour l’ouverture de votre second cabinet à Colmar. Comment gérez-vous aujourd’hui la saisie des pièces comptables de vos clients artisans ?';
  assert.ok(similarity(modele, copie) > 0.8);
  assert.ok(similarity(modele, autre) < 0.3);
  assert.equal(similarity('', ''), 0);
  const pairs = similarPairs([
    { id: 1, corps: modele, cible_id: 'c' }, { id: 2, corps: copie, cible_id: 'c' },
    { id: 3, corps: copie, cible_id: 'autre' }, { id: 4, corps: autre, cible_id: 'c' },
  ]);
  assert.deepEqual(pairs.map((p) => [p.a, p.b]), [[1, 2]]);
});

test('mots interdits : prix, VocaStork, ArtiGroup', () => {
  assert.deepEqual(forbiddenIssues({ objet: 'Projet', corps: 'Pour 8 000 € HT seulement' }), ['un prix']);
  assert.deepEqual(forbiddenIssues({ objet: '', corps: 'à partir de 9k€' }), ['un prix']);
  assert.deepEqual(forbiddenIssues({ objet: 'Voca Stork', corps: 'notre partenaire Arti-Group' }), ['le mot « VocaStork »', 'le mot « ArtiGroup »']);
  assert.deepEqual(forbiddenIssues({ objet: 'Votre chantier', corps: 'Vous êtes 15 salariés en EURL depuis 2019.' }), []);
});

test('validation impossible sans objet, corps, mail pro, information vraie + URL', () => {
  const ent = { mail_pro: 'x@test.invalid', information_vraie: 'A ouvert une agence en 2026', url_source_information: 'https://exemple.fr/article' };
  assert.deepEqual(validationErrors({ objet: 'Votre agence', corps: 'Bonjour' }, ent), []);
  assert.equal(validationErrors({ objet: '', corps: '' }, {}).length, 5);
  assert.equal(validationErrors({ objet: 'a', corps: 'b' }, { ...ent, url_source_information: 'pas une url' }).length, 1);
  assert.equal(validationErrors({ objet: 'a', corps: 'b' }, { ...ent, statut: 'stop' }).length, 1);
  assert.equal(validationErrors({ objet: 'a', corps: 'VocaStork' }, ent).length, 1);
});

test('dates : lundi de la semaine, phase courante', () => {
  assert.equal(mondayOf('2026-10-21'), '2026-10-19');
  assert.equal(mondayOf('2026-10-26'), '2026-10-26');
  assert.equal(mondayOf('2026-11-01'), '2026-10-26'); // dimanche
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  const phases = [
    { id: 1, date_debut: '2026-10-26', date_fin: '2026-11-06' },
    { id: 2, date_debut: '2026-11-09', date_fin: '2026-11-20' },
  ];
  assert.equal(currentPeriod(phases, 'date_debut', 'date_fin', '2026-10-21').id, 1); // à venir
  assert.equal(currentPeriod(phases, 'date_debut', 'date_fin', '2026-11-10').id, 2);
  assert.equal(currentPeriod(phases, 'date_debut', 'date_fin', '2026-11-07').id, 2); // entre deux : la suivante
  assert.equal(currentPeriod(phases, 'date_debut', 'date_fin', '2026-12-10').id, 2); // après : la dernière
});
