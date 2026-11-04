const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Relations intragroupe : revue et améliorations (CSV sûr, soldes cumulés, validation des conventions, alertes, périmètre du dossier CAC). */

test('export CSV : une cellule qui commence par = + - @ n\'est plus exécutable comme formule ; un nombre négatif reste un nombre', async () => {
  const app = await ouvrirApp();
  try {
    const csv = await app.page.evaluate(function () { return _intragCsv([['=HYPERLINK("x")', '+1+1', '@SUM(A1)', '-cmd', -500, '-12,5', 'normal']]); });
    const cells = csv.replace(/^﻿/, '').split(';');
    assert.equal(cells[0], '"\'=HYPERLINK(""x"")"');
    assert.equal(cells[1], '"\'+1+1"');
    assert.equal(cells[2], '"\'@SUM(A1)"');
    assert.equal(cells[3], '"\'-cmd"');
    assert.equal(cells[4], '"-500"');
    assert.equal(cells[5], '"-12,5"');
    assert.equal(cells[6], '"normal"');
  } finally { await app.fermer(); }
});

test('soldes cumulés : un déséquilibre né l\'année précédente apparaît, alors que la matrice des mouvements de l\'année est vide', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Div 1' }, { id: 'd2', nom: 'Div 2' }];
      DATA.params.consolidation = { liaison: ['185'] };
      DATA.ecritures = [
        E('a1', '2024-03-01', '185', '521', 1000, { division: 'd1' }),          // d1 prête 1000 : côté d1 seulement
        E('b1', '2024-04-01', '185', '521', 400, { division: 'd1' }),
        E('b2', '2024-04-01', '521', '185', 400, { division: 'd2' })           // paire équilibrée
      ];
      const an = _intragMatrice('2025'), cum = _intragMatriceCumulee('2025');
      return { mouvements: an.lignes.length, cumul: cum.lignes.map(function (l) { return [l.compte, Math.round(l.total)]; }), divs: cum.divs.map(function (d) { return d.id; }) };
    });
    assert.equal(r.mouvements, 0);
    assert.deepEqual(r.cumul, [['185', 1000]]);
    assert.deepEqual(r.divs, ['d1', 'd2']);
  } finally { await app.fermer(); }
});

async function saisir(page, o) {
  return page.evaluate(async function (o) {
    ouvrirConventionReglementee();
    const set = function (id, v) { const e = document.getElementById(id); if (e) { if (e.type === 'checkbox') e.checked = !!v; else e.value = v; } };
    set('cr-type', 'pret_avance'); set('cr-div-a', o.a === undefined ? 'd1' : o.a); set('cr-div-b', o.b === undefined ? 'd2' : o.b);
    set('cr-date', o.date === undefined ? '2025-03-01' : o.date); set('cr-montant', o.montant === undefined ? '1000' : o.montant);
    set('cr-objet', 'Avance de trésorerie'); set('cr-approuvee', o.appr); set('cr-date-approb', o.dAppr || ''); set('cr-date-ag', o.ag || ''); set('cr-date-fin', o.fin || '');
    const avant = (DATA.conventions_reglementees || []).length;
    window.__toasts = [];
    await enregistrerConventionReglementee();
    return { n: (DATA.conventions_reglementees || []).length - avant, msg: window.__toasts.join(' | ') };
  }, o);
}

test('convention : parties distinctes, montant positif, date non future, date d\'autorisation exigée, fin après signature', async () => {
  const app = await ouvrirApp();
  try {
    await app.page.evaluate(function () { DATA.divisions = [{ id: 'd1', nom: 'Div 1' }, { id: 'd2', nom: 'Div 2' }]; DATA.conventions_reglementees = []; });
    assert.equal((await saisir(app.page, { b: 'd1' })).n, 0, 'même division des deux côtés');
    assert.equal((await saisir(app.page, { montant: '-5' })).n, 0, 'montant négatif');
    assert.equal((await saisir(app.page, { date: '2099-01-01' })).n, 0, 'date future');
    assert.equal((await saisir(app.page, { appr: true, dAppr: '' })).n, 0, 'autorisée sans date');
    assert.equal((await saisir(app.page, { fin: '2024-01-01' })).n, 0, 'fin avant signature');
    const ok = await saisir(app.page, { appr: true, dAppr: '2025-02-20', ag: '2025-06-30', fin: '2026-03-01' });
    assert.equal(ok.n, 1, ok.msg);
    const c = await app.page.evaluate(function () { return DATA.conventions_reglementees[0]; });
    assert.equal(c.date_approbation_ag, '2025-06-30');
    assert.equal(c.date_fin, '2026-03-01');
  } finally { await app.fermer(); }
});

test('convention : droit Comptabilité requis', async () => {
  const app = await ouvrirApp();
  try {
    await app.page.evaluate(function () { DATA.divisions = [{ id: 'd1', nom: 'Div 1' }, { id: 'd2', nom: 'Div 2' }]; DATA.conventions_reglementees = []; window.exigerDroit = function () { return false; }; });
    assert.equal((await saisir(app.page, {})).n, 0);
  } finally { await app.fermer(); }
});

test('alertes : flux sans convention active, convention non autorisée, autorisation postérieure à la signature', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Div 1' }, { id: 'd2', nom: 'Div 2' }];
      DATA.params.consolidation = { liaison: ['185'] };
      DATA.ecritures = [E('f1', '2025-05-01', '185', '521', 100, { division: 'd1' })];
      DATA.conventions_reglementees = [];
      const a0 = _intragAlertes_();
      DATA.conventions_reglementees = [
        { id: 'c1', type: 'pret_avance', division_a: 'd1', division_b: 'd2', date_signature: '2025-03-01', objet: 'A', approuvee_ca: false, statut: 'active' },
        { id: 'c2', type: 'pret_avance', division_a: 'd1', division_b: 'd2', date_signature: '2025-03-01', objet: 'B', approuvee_ca: true, date_approbation_ca: '2025-04-01', statut: 'active' }
      ];
      const a1 = _intragAlertes_();
      return { a0, a1 };
      function _intragAlertes_() { const a = _intragAlertesConv('2025'); return { flux: a.fluxSansConvention, non: a.nonAutorisees.length, apres: a.apresSignature.length }; }
    });
    assert.deepEqual(r.a0, { flux: true, non: 0, apres: 0 });
    assert.deepEqual(r.a1, { flux: false, non: 1, apres: 1 });
  } finally { await app.fermer(); }
});

test('dossier CAC : conventions signées après l\'exercice ou échues avant son 1er janvier exclues', async () => {
  const app = await ouvrirApp();
  try {
    const ids = await app.page.evaluate(function () {
      DATA.conventions_reglementees = [
        { id: 'ok', date_signature: '2024-06-01', statut: 'active' },
        { id: 'echue', date_signature: '2022-06-01', date_fin: '2024-12-31', statut: 'terminee' },
        { id: 'future', date_signature: '2026-02-01', statut: 'active' },
        { id: 'finEnAnnee', date_signature: '2023-01-01', date_fin: '2025-06-30', statut: 'terminee' }
      ];
      return _intragConvPourExercice('2025').map(function (c) { return c.id; });
    });
    assert.deepEqual(ids.sort(), ['finEnAnnee', 'ok']);
  } finally { await app.fermer(); }
});

test('écrans : le registre, les soldes cumulés, les alertes et le dossier CAC s\'affichent sans erreur', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Div 1' }, { id: 'd2', nom: 'Div 2' }];
      DATA.params.consolidation = { liaison: ['185'] };
      DATA.ecritures = [E('a1', '2025-03-01', '185', '521', 1000, { division: 'd1', libelle: '=EVIL()' })];
      DATA.conventions_reglementees = [{ id: 'c1', type: 'pret_avance', division_a: 'd1', division_b: 'd2', date_signature: '2025-03-01', objet: '<b>x</b>', approuvee_ca: false, statut: 'active', date_fin: '2026-01-01' }];
      _intragAnnee = '2025'; _intragRender();
      const flux = document.getElementById('tab-intragroupe-flux').innerHTML, conv = document.getElementById('tab-intragroupe-conventions').innerHTML;
      let pdf = ''; window.genererEtatPDF = function (o) { pdf = o.contenu; };
      _intragExportCACPdf();
      return { cumul: /soldes cumulés au 31\/12\/2025/.test(flux), alerte: /sans autorisation du conseil/.test(conv), brut: /<b>x<\/b>/.test(conv), pdfCum: /2 bis/.test(pdf), pdfStatut: /fin /.test(pdf) };
    });
    assert.deepEqual(r, { cumul: true, alerte: true, brut: false, pdfCum: true, pdfStatut: true });
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});

test('appariement : chaque ligne de liaison est rapprochée de son miroir dans une autre division ; les lignes seules sont listées', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Div 1' }, { id: 'd2', nom: 'Div 2' }];
      DATA.params.consolidation = { liaison: ['185'] };
      DATA.ecritures = [
        E('p1', '2025-03-01', '185', '521', 1000, { division: 'd1', piece: 'P1' }),          // d1 débit 1000
        E('p2', '2025-03-03', '521', '185', 1000, { division: 'd2', piece: 'P2' }),          // d2 crédit 1000 : miroir
        E('s1', '2025-04-01', '185', '521', 500, { division: 'd1', piece: 'S1' }),           // sans miroir
        E('s2', '2025-05-01', '521', '185', 700, { division: 'd2', piece: 'S2' }),           // sans miroir
        E('m1', '2025-06-01', '185', '521', 300, { division: 'd1', piece: 'M1' }),           // même division des deux côtés :
        E('m2', '2025-06-01', '521', '185', 300, { division: 'd1', piece: 'M2' })            // ne s'apparient pas entre elles
      ];
      const A = _intragAppariement('2025');
      _intragAnnee = '2025'; _intragRender();
      return { app: A.apparies.map(function (x) { return [x.debit.piece, x.credit.piece, x.ecartJours]; }), seuls: A.sansMiroir.map(function (x) { return x.piece; }).sort(),
        ecran: /4 ligne\(s\) sans miroir/.test(document.getElementById('tab-intragroupe-flux').innerHTML) };
    });
    assert.deepEqual(r.app, [['P1', 'P2', 2]]);
    assert.deepEqual(r.seuls, ['M1', 'M2', 'S1', 'S2']);
    assert.equal(r.ecran, true);
  } finally { await app.fermer(); }
});

test('appariement : la date la plus proche l\'emporte, au-delà de 60 jours rien n\'est apparié', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Div 1' }, { id: 'd2', nom: 'Div 2' }];
      DATA.params.consolidation = { liaison: ['185'] };
      DATA.ecritures = [
        E('d', '2025-06-10', '185', '521', 100, { division: 'd1', piece: 'D' }),
        E('c1', '2025-01-05', '521', '185', 100, { division: 'd2', piece: 'LOIN' }),
        E('c2', '2025-06-12', '521', '185', 100, { division: 'd2', piece: 'PROCHE' })
      ];
      const A = _intragAppariement('2025');
      return { app: A.apparies.map(function (x) { return x.credit.piece; }), seuls: A.sansMiroir.map(function (x) { return x.piece; }) };
    });
    assert.deepEqual(r.app, ['PROCHE']);
    assert.deepEqual(r.seuls, ['LOIN']);
  } finally { await app.fermer(); }
});
