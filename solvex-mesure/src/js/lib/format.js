// Mise en forme des chiffres : pourcentage + nombre brut, ex. « 22 % (13/60) »

export function ratio(n, d) {
  return d ? n / d : null;
}

export function pctValue(n, d) {
  return d ? Math.round((n / d) * 100) : null;
}

export function pct(n, d) {
  const v = pctValue(n, d);
  return `${v === null ? '—' : `${v} %`} (${n}/${d})`;
}

export function num(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString('fr-FR', { maximumFractionDigits: digits });
}

export function euro(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${Math.round(v).toLocaleString('fr-FR')} €`;
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
