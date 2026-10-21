// Détection des doublons à l'import

export function normText(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\b(sarl|sas|sasu|eurl|sa|sci|ets|etablissements)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// 06 12 34 56 78, +33 6 12 34 56 78, 0033612345678 → 0612345678
export function normPhone(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('0033')) d = `0${d.slice(4)}`;
  else if (d.startsWith('33') && d.length === 11) d = `0${d.slice(2)}`;
  return d.length >= 9 ? d : '';
}

export function normMail(s) {
  return String(s || '').trim().toLowerCase();
}

// Clés d'identité d'un lead vocal : téléphone(s), ou entreprise + commune
export function vocalKeys(l) {
  const keys = [];
  for (const p of [l.telephone, l.telephone_fixe]) {
    const n = normPhone(p);
    if (n) keys.push(`tel:${n}`);
  }
  const e = normText(l.entreprise);
  if (e) keys.push(`ec:${e}|${normText(l.commune)}`);
  return keys;
}

// Clés d'identité d'une entreprise consulting : mail pro, ou entreprise + ville
export function consoKeys(e) {
  const keys = [];
  const m = normMail(e.mail_pro);
  if (m) keys.push(`mail:${m}`);
  const n = normText(e.entreprise);
  if (n) keys.push(`ev:${n}|${normText(e.ville)}`);
  return keys;
}

// Classe chaque ligne : 'nouveau' | 'doublon' (déjà en base) | 'doublon_fichier' | 'bloque' (ne pas rappeler / stop)
// existing : lignes en base ; isBlocked(ligneEnBase) → true si la ligne en base interdit tout nouvel ajout
export function classify(rows, existing, keysFn, isBlocked) {
  const index = new Map();
  for (const ex of existing) for (const k of keysFn(ex)) {
    const prev = index.get(k);
    // une ligne bloquée l'emporte sur une ligne simplement présente
    if (!prev || isBlocked(ex)) index.set(k, ex);
  }
  const seen = new Set();
  return rows.map((row) => {
    const keys = keysFn(row);
    const matches = keys.map((k) => index.get(k)).filter(Boolean);
    let etat = 'nouveau';
    if (matches.some(isBlocked)) etat = 'bloque';
    else if (matches.length) etat = 'doublon';
    else if (keys.some((k) => seen.has(k))) etat = 'doublon_fichier';
    keys.forEach((k) => seen.add(k));
    return { row, etat, match: matches[0] || null };
  });
}
