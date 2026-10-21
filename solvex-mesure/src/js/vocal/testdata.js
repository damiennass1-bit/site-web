// Données de test évidentes (« TEST … », 06 00 00 xx xx) pour essayer le CRM agent vocal.
// Toutes les lignes portent est_test = true et sont supprimées par « Vider les données de test ».

import { mondayOf, addDays } from '../lib/dates.js';

const METIERS = ['Plombier', 'Chauffagiste', 'Serrurier', 'Électricien', 'Kiné', 'Dentiste', 'Agence immobilière', 'Syndic'];
const VILLES = ['Mulhouse', 'Kingersheim', 'Wittenheim', 'Colmar', 'Illzach', 'Riedisheim'];

// Résultats déterministes pour obtenir des tableaux de bord lisibles
const SCENARIO = [
  ['pas_de_reponse'], ['repondeur'], ['joint_pas_decideur', { conversation_plus_1min: true }],
  ['joint_decideur', { decideur_joint: true, conversation_plus_1min: true }],
  ['refus', { decideur_joint: true, motif_refus: 'pas_interesse' }], ['pas_de_reponse'],
  ['demo_rdv', { decideur_joint: true, conversation_plus_1min: true, demo_ou_rdv: true, rdv_statut: 'a_faire', sms_envoye: true }],
  ['rappeler', { decideur_joint: true }], ['faux_numero'], ['repondeur'],
  ['refus', { motif_refus: 'deja_equipe' }], ['ne_pas_rappeler', { motif_refus: 'mefiance_ia' }],
];

export async function chargerTestVocal(db, data) {
  const phases = [...data.phases].sort((a, b) => a.numero - b.numero);
  const leads = [];
  let n = 0;
  phases.slice(0, 3).forEach((p, pi) => {
    const semaine = mondayOf(p.date_debut);
    const count = pi === 0 ? 14 : 6;
    for (let i = 0; i < count; i += 1) {
      n += 1;
      leads.push({
        phase_id: p.id,
        entreprise: `TEST ${METIERS[(pi * 4 + i) % METIERS.length]} ${String(n).padStart(2, '0')}`,
        dirigeant_prenom: 'Prénom',
        dirigeant_nom: `TEST${n}`,
        metier: METIERS[(pi * 4 + i) % METIERS.length],
        commune: VILLES[i % VILLES.length],
        departement: '68',
        telephone: `06000000${String(n).padStart(2, '0')}`,
        source: i % 4 === 3 ? 'artigroup' : 'cold',
        raison_inclusion: 'Donnée de test (fictive)',
        semaine: i < count / 2 ? semaine : addDays(semaine, 7),
        statut: 'a_appeler',
        est_test: true,
      });
    }
  });
  const saved = await db.insert('mesure_vocal_leads', leads);

  // Appels fictifs sur les leads de la phase 1 : mardi 12h-13h et jeudi 13h-14h (heure de Paris, UTC+1)
  const p1 = saved.filter((l) => l.phase_id === phases[0]?.id).slice(0, SCENARIO.length);
  const mardi = addDays(mondayOf(phases[0].date_debut), 1);
  const appels = p1.map((l, i) => {
    const [resultat, extra = {}] = SCENARIO[i];
    const jour = i % 2 === 0 ? mardi : addDays(mardi, 2);
    const heureUTC = i % 2 === 0 ? 11 : 12;
    return {
      lead_id: l.id, resultat, tentative: 1, est_test: true,
      date_heure: `${jour}T${String(heureUTC).padStart(2, '0')}:${String(5 + i * 4).padStart(2, '0')}:00Z`,
      rappel_le: resultat === 'rappeler' ? addDays(jour, 2) : null,
      date_rdv: resultat === 'demo_rdv' ? `${addDays(jour, 5)}T09:00:00Z` : null,
      ...extra,
    };
  });
  await db.insert('mesure_vocal_appels', appels);
  const statut = { ne_pas_rappeler: 'ne_pas_rappeler', faux_numero: 'a_retirer', refus: 'termine', demo_rdv: 'termine' };
  for (const a of appels) {
    await db.update('mesure_vocal_leads', a.lead_id, { statut: statut[a.resultat] || 'en_cours' });
  }
}
