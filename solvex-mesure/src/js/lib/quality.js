// Qualité des mails consulting : validation, mots interdits, copier-coller

export const SEUIL_SIMILARITE = 0.8;

function words(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

// Similarité de Dice sur les paires de mots consécutifs (0 = rien en commun, 1 = identique)
export function similarity(a, b) {
  const bigrams = (t) => {
    const w = words(t);
    const m = new Map();
    for (let i = 0; i < w.length - 1; i += 1) {
      const k = `${w[i]} ${w[i + 1]}`;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return { m, n: Math.max(w.length - 1, 0) };
  };
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.n || !B.n) {
    const wa = words(a).join(' ');
    return wa && wa === words(b).join(' ') ? 1 : 0;
  }
  let common = 0;
  for (const [k, c] of A.m) common += Math.min(c, B.m.get(k) || 0);
  return (2 * common) / (A.n + B.n);
}

// Paires de mails d'une même cible dont le corps se ressemble à plus de 80 %
// mails : [{ id, corps, cible_id }]
export function similarPairs(mails, seuil = SEUIL_SIMILARITE) {
  const pairs = [];
  for (let i = 0; i < mails.length; i += 1) {
    for (let j = i + 1; j < mails.length; j += 1) {
      const a = mails[i];
      const b = mails[j];
      if (a.cible_id !== b.cible_id || !a.corps || !b.corps) continue;
      const s = similarity(a.corps, b.corps);
      if (s > seuil) pairs.push({ a: a.id, b: b.id, score: s });
    }
  }
  return pairs;
}

const PRIX = /(\d[\d\s.,]*\s?(€|euros?\b|eur\b|k€|keur\b|ht\b|ttc\b))|(€\s?\d)/i;
const MOTS_INTERDITS = [
  { re: /voca\s*-?\s*stork/i, label: 'le mot « VocaStork »' },
  { re: /arti\s*-?\s*group/i, label: 'le mot « ArtiGroup »' },
];

// Contenus interdits dans un mail consulting (objet + corps)
export function forbiddenIssues(mail) {
  const text = `${mail.objet || ''}\n${mail.corps || ''}`;
  const issues = [];
  if (PRIX.test(text)) issues.push('un prix');
  for (const m of MOTS_INTERDITS) if (m.re.test(text)) issues.push(m.label);
  return issues;
}

// Raisons qui empêchent de passer un mail à « validé ». Liste vide = validable.
export function validationErrors(mail, entreprise) {
  const errs = [];
  if (!String(mail.objet || '').trim()) errs.push("L'objet est vide.");
  if (!String(mail.corps || '').trim()) errs.push('Le corps du mail est vide.');
  if (!String(entreprise?.mail_pro || '').trim()) errs.push('Le mail pro de l’entreprise est vide.');
  if (!String(entreprise?.information_vraie || '').trim()) errs.push("L'information vraie est vide.");
  if (!/^https?:\/\/\S+\.\S+/i.test(String(entreprise?.url_source_information || '').trim())) {
    errs.push("L'URL de la source de l'information est vide ou invalide.");
  }
  if (entreprise?.statut === 'stop') errs.push("L'entreprise est marquée « stop » : plus aucun envoi.");
  const f = forbiddenIssues(mail);
  if (f.length) errs.push(`Le mail contient ${f.join(', ')} (interdit dans les mails consulting).`);
  return errs;
}
