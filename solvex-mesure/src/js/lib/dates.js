// Dates : tout est raisonné en heure de Paris, les dates sont des chaînes ISO « AAAA-MM-JJ ».

const TZ = 'Europe/Paris';

const isoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });
const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export function isoDate(d = new Date()) {
  return isoFmt.format(d);
}

export function todayISO() {
  return isoDate(new Date());
}

function parseISO(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Lundi de la semaine contenant la date (semaine du lundi au dimanche)
export function mondayOf(iso) {
  const d = parseISO(iso);
  const day = (d.getUTCDay() + 6) % 7; // 0 = lundi
  return addDays(iso, -day);
}

// Heure (0-23) d'un horodatage, en heure de Paris
export function parisHour(ts) {
  return Number(hourFmt.formatToParts(new Date(ts)).find((p) => p.type === 'hour').value);
}

// Jour de la semaine (0 = lundi … 6 = dimanche), en heure de Paris
export function parisWeekday(ts) {
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[weekdayFmt.format(new Date(ts))];
}

export function parisDate(ts) {
  return isoDate(new Date(ts));
}

export function frDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function frDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('fr-FR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Valeur pour <input type="datetime-local"> en heure de Paris
export function toLocalInput(ts) {
  const d = new Date(ts);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Inverse de toLocalInput : interprète « AAAA-MM-JJTHH:MM » comme heure de Paris
export function fromLocalInput(value) {
  if (!value) return null;
  const guess = new Date(`${value}:00Z`);
  // décalage de Paris à cet instant
  const shown = toLocalInput(guess);
  const diff = new Date(`${shown}:00Z`) - guess;
  return new Date(guess.getTime() - diff).toISOString();
}

export function daysBetween(ts1, ts2) {
  return (new Date(ts2) - new Date(ts1)) / 86400000;
}

// Phase « courante » : celle qui contient aujourd'hui, sinon la prochaine, sinon la dernière
export function currentPeriod(items, startKey, endKey, today = todayISO()) {
  const sorted = [...items].sort((a, b) => (a[startKey] < b[startKey] ? -1 : 1));
  return (
    sorted.find((p) => p[startKey] <= today && today <= p[endKey]) ||
    sorted.find((p) => p[startKey] > today) ||
    sorted[sorted.length - 1] ||
    null
  );
}
