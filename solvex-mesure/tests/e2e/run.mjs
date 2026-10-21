// Tests navigateur headless (Playwright) sur le build « memory » (aucune base réelle touchée).
// Lancement : npm run test:e2e
// Vérifie aussi qu'aucune requête ne sort vers l'extérieur pendant les scénarios.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = join(root, 'dist');
const shots = join(root, 'test-results');
await mkdir(shots, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const body = await readFile(join(dist, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'text/html' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
const externes = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) externes.push(r.url()); });

let n = 0;
const results = [];
async function etape(nom, fn) {
  n += 1;
  try {
    await fn();
    results.push(`ok ${n} - ${nom}`);
  } catch (e) {
    results.push(`ÉCHEC ${n} - ${nom}\n   ${e.message.split('\n').slice(0, 6).join('\n   ')}`);
    await page.screenshot({ path: join(shots, `echec-${n}.png`), fullPage: true });
  }
}
const go = async (hash) => { await page.goto(`${base}#${hash}`); await page.waitForSelector('main h1'); };
const toastText = async () => (await page.locator('.toast').allTextContents()).join(' | ');
const clearToasts = () => page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });

// ---------------------------------------------------------------- Agent vocal
await etape('ouverture : file d’appel vide', async () => {
  await go('/vocal/file');
  assert.equal(await page.locator('main h1').textContent(), "File d'appel");
  await page.getByText('Aucun lead dans cette sélection').waitFor();
});

const CSV_VOCAL = [
  'Société;Prénom;Nom;Activité;Ville;Mobile;Raison',
  'TEST Plomberie A;Jean;TEST;Plombier;Mulhouse;06 00 00 00 01;Dépannage 7j/7',
  'TEST Serrurerie B;Paul;TEST;Serrurier;Colmar;0600000002;Seul gérant',
  'TEST Chauffage C;Marc;TEST;Chauffagiste;Illzach;+33 6 00 00 00 03;Avis Google',
  'TEST Doublon;X;TEST;Plombier;Ailleurs;0600000001;même tél que A',
].join('\n');

await etape('import CSV agent vocal : colonnes détectées, doublon dans le fichier', async () => {
  await go('/vocal/import');
  await page.fill('#i-texte', CSV_VOCAL);
  await page.click('[data-act="apercu"]');
  await page.getByText('Nouveau : 3').waitFor();
  await page.getByText('Doublon dans le fichier : 1').waitFor();
  const mapping = await page.locator('main .card .muted').nth(1).textContent();
  assert.match(mapping, /entreprise ← « Société »/);
  assert.match(mapping, /telephone ← « Mobile »/);
  await page.click('[data-act="importer"]');
  await page.waitForFunction(() => document.body.innerText.includes('3 leads importés'));
});

await etape('saisie d’un appel au clavier (4, C, note, Entrée) et passage au suivant', async () => {
  await go('/vocal/file');
  await page.getByText('Jamais appelé.').waitFor();
  const premier = await page.locator('.lead-titre').textContent();
  await page.locator('#btn-appeler').waitFor();
  assert.match(await page.locator('#btn-appeler').getAttribute('href'), /^tel:0600000001$/);
  await page.keyboard.press('4');
  await page.keyboard.press('c');
  assert.equal(await page.locator('[data-resultat="joint_decideur"]').getAttribute('aria-checked'), 'true');
  assert.equal(await page.locator('input[name="decideur_joint"]').isChecked(), true);
  assert.equal(await page.locator('input[name="conversation_plus_1min"]').isChecked(), true);
  await page.fill('textarea[name="note"]', 'Intéressé, rappeler la semaine prochaine');
  await page.locator('textarea[name="note"]').press('Control+Enter');
  await page.waitForFunction(() => document.body.innerText.includes('Appel enregistré'));
  await page.getByText('Session (aujourd’hui) : 1 / 30').waitFor();
  const second = await page.locator('.lead-titre').textContent();
  assert.notEqual(second, premier);
});

await etape('lead « ne pas rappeler » sort de la file et est bloqué à l’import suivant', async () => {
  const nom = await page.locator('.lead-titre').textContent();
  await page.keyboard.press('9');
  await page.selectOption('select[name="motif_refus"]', 'pas_interesse');
  await page.click('#enregistrer');
  await page.waitForFunction(() => document.body.innerText.includes('Ne pas rappeler'));
  assert.equal(await page.locator('tr[data-lead]').filter({ hasText: nom }).count(), 0);
  await go('/vocal/import');
  await page.fill('#i-texte', CSV_VOCAL);
  await page.click('[data-act="apercu"]');
  await page.getByText('Bloqué : ne pas rappeler : 1').waitFor();
  await page.getByText('Doublon (déjà en base) : 3').waitFor();
  assert.equal(await page.locator('[data-act="importer"]').isDisabled(), true);
});

await etape('rendez-vous : une démo apparaît dans la liste', async () => {
  await go('/vocal/file');
  await page.keyboard.press('7');
  assert.equal(await page.locator('input[name="demo_ou_rdv"]').isChecked(), true);
  await page.keyboard.press('s');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('Appel enregistré : Démo / RDV'));
  await go('/vocal/rdv');
  await page.getByText('1 démo / RDV').waitFor();
  await page.selectOption('[data-rdvstatut]', 'fait');
  await page.waitForFunction(() => document.body.innerText.includes('Rendez-vous mis à jour'));
});

await etape('tableau de bord phase 1 : formules', async () => {
  await go('/vocal/dashboard');
  // 3 appels : joint_decideur, ne_pas_rappeler, demo_rdv → tous joints
  const txt = await page.locator('main').innerText();
  assert.match(txt, /Taux de décrochage \(joints \/ appels\)\s+100 % \(3\/3\)/);
  assert.match(txt, /Taux de démo\/RDV sur appels ★ indicateur principal\s+33 % \(1\/3\)/);
  assert.match(txt, /Taux de refus \(refus \/ joints\)\s+33 % \(1\/3\)/);
  assert.match(txt, /Appels par rendez-vous\s+3/);
  assert.match(txt, /Échantillon trop petit pour conclure : 3 appels/);
  const dl = page.waitForEvent('download');
  await page.click('[data-act="export"]');
  assert.match((await dl).suggestedFilename(), /^tableau-de-bord-phase-1-.*\.csv$/);
});

await etape('comparaison finale + export du bilan HTML', async () => {
  await go('/vocal/comparaison');
  await page.getByText('Les phases côte à côte').waitFor();
  await page.getByText('Leads cold vs ArtiGroup (toutes phases)').waitFor();
  assert.match(await page.locator('main').innerText(), /Échantillon trop petit pour conclure/);
  const dl = page.waitForEvent('download');
  await page.click('[data-act="bilan"]');
  const file = await dl;
  assert.match(file.suggestedFilename(), /^bilan-agent-vocal-.*\.html$/);
  const html = await readFile(await file.path(), 'utf8');
  assert.match(html, /33 % \(1\/3\)/);
});

await etape('phases modifiables dans l’interface', async () => {
  await go('/vocal/phases');
  const form = page.locator('form[data-phase]').first();
  await form.locator('input[name="creneau_conseille"]').fill('12h-13h30');
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.body.innerText.includes('Phase enregistrée'));
  await go('/vocal/file');
  await page.getByText('12h-13h30').waitFor();
});

await etape('données de test agent vocal : chargement puis suppression', async () => {
  await go('/vocal/phases');
  await page.click('[data-act="charger"]');
  await page.waitForFunction(() => document.body.innerText.includes('Données de test chargées'));
  await page.getByText(/Vider les données de test \((\d+)\)/).waitFor();
  page.once('dialog', (d) => d.accept());
  await page.click('[data-act="vider"]');
  await page.waitForFunction(() => document.body.innerText.includes('Données de test supprimées'));
  // les leads importés au début ont des noms « TEST … » : ils sont aussi des données de test
  await page.getByText('Vider les données de test (0)').waitFor();
});

// ---------------------------------------------------------------- Consulting
const CSV_CONSO = [
  'entreprise,dirigeant,fonction,taille,ville,site,mail_pro,telephone,information_vraie,url_source_information,objet,corps',
  'TEST Gros Oeuvre,Luc TEST,Gérant,15,Mulhouse,https://exemple.invalid,luc@test-go.invalid,0600000010,"A remporté le lot gros œuvre (fictif)",,"Votre lot gros œuvre","Bonjour Luc,\nBravo pour ce lot (fictif)."',
  'TEST Charpente,Anne TEST,Gérante,12,Colmar,,anne@test-ch.invalid,0600000011,Nouvelle agence (fictif),https://exemple.invalid/a,Votre agence,"Bonjour, nous travaillons avec ArtiGroup."',
].join('\n');

await etape('import CSV consulting : entreprises + mails en brouillon', async () => {
  await go('/conso/import');
  await page.fill('#i-texte', CSV_CONSO);
  await page.click('[data-act="apercu"]');
  await page.getByText('Nouveau : 2').waitFor();
  await page.click('[data-act="importer"]');
  await page.waitForFunction(() => document.body.innerText.includes('2 entreprises et 2 mails importés'));
});

await etape('validation refusée sans URL de source, et refusée avec « ArtiGroup »', async () => {
  await go('/conso/semaine');
  await page.getByText('Contenu interdit').waitFor();
  await clearToasts();
  const ligneGO = page.locator('tr').filter({ hasText: 'TEST Gros Oeuvre' });
  await ligneGO.locator('[data-statut="valide"]').click();
  await page.waitForFunction(() => document.body.innerText.includes("L'URL de la source"));
  await clearToasts();
  await page.locator('tr').filter({ hasText: 'TEST Charpente' }).locator('[data-statut="valide"]').click();
  await page.waitForFunction(() => document.body.innerText.includes('interdit dans les mails consulting'));
});

await etape('fiche entreprise : ajout de la source, validation, envoyé, réponse RDV', async () => {
  await go('/conso/semaine');
  await page.locator('a', { hasText: 'TEST Gros Oeuvre' }).click();
  await page.waitForSelector('#f-ent');
  await page.fill('input[name="url_source_information"]', 'https://exemple.invalid/source');
  await page.click('#f-ent button[type="submit"]');
  await page.waitForFunction(() => document.body.innerText.includes('Fiche enregistrée'));
  await page.click('[data-statut="valide"]');
  await page.waitForFunction(() => document.body.innerText.includes('Mail : Validé'));
  await page.click('[data-statut="envoye"]');
  await page.waitForFunction(() => document.body.innerText.includes('Mail : Envoyé'));
  assert.equal(await page.locator('textarea[name="corps"]').getAttribute('readonly'), '');
  await page.selectOption('[data-reponse]', 'rendez_vous');
  await page.waitForFunction(() => document.body.innerText.includes('Rendez-vous ajouté'));
  await page.getByRole('button', { name: 'Ajouter une relance' }).waitFor();
});

await etape('tableau de bord consulting : formules', async () => {
  await go('/conso/dashboard');
  const txt = await page.locator('main').innerText();
  assert.match(txt, /Taux de réponse \(réponses \/ envoyés\)\s+100 % \(1\/1\)/);
  assert.match(txt, /Taux de rendez-vous \(RDV \/ envoyés\) ★ indicateur principal\s+100 % \(1\/1\)/);
  assert.match(txt, /Échantillon trop petit pour conclure : 1 mail envoyé/);
  await page.fill('#d-heures', '4');
  await page.locator('#d-heures').press('Tab');
  await page.waitForFunction(() => document.body.innerText.includes('Heures enregistrées'));
  await page.waitForFunction(() => /Rendez-vous par heure de travail\s+0,25/.test(document.querySelector('main').innerText));
});

await etape('rendez-vous consulting : montant potentiel', async () => {
  await go('/conso/rdv');
  await page.fill('[data-champ="montant_potentiel_eur"]', '9000');
  await page.locator('[data-champ="montant_potentiel_eur"]').press('Tab');
  await page.waitForFunction(() => document.body.innerText.includes('Rendez-vous mis à jour'));
  await go('/conso/dashboard');
  await page.waitForFunction(() => /Panier potentiel moyen\s+9\s000 €/.test(document.querySelector('main').innerText));
});

await etape('réseau chaud : ajout, contacté aujourd’hui, +1 recommandation', async () => {
  await go('/conso/reseau');
  const f = page.locator('form[data-reseau=""]');
  await f.locator('input[name="nom"]').fill('TEST Apporteur');
  await f.locator('select[name="lien_avec_solvex"]').selectOption('apporteur');
  await f.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.body.innerText.includes('Personne ajoutée'));
  await page.locator('[data-contact]').first().click();
  await page.waitForFunction(() => document.body.innerText.includes('Dernier contact : aujourd’hui'));
  await page.locator('[data-reco]').first().click();
  await page.getByText('Recommandations obtenues : 1').waitFor();
});

await etape('données de test consulting : alerte copier-coller, comparaison, vidage', async () => {
  await go('/conso/cibles');
  await page.click('[data-act="charger"]');
  await page.waitForFunction(() => document.body.innerText.includes('Données de test chargées'));
  await go('/conso/semaine');
  await page.getByText('Copier-coller détecté').waitFor();
  await go('/conso/comparaison');
  await page.getByText('Direct (mails) vs réseau chaud').waitFor();
  const dl = page.waitForEvent('download');
  await page.click('[data-act="bilan"]');
  assert.match((await dl).suggestedFilename(), /^bilan-consulting-.*\.html$/);
  await go('/conso/cibles');
  page.once('dialog', (d) => d.accept());
  await page.click('[data-act="vider"]');
  await page.waitForFunction(() => document.body.innerText.includes('Données de test supprimées'));
  await page.getByText('Vider les données de test (0)').waitFor();
});

await etape('affichage mobile (390 px) sans débordement horizontal', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await go('/vocal/phases');
  await page.click('[data-act="charger"]');
  await page.waitForFunction(() => document.body.innerText.includes('Données de test chargées'));
  for (const h of ['/vocal/file', '/vocal/dashboard', '/conso/semaine', '/conso/reseau']) {
    await go(h);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${h} déborde de ${overflow}px`);
    await page.screenshot({ path: join(shots, `mobile${h.replace(/\//g, '-')}.png`), fullPage: false });
  }
});

await etape('aucune erreur JavaScript et aucune requête externe', async () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(externes, []);
});

await browser.close();
server.close();
console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('ÉCHEC')).length;
console.log(`\n${results.length - fails}/${results.length} scénarios réussis`);
process.exit(fails ? 1 : 0);
