/* Cession foncière : registre des documents remis, bordereau, carte portail acquéreur. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(() => {
    window.syncToSupabase = () => {}; APP.currentUser = { id: 'u1', nom: 'Agent Test', role: 'admin' };
    DATA.params = Object.assign({}, DATA.params, { societe: 'MENKO TEST' });
    DATA.cessions_foncieres = [{ id: 'k1', date: '2026-09-01', dossier: 'CF-001', designation: 'Lot 12', acquereur: 'Koné Aminata', acheteur: { type: 'physique', nom: 'Koné', prenoms: 'Aminata' }, prix_cession: 5000000, montant_encaisse: 2000000, statut: 'cedee' }];
    return true;
  });
}

test('registre : remise, date, visibilité, note, autre document', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(() => {
    const c = DATA.cessions_foncieres[0], avant = cesDocCompteur(c);
    cesDocMaj('k1', 'plan_lot', 'remis', true); cesDocMaj('k1', 'plan_lot', 'note', 'Plan n°7');
    cesDocMaj('k1', 'recus', 'portail', true);
    window.prompt = () => 'Quitus communal'; _cesDocId = 'k1'; cesDocAjouter();
    const d = c.documents_remis, autre = Object.keys(d).find(k => k.indexOf('autre_') === 0);
    cesDocMaj('k1', 'plan_lot', 'remis', false);
    return { avant, apres: cesDocCompteur(c), plan: d.plan_lot, recus: d.recus, autre: d[autre], nb: cesDocListe(c).length };
  });
  assert.equal(r.avant, '0/10'); assert.equal(r.nb, 11); assert.equal(r.apres, '0/11');
  assert.equal(r.plan.statut, 'a_remettre'); assert.equal(r.plan.note, 'Plan n°7'); assert.equal(r.recus.portail, true);
  assert.equal(r.autre.libelle, 'Quitus communal');
});

test('attestation de solde suivie automatiquement ; remise marquée avec date et agent', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(() => {
    const c = DATA.cessions_foncieres[0];
    c.attestation_solde = { statut: 'valide', publie_portail: true, numero: 'ACS-1', valide_le: '2026-10-01', html: '<p>x</p>' };
    cesDocMaj('k1', 'contrat', 'remis', true);
    return { cpt: cesDocCompteur(c), contrat: c.documents_remis.contrat };
  });
  assert.equal(r.cpt, '2/10'); assert.equal(r.contrat.par, 'Agent Test'); assert.equal(r.contrat.portail, true); assert.match(r.contrat.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('modal et bordereau : rendu sans erreur page', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const txt = await app.page.evaluate(() => { cesDocOuvrir('k1'); return document.getElementById('cesdoc-body').textContent + '|' + document.getElementById('modal-ces-docs').classList.contains('open'); });
  assert.match(txt, /Plan de situation/); assert.match(txt, /suivi automatique/); assert.match(txt, /\|true$/);
  assert.equal(app.etat.erreursPage.length, 0, app.etat.erreursPage.join('\n'));
});

test('portail : seules les lignes visibles, sans note interne', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
  const src = html.match(/var FON_DOCS_LIB=[\s\S]*?\n  function rendreFoncier/)[0].replace(/function rendreFoncier$/, '');
  const rendre = (c) => new Function('esc', 'dshort', src + '; return fonDocsCarte;')(s => String(s), s => s)(c);
  assert.equal(rendre({}), ''); assert.equal(rendre({ documents_remis: { plan_lot: { statut: 'remis', portail: false } } }), '');
  const o = rendre({ documents_remis: { plan_lot: { statut: 'remis', date: '2026-10-02', portail: true, note: 'SECRET' }, recus: { statut: 'a_remettre', portail: true }, autre_x: { libelle: 'Quitus', portail: true, statut: 'remis' }, inconnu: { portail: true, statut: 'remis' } } });
  assert.ok(!/SECRET/.test(o)); assert.match(o, /Remis le 2026-10-02/); assert.match(o, /À venir/); assert.match(o, /Quitus/); assert.ok(!/inconnu/.test(o));
});
