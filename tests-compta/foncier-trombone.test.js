const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('foncier : le trombone d\'une étape (onglet Étapes) ouvre le panneau de jonction, visible, avec champ fichier et retour', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async () => {
      DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville' }];
      DATA.users = [{ id: 'u1', nom: 'Resp', login: 'r' }];
      window.userPeutSurStore = () => true; window.syncToSupabase = () => {};
      APP.currentUser = { id: 'u1', nom: 'Resp', role: 'foncier' };
      ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = DATA[s] || []; });
      const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
      document.body.insertAdjacentHTML('beforeend', '<div id="fc-root"></div>');
      fcRender(); fcOuvrirDetail(d.id);
      fcOnglet('etapes');                                            /* l'utilisateur est sur « Étapes » */
      const code = d.etapes[0].code;
      const bouton = document.querySelector('#fc-detail tr[data-fcet="' + code + '"] button[title^="Fichiers joints"]');
      bouton.click();                                                /* clic sur le trombone */
      await new Promise(r => setTimeout(r, 300));
      const panneau = document.getElementById('fc-pieces'), champ = document.getElementById('fc-piece-fichier');
      /* visible = dans l'onglet actif du détail (la page Foncier est masquée dans le harness : on ne peut pas tester la géométrie) */
      const visible = el => !!el && !!el.closest('.fc-pane.on');
      const actifs = [...document.querySelectorAll('#fc-detail .fc-pane.on')].map(p => p.getAttribute('data-fcpane'));
      const vPanneau = visible(panneau), vChamp = visible(champ);
      fcOnglet('etapes');                                            /* bouton « Retour aux étapes » */
      const retour = [...document.querySelectorAll('#fc-detail .fc-pane.on')].map(p => p.getAttribute('data-fcpane'));
      return { actifs, panneau: vPanneau, champ: vChamp, retour, aBoutonRetour: !!(panneau && /Retour aux étapes/.test(panneau.textContent)) };
    });
    assert.deepEqual(r.actifs, ['pieces']);
    assert.equal(r.panneau, true, 'le panneau doit être visible');
    assert.equal(r.champ, true, 'le champ fichier doit être visible');
    assert.equal(r.aBoutonRetour, true);
    assert.deepEqual(r.retour, ['etapes']);
    assert.equal(app.etat.erreursPage.length, 0, app.etat.erreursPage.join('\n'));
  } finally { await app.fermer(); }
});
