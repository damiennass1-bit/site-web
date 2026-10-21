// Lecture / écriture CSV sans dépendance. Séparateur détecté automatiquement (; , ou tabulation).

export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const counts = { ';': 0, ',': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ',';
}

export function parseCSV(text, delimiter = detectDelimiter(text)) {
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => c.trim() !== ''));
  const headers = (clean.shift() || []).map((h) => h.trim());
  return {
    headers,
    rows: clean.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))),
  };
}

function cell(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'oui' : 'non') : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns : [{ key, label }] ou liste de clés. Séparateur « ; » pour Excel en français.
export function toCSV(rows, columns) {
  const cols = (columns || Object.keys(rows[0] || {})).map((c) => (typeof c === 'string' ? { key: c, label: c } : c));
  const lines = [cols.map((c) => cell(c.label)).join(';')];
  for (const r of rows) lines.push(cols.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

// Téléchargement local d'un fichier généré dans le navigateur (aucun envoi réseau)
export function download(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Normalise un intitulé de colonne : minuscules, sans accents ni ponctuation
export function normHeader(h) {
  return String(h || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Associe chaque champ attendu à une colonne du fichier. aliases : { champ: [variantes] }
export function mapColumns(headers, aliases) {
  const normalized = headers.map((h) => ({ raw: h, n: normHeader(h) }));
  const mapping = {};
  for (const [field, variants] of Object.entries(aliases)) {
    const wanted = [field, ...variants].map(normHeader);
    const hit = normalized.find((h) => wanted.includes(h.n));
    if (hit) mapping[field] = hit.raw;
  }
  return mapping;
}
