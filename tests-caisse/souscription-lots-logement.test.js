/* Souscription au logement : un seul lot ; souscription au terrain : plusieurs lots possibles sur une même souscription. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  await page.evaluate(function () {
    window.syncToSupabase = function () {}; window.dbPut = async function () { return true; };
    window.toast = function (m, t) { (window.__t = window.__t || []).push([m, t]); };
    DATA.programmes = [{ id: 'g1', nom: 'R', division_id: 'dv1' }];
    DATA.lots = [
      { id: 'a1', numero: '1', programme_id: 'g1', nature: 'maison', prix: 1000, surface: 100, statut: 'disponible' }, { id: 'a2', numero: '2', programme_id: 'g1', nature: 'maison', prix: 1000, surface: 100, statut: 'disponible' },
      { id: 't1', numero: '11', programme_id: 'g1', nature: 'terrain', prix: 500, surface: 300, statut: 'disponible' }, { id: 't2', numero: '12', programme_id: 'g1', nature: 'terrain', prix: 500, surface: 300, statut: 'disponible' },
      { id: 't3', numero: '13', programme_id: 'g1', nature: 'terrain', prix: 500, surface: 300, statut: 'disponible' }];
    DATA.clients = [
      { id: 'L', nom: 'LOGE', tel: '0102030405', programme_id: 'g1', lot_id: 'a1', lot_ids: ['a1'], montant_total: 1000 },
      { id: 'LM', nom: 'OLD', tel: '0102030406', programme_id: 'g1', lot_id: 'a2', lot_ids: ['a2', 'a1'], montant_total: 2000 },
      { id: 'T', nom: 'TERR', tel: '0102030407', programme_id: 'g1', lot_id: 't1', lot_ids: ['t1'], montant_total: 500 }];
  });
}
const etat = (page, id) => page.evaluate(async function (id) {
  openClientModal(id); await new Promise(function (r) { setTimeout(r, 150); });
  var g = document.getElementById('c-grp-lots-supp'), n = document.getElementById('c-lots-supp-note');
  return { nature: clientFormNature(), groupe: g.style.display !== 'none', note: n.style.display !== 'none' };
}, id);

test('logement : bloc « autres lots » masqué, ajout refusé ; ancien dossier multi-lots : note, retrait possible', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  assert.deepEqual(await etat(app.page, 'L'), { nature: 'logement', groupe: false, note: false });
  assert.deepEqual(await etat(app.page, 'LM'), { nature: 'logement', groupe: true, note: true });
  const r = await app.page.evaluate(async function () {
    openClientModal('L'); await new Promise(function (r) { setTimeout(r, 150); }); APP._clientLotsSupplementaires = []; var sel = document.getElementById('c-lot-supplementaire');
    sel.innerHTML = '<option value="a2">Lot 2</option>'; sel.value = 'a2'; ajouterLotSupplementaireClient();
    return { supp: APP._clientLotsSupplementaires.length, msg: (window.__t || []).pop()[0] };
  });
  assert.equal(r.supp, 0); assert.match(r.msg, /un seul lot par souscription/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('terrain : plusieurs lots sur une même souscription ; enregistrement d\'un logement avec lot ajouté refusé', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  assert.deepEqual(await etat(app.page, 'T'), { nature: 'terrain', groupe: true, note: false });
  const r = await app.page.evaluate(async function () {
    openClientModal('T'); await new Promise(function (r) { setTimeout(r, 150); }); updateLotsSupplementairesSelect(); var sel = document.getElementById('c-lot-supplementaire');
    sel.value = 't2'; ajouterLotSupplementaireClient(); sel.value = 't3'; ajouterLotSupplementaireClient();
    var out = { supp: APP._clientLotsSupplementaires.slice() };
    openClientModal('L'); await new Promise(function (r) { setTimeout(r, 150); }); APP._clientLotsSupplementaires = ['a2']; var cm = document.getElementById('c-commercial'); cm.innerHTML = '<option value="x1">Com</option>'; cm.value = 'x1'; window.__t = []; await saveClient();
    out.refus = (window.__t.pop() || [''])[0]; out.clientInchange = DATA.clients.find(function (c) { return c.id === 'L'; }).lot_ids.length;
    return out;
  });
  assert.deepEqual(r.supp, ['t2', 't3']); assert.match(r.refus, /un seul lot par souscription/); assert.equal(r.clientInchange, 1);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('rapprochement : un logement déjà doté d\'un lot refuse un second lot ; terrain et souscripteur sans lot acceptent', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    window.confirm = function () { return true; }; window.exigerDroit = function () { return true; }; window.majStatutLotClient = async function () {}; window.ajouterHistorique = async function () {};
    window.rapprochementRender = function () {}; window.renderLotsDashboard = function () {};
    var out = {}, set = function (id) { var s = document.createElement('select'); s.id = 'rapp-sel-' + id; document.body.appendChild(s); return s; };
    DATA.clients.push({ id: 'N', nom: 'SANSLOT', tel: '0102030408', programme_id: 'g1', montant_total: 1 });
    var sel = set('L'); sel.innerHTML = '<option value="a2">a2</option>'; sel.value = 'a2'; await rapprochementRattacher('L');
    out.logement = DATA.clients.find(function (c) { return c.id === 'L'; }).lot_ids.slice(); out.msg = (window.__t || []).pop()[0];
    sel = set('T'); sel.innerHTML = '<option value="t2">t2</option>'; sel.value = 't2'; await rapprochementRattacher('T');
    out.terrain = DATA.clients.find(function (c) { return c.id === 'T'; }).lot_ids.slice();
    sel = set('N'); sel.innerHTML = '<option value="a2">a2</option>'; sel.value = 'a2'; await rapprochementRattacher('N');
    out.sansLot = DATA.clients.find(function (c) { return c.id === 'N'; }).lot_ids.slice();
    return out;
  });
  assert.deepEqual(r.logement, ['a1']); assert.match(r.msg, /un seul lot par souscription/);
  assert.deepEqual(r.terrain, ['t1', 't2']); assert.deepEqual(r.sansLot, ['a2']);
  assert.deepEqual(app.etat.erreursPage, []);
});
