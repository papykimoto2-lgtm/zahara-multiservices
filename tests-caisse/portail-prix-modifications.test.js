/* Portail souscripteur : bloc « Prix du bien et modifications » (lecture seule, mêmes règles que les attestations de solde). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright').chromium; }
const fs = require('fs');
const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const exe = process.env.CHROMIUM_PATH || (fs.existsSync(base) ? fs.readdirSync(base).filter(d => d.startsWith('chromium-')).sort().reverse().map(d => path.join(base, d, 'chrome-linux', 'chrome')).find(f => fs.existsSync(f)) : undefined);
let nav; after(async () => { if (nav) await nav.close(); });
async function ouvrir() {
  nav = nav || await chromium.launch({ executablePath: exe });
  const page = await (await nav.newContext()).newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  await page.goto('file://' + path.resolve(__dirname, '..', 'portail-unique.html'));
  await page.waitForFunction(() => typeof sPrixModifs === 'function');
  return { page, erreurs };
}
const rendre = (page, client, versements) => page.evaluate(([c, v]) => { S.client = c; S.versements = v; return sPrixModifs(); }, [client, versements]);

test('prix initial, modifications, valeur finale, versé et reste', async () => {
  const { page, erreurs } = await ouvrir();
  const h = await rendre(page, { id: 'c1', montant_total: 30000000, demandes_modification: [{ date: '2026-03-01', description: 'Cuisine américaine', facture: true, montant_facture: 2000000 }, { date: '2026-04-01', description: 'Non facturée', facture: false, montant_facture: 999 }],
    regularisations_surface: [{ date: '2026-05-01', ecart_m2: 2, prix_m2: 500000, montant: 1000000 }] },
  [{ montant: 20000000, type: 'versement' }, { montant: 500000, type: 'frais_souscription' }, { montant: 1000000, statut: 'annule' }]);
  assert.match(h, /Prix initial du bien[\s\S]*27[\s ]000[\s ]000 FCFA/); assert.match(h, /Cuisine américaine/); assert.doesNotMatch(h, /Non facturée/);
  assert.match(h, /Écart de surface de 2 m²/); assert.match(h, /Valeur finale du bien[\s\S]*30[\s ]000[\s ]000 FCFA/);
  assert.match(h, /Total versé[\s\S]*20[\s ]000[\s ]000 FCFA/); assert.match(h, /Reste à payer[\s\S]*10[\s ]000[\s ]000 FCFA/);
  assert.deepEqual(erreurs, []);
});

test('sans modification : pas de valeur finale ; soldé ; sans montant : rien', async () => {
  const { page } = await ouvrir();
  const a = await rendre(page, { id: 'c1', montant_total: 27000000 }, [{ montant: 27000000 }]);
  assert.match(a, /Prix initial du bien/); assert.doesNotMatch(a, /Valeur finale/); assert.match(a, /soldé ✓/); assert.match(a, /Aucune modification facturée/);
  assert.equal(await rendre(page, { id: 'c1' }, []), '');
});

test('données incohérentes (modifications ≥ contrat) : aucune décomposition inventée', async () => {
  const { page } = await ouvrir();
  const h = await rendre(page, { id: 'c1', montant_total: 1000000, demandes_modification: [{ facture: true, montant_facture: 5000000, description: 'X' }] }, []);
  assert.doesNotMatch(h, /Valeur finale/); assert.match(h, /1[\s ]000[\s ]000 FCFA/);
});

test('échappement HTML des libellés', async () => {
  const { page } = await ouvrir();
  const h = await rendre(page, { id: 'c1', montant_total: 5000000, demandes_modification: [{ facture: true, montant_facture: 100000, description: '<img src=x onerror=alert(1)>' }] }, []);
  assert.doesNotMatch(h, /<img/); assert.match(h, /&lt;img/);
});

test('espace notaire : seul ce qui est transmis s\'affiche, texte échappé ; rien si aucun dossier', async () => {
  const { page, erreurs } = await ouvrir();
  const r = await page.evaluate(() => {
    INT.dossiers = []; var vide = _intDossiersNotaireHtml();
    INT.dossiers = [
      { souscripteur: '<b>BENDE</b>', dossier: 'D-1', identite: { nom: 'BENDE', prenoms: 'Jean', naissance: '1980-01-01', nationalite: 'Ivoirienne', piece_type: 'CNI', piece_num: 'C0012' },
        bien: { lots: [{ lot: '12', ilot: 'B', surface: '300', type: 'villa', parcelle: 'PARC-1', localisation: 'Bingerville', numero_tf: 'TF 123' }], references: [{ dossier: 'DF-G', idufci: 'CI-1', numero_dossier_guf: 'GUF-9' }] },
        avancement: [{ reference: 'DF-I', niveau: 'individuel', statut: 'en_cours', etapes: [{ libelle: 'Acte de mutation', statut: 'en_cours', date_cible: '2026-12-01' }, { libelle: 'Dépôt', statut: 'termine' }] }],
        attestations: [{ kind: 'finale', numero: 'ATF-1', date: '2026-10-14', html: '<p>x</p>' }],
        pieces: [{ id: 'p1', nom: 'titre_mere.pdf', taille: 2500000, date: '2026-10-10', version: 2 }] },
      { souscripteur: 'KONE', dossier: 'D-2', identite: null, bien: null, avancement: null, attestations: [{ kind: 'initial', numero: 'ATS-2', html: '<p>y</p>' }], pieces: [] }];
    return { vide: vide, h: _intDossiersNotaireHtml() };
  });
  assert.equal(r.vide, ''); assert.doesNotMatch(r.h, /<b>BENDE/); assert.match(r.h, /&lt;b&gt;BENDE/);
  assert.match(r.h, /Jean BENDE/); assert.match(r.h, /CNI C0012/); assert.match(r.h, /Lot 12, îlot B — 300 m²/); assert.match(r.h, /TF TF 123/); assert.match(r.h, /IDUFCI CI-1/); assert.match(r.h, /GUF GUF-9/);
  assert.match(r.h, /Acte de mutation : <strong>En cours<\/strong> <span[^>]*>\(échéance 01\/12\/2026\)/); assert.match(r.h, /Dépôt : <strong>Terminée<\/strong>/);
  assert.match(r.h, /Valeur finale · N° ATF-1 · validée le 14\/10\/2026/); assert.match(r.h, /Prix initial · N° ATS-2/);
  assert.match(r.h, /titre_mere\.pdf[\s\S]*2\.4 Mo · 10\/10\/2026 · v2/);
  const kone = r.h.slice(r.h.indexOf('KONE')); assert.doesNotMatch(kone, /Identité|Avancement du dossier|Pièces/, 'KONE : seules les attestations sont transmises');
  assert.equal((r.h.match(/intOuvrirPiece/g) || []).length, 1); assert.equal((r.h.match(/intOuvrirAttestation/g) || []).length, 2); assert.deepEqual(erreurs, []);
});

test('ouverture d\'une pièce : appel de fc-notaire-piece avec le jeton, puis URL signée ; refus et session expirée gérés', async () => {
  const { page, erreurs } = await ouvrir();
  const r = await page.evaluate(async () => {
    var appels = [], ouverts = [], rep = { status: 200, body: { url: 'https://x.supabase.co/storage/v1/object/sign/pieces-foncieres/a?token=t' } };
    window.fetch = async function (u, o) { appels.push({ u: String(u), body: o && o.body, h: o && o.headers }); return new Response(JSON.stringify(rep.body), { status: rep.status }); };
    window.open = function () { var w = { closed: false, location: '', close: function () { this.closed = true; } }; ouverts.push(w); return w; };
    INT.id = 'n1'; INT.nom = 'Etude'; INT.dossiers = [{ souscripteur: 'BENDE', pieces: [{ id: 'pz1', nom: 'a.pdf' }], attestations: [] }];
    var out = {};
    await intOuvrirPiece('0', '0'); out.ok = { loc: ouverts[0].location, appel: appels[0].u, corps: appels[0].body };
    rep = { status: 403, body: { message: 'Document indisponible.' } }; await intOuvrirPiece('0', '0'); out.refus = { ferme: ouverts[1].closed, msg: INT.msg && INT.msg.m };
    rep = { status: 401, body: {} }; window.logoutIntervenant = function () { out.deconnecte = true; }; await intOuvrirPiece('0', '0');
    return out;
  });
  assert.match(r.ok.appel, /\/functions\/v1\/fc-notaire-piece$/); assert.equal(r.ok.corps, '{"piece_id":"pz1"}'); assert.match(r.ok.loc, /object\/sign\/pieces-foncieres\/a\?token=t/);
  assert.equal(r.refus.ferme, true); assert.equal(r.refus.msg, 'Document indisponible.'); assert.equal(r.deconnecte, true); assert.deepEqual(erreurs, []);
});
