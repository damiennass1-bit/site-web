// Petits utilitaires d'interface partagés par les deux CRM

import { esc, pct } from './lib/format.js';
import { toCSV, download } from './lib/csv.js';
import { todayISO } from './lib/dates.js';

export function toast(message, type = 'ok') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'erreur' ? 'alert' : 'status');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'erreur' ? 7000 : 3000);
}

// Exécute une action asynchrone et affiche l'erreur éventuelle
export async function act(fn, okMessage) {
  try {
    const r = await fn();
    if (okMessage) toast(okMessage);
    return r;
  } catch (e) {
    console.error(e);
    toast(`Erreur : ${e.message}`, 'erreur');
    return undefined;
  }
}

export function options(list, selected, { empty } = {}) {
  const head = empty !== undefined ? `<option value="">${esc(empty)}</option>` : '';
  return head + list.map((o) => {
    const value = typeof o === 'object' ? o.code ?? o.value ?? o.id : o;
    const label = typeof o === 'object' ? o.label ?? o.nom ?? value : o;
    return `<option value="${esc(value)}"${String(value) === String(selected ?? '') ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

export function tabs(items, active, attr = 'data-tab') {
  return `<div class="tabs" role="tablist">${items.map((t) =>
    `<button type="button" role="tab" class="tab${t.id === active ? ' active' : ''}" aria-selected="${t.id === active}" ${attr}="${esc(t.id)}">${esc(t.label)}</button>`).join('')}</div>`;
}

export const rate = (t) => pct(t.n, t.d);

export function kpis(list) {
  return `<div class="kpis">${list.map(([label, value, hint]) =>
    `<div class="kpi"><div class="kpi-v">${esc(value)}</div><div class="kpi-l">${esc(label)}</div>${hint ? `<div class="kpi-h">${esc(hint)}</div>` : ''}</div>`).join('')}</div>`;
}

export function warn(text) {
  return `<div class="alerte">${esc(text)}</div>`;
}

// Barres horizontales simples (aussi utilisées dans le bilan exporté)
export function bars(title, items) {
  const max = Math.max(1, ...items.map((i) => i.value ?? 0));
  return `<figure class="bars"><figcaption>${esc(title)}</figcaption>${items.map((i) => `
    <div class="bar-row"><span class="bar-label">${esc(i.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${i.value === null ? 0 : Math.max(1, (i.value / max) * 100)}%"></span></span>
      <span class="bar-value">${esc(i.text)}</span></div>`).join('')}</figure>`;
}

export function exportCSV(name, rows, columns) {
  download(`${name}-${todayISO()}.csv`, toCSV(rows, columns));
}

export function empty(text) {
  return `<p class="vide">${esc(text)}</p>`;
}

export function badge(text, kind = '') {
  return `<span class="badge ${esc(kind)}">${esc(text)}</span>`;
}

// Tableau HTML générique : columns = [{ label, html(row) }]
export function table(rows, columns, { cls = '', rowAttr } = {}) {
  if (!rows.length) return empty('Aucune ligne.');
  return `<div class="table-wrap"><table class="${cls}"><thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr ${rowAttr ? rowAttr(r) : ''}>${columns.map((c) => `<td data-label="${esc(c.label)}">${c.html(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// Lit un formulaire en objet (cases à cocher → booléens, champs vides → null)
export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value.trim() === '' ? null : el.value.trim();
  }
  return out;
}

// Rapport HTML autonome et imprimable (téléchargé, jamais envoyé)
export function bilanHTML(title, bodyHTML) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1f24;background:#fff;margin:24px;line-height:1.45}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}p.meta{color:#555;margin:0 0 16px}
table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}th,td{border:1px solid #ccd;padding:6px 8px;text-align:left}
th{background:#f1f3f7}.alerte{background:#fff4e0;border-left:4px solid #d98a00;padding:8px 10px;margin:8px 0;font-size:13px}
.bars{margin:12px 0}.bars figcaption{font-weight:600;margin-bottom:6px}.bar-row{display:grid;grid-template-columns:160px 1fr 130px;gap:8px;align-items:center;font-size:13px;margin:3px 0}
.bar-track{background:#eef0f4;height:14px;border-radius:3px;overflow:hidden}.bar-fill{display:block;height:100%;background:#2f5fd0}
.no-print button{padding:8px 14px;font-size:14px;margin-bottom:12px}@media print{.no-print{display:none}body{margin:10mm}}
</style></head><body><div class="no-print"><button onclick="window.print()">Imprimer / enregistrer en PDF</button></div>
${bodyHTML}</body></html>`;
}
