const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Un collègue modifie un dossier sur un autre poste : l'événement Realtime arrive (_rtApply). L'écran Foncier ouvert doit se rafraîchir seul. */
async function preparer(page) {
  return page.evaluate(async () => {
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville' }];
    DATA.users = [{ id: 'u1', nom: 'Resp', login: 'r' }];
    window.userPeutSurStore = () => true; window.syncToSupabase = () => {};
    APP.currentUser = { id: 'u1', nom: 'Resp', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers', 'groupes_fonciers'].forEach(s => { DATA[s] = DATA[s] || []; });
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    /* rend l'écran Foncier réellement visible (la page est masquée dans le harness) */
    for (let e = document.getElementById('fc-root'); e && e !== document.body; e = e.parentElement) e.style.display = 'block';
    fcRender(); fcOuvrirDetail(d.id); fcOnglet('etapes');
    return { id: d.id, code: d.etapes[1].code };
  });
}

test('foncier temps réel : un changement de statut fait ailleurs apparaît seul à l\'écran, sans recharger', async () => {
  const app = await ouvrirApp(); const { id, code } = await preparer(app.page);
  try {
    const avant = await app.page.evaluate((code) => document.querySelector('#fc-detail tr[data-fcet="' + code + '"] select').value, code);
    const apres = await app.page.evaluate(async ({ id, code }) => {
      const d = JSON.parse(JSON.stringify(fcDossier(id)));
      const cible = Object.keys(FC_STATUTS).find(k => k !== d.etapes[1].statut && k !== 'termine') || 'en_cours';
      d.etapes[1].statut = cible; d._modifie = new Date(Date.now() + 60000).toISOString(); d._v = (d._v || 0) + 1;
      await _rtApply('pi_dossiers_fonciers', 'UPDATE', { id: d.id, data: d }, null);   /* événement reçu d'un autre poste */
      await new Promise(r => setTimeout(r, 1400));
      return { cible, enDonnees: fcDossier(id).etapes[1].statut, affiche: document.querySelector('#fc-detail tr[data-fcet="' + code + '"] select').value };
    }, { id, code });
    assert.notEqual(apres.cible, avant, 'le test doit changer le statut');
    assert.equal(apres.enDonnees, apres.cible, 'fusion en mémoire');
    assert.equal(apres.affiche, apres.cible, 'l\'écran doit se rafraîchir sans recharger');
    assert.equal(app.etat.erreursPage.length, 0, app.etat.erreursPage.join('\n'));
  } finally { await app.fermer(); }
});

test('foncier temps réel : un nouveau dossier créé ailleurs apparaît dans la liste', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  try {
    const r = await app.page.evaluate(async () => {
      const nb0 = document.querySelectorAll('#fc-root tbody tr').length;
      const autre = JSON.parse(JSON.stringify(DATA.dossiers_fonciers[0]));
      autre.id = 'dossier_distant'; autre.reference = 'DF-2026-9999'; autre._modifie = new Date().toISOString();
      await _rtApply('pi_dossiers_fonciers', 'INSERT', { id: autre.id, data: autre }, null);
      await new Promise(r => setTimeout(r, 1400));
      return { nb0, texte: document.getElementById('fc-root').textContent.includes('DF-2026-9999') };
    });
    assert.equal(r.texte, true, 'le dossier distant doit apparaître à l\'écran');
  } finally { await app.fermer(); }
});

test('foncier temps réel : pas de rafraîchissement pendant que l\'utilisateur saisit dans un champ', async () => {
  const app = await ouvrirApp(); const { id } = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (id) => {
      /* champ de saisie dans l'écran Foncier (le premier select du harness refuse le focus : on en ajoute un, même garde-fou testé) */
      const champ = document.createElement('input'); champ.type = 'text'; document.getElementById('fc-root').appendChild(champ);
      champ.focus();
      if (document.activeElement !== champ) throw new Error('le champ de test n\'a pas pris le focus');
      let rendus = 0; const orig = window.fcRender; window.fcRender = function () { rendus++; return orig.apply(this, arguments); };
      const d = JSON.parse(JSON.stringify(fcDossier(id))); d._modifie = new Date(Date.now() + 60000).toISOString(); d.observations = 'x';
      await _rtApply('pi_dossiers_fonciers', 'UPDATE', { id: d.id, data: d }, null);
      await new Promise(r => setTimeout(r, 1400));
      const pendantSaisie = rendus;
      champ.blur(); await new Promise(r => setTimeout(r, 2300));
      window.fcRender = orig;
      return { pendantSaisie, apresSaisie: rendus };
    }, id);
    assert.equal(r.pendantSaisie, 0, 'aucun rendu pendant la saisie');
    assert.ok(r.apresSaisie >= 1, 'rendu une fois la saisie terminée');
  } finally { await app.fermer(); }
});

test('foncier temps réel : le changement de statut d\'une pièce fait ailleurs est pris en compte (horodatage)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  try {
    const r = await app.page.evaluate(async () => {
      const p = { id: 'pc1', dossier_id: DATA.dossiers_fonciers[0].id, etape_code: 'x', nom: 'a.pdf', statut: 'a_verifier', depose_le: '2026-03-01T10:00:00Z', depose_par: { role: 'souscripteur' } };
      DATA.pieces_foncieres.push(p);
      await fcDb('pieces_foncieres', p);                        /* poste A : écriture locale */
      const distant = JSON.parse(JSON.stringify(p)); distant.statut = 'acceptee'; distant._modifie = new Date(Date.now() + 60000).toISOString();
      await _rtApply('pi_pieces_foncieres', 'UPDATE', { id: 'pc1', data: distant }, null);   /* poste B a accepté la pièce */
      return { horodatee: !!p._modifie, statut: fcPiece('pc1').statut };
    });
    assert.equal(r.horodatee, true);
    assert.equal(r.statut, 'acceptee');
  } finally { await app.fermer(); }
});
