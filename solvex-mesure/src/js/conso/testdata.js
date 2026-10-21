// Données de test évidentes (« TEST … », adresses .invalid) pour essayer le CRM consulting,
// y compris les alertes qualité (copier-coller, mot interdit). Toutes portent est_test = true.

const CORPS_TYPE = (ville) => `Bonjour,

J'ai vu que votre entreprise intervient sur de nombreux chantiers autour de ${ville} et je voulais vous proposer un échange de vingt minutes sur la façon dont vous gérez aujourd'hui vos devis, vos plannings et le suivi de vos équipes.

Bonne journée,
Damien`;

export async function chargerTestConso(db, data) {
  const cibles = [...data.cibles].sort((a, b) => String(a.semaine).localeCompare(String(b.semaine), 'fr', { numeric: true }));
  const s1 = cibles[0];
  const s2 = cibles[1] || cibles[0];
  const J = (iso, h = 8) => `${iso}T${String(h).padStart(2, '0')}:15:00Z`;
  const envoi = s1.date_envoi_1 || '2026-10-26';
  const ent = (n, extra = {}) => ({
    id: crypto.randomUUID(), cible_id: s1.id, entreprise: `TEST BTP ${n}`, dirigeant_prenom: 'Prénom', dirigeant_nom: `TEST${n}`,
    fonction: 'Gérant', taille: '10-20', ville: ['Mulhouse', 'Colmar', 'Kingersheim', 'Wittenheim', 'Illzach', 'Cernay'][n % 6],
    departement: '68', mail_pro: `contact@test-btp-${n}.invalid`, source: 'sourcing', statut: 'actif',
    information_vraie: `Fait fictif de test n°${n} (à remplacer par un fait réel vérifié)`, url_source_information: `https://exemple.invalid/test-${n}`,
    est_test: true, ...extra,
  });
  const ents = [1, 2, 3, 4, 5, 6].map((n) => ent(n));
  ents.push(ent(7, { cible_id: s2.id, entreprise: 'TEST Cabinet comptable 7', fonction: 'Expert-comptable', taille: '5-10' }));
  ents.push(ent(8, { source: 'recommandation', entreprise: 'TEST BTP 8 (recommandé)' }));
  await db.insert('mesure_conso_entreprises', ents);

  const m = (e, extra) => ({ entreprise_id: e.id, type: 'premier', objet: `Votre activité à ${e.ville}`, est_test: true, ...extra });
  const mails = [
    m(ents[0], { corps: `Bonjour Prénom,\n\nFélicitations pour le chantier fictif n°1. Comment suivez-vous aujourd'hui les heures de vos compagnons ?\n\nDamien`, statut: 'repondu_positif', valide_le: J(envoi, 7), envoye_le: J(envoi), reponse_le: J(envoi, 15) }),
    m(ents[1], { corps: CORPS_TYPE('Colmar'), statut: 'rendez_vous', valide_le: J(envoi, 7), envoye_le: J(envoi), reponse_le: J(s1.date_envoi_2 || envoi, 10) }),
    m(ents[2], { corps: CORPS_TYPE('Kingersheim'), statut: 'envoye', valide_le: J(envoi, 7), envoye_le: J(envoi) }), // copier-coller de ents[1]
    m(ents[3], { corps: 'Bonjour,\n\nTest de bounce : adresse fictive.\n\nDamien', statut: 'bounce', valide_le: J(envoi, 7), envoye_le: J(envoi) }),
    m(ents[4], { corps: 'Bonjour,\n\nNous travaillons avec ArtiGroup sur ce sujet.\n\nDamien', statut: 'brouillon' }), // mot interdit
    m(ents[5], { corps: 'Bonjour Prénom,\n\nJ’ai lu le fait fictif n°6 vous concernant. Seriez-vous ouvert à un court échange ?\n\nDamien', statut: 'valide', valide_le: J(envoi, 7) }),
    m(ents[6], { corps: 'Bonjour,\n\nTest pour la cible experts-comptables.\n\nDamien', statut: 'brouillon' }),
    m(ents[7], { corps: 'Bonjour,\n\nNotre ami commun (fictif) m’a conseillé de vous écrire.\n\nDamien', statut: 'repondu_positif', valide_le: J(envoi, 7), envoye_le: J(envoi), reponse_le: J(envoi, 12) }),
    { entreprise_id: ents[2].id, type: 'relance', objet: 'Re : votre activité', corps: 'Bonjour, je me permets de revenir vers vous.\n\nDamien', statut: 'refus', envoye_le: J(s1.date_envoi_2 || envoi), reponse_le: J(s1.date_envoi_2 || envoi, 14), est_test: true },
  ];
  await db.insert('mesure_conso_mails', mails);

  const reseau = [
    { id: crypto.randomUUID(), nom: 'TEST Contact Fédé', organisation: 'TEST Organisation', lien_avec_solvex: 'fede', ce_quil_peut_apporter: 'Mises en relation (fictif)', dernier_contact: envoi, prochaine_action: 'Relancer', prochaine_action_le: envoi, recommandations_obtenues: 2, est_test: true },
    { id: crypto.randomUUID(), nom: 'TEST Comptable partenaire', organisation: 'TEST Cabinet', lien_avec_solvex: 'comptable', ce_quil_peut_apporter: 'Clients PME (fictif)', dernier_contact: null, prochaine_action: 'Premier appel', recommandations_obtenues: 0, est_test: true },
  ];
  await db.insert('mesure_conso_reseau', reseau);

  await db.insert('mesure_conso_rdv', [
    { entreprise_id: ents[1].id, date: J(s1.date_envoi_2 || envoi, 13), type: 'decouverte', statut: 'a_faire', montant_potentiel_eur: 9000, est_test: true },
    { reseau_id: reseau[0].id, date: J(s1.date_envoi_2 || envoi, 15), type: 'decouverte', statut: 'fait', montant_potentiel_eur: 8000, est_test: true },
    { entreprise_id: ents[7].id, date: J(s1.date_envoi_2 || envoi, 9), type: 'decouverte', statut: 'a_faire', montant_potentiel_eur: 10000, est_test: true },
  ]);
}
