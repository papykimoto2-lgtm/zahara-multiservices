/* Mission foncière : pastille de visibilité côté intervenant (brouillon / annulée). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('la pastille signale qu\'un brouillon n\'est pas visible de l\'intervenant', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(() => {
    const t = s => fcPastilleMission({ statut: s }).replace(/<[^>]*>/g, '');
    return { brouillon: t('brouillon'), annulee: t('annulee'), envoyee: fcPastilleMission({ statut: 'envoyee' }), en_cours: fcPastilleMission({ statut: 'en_cours' }) };
  });
  assert.match(r.brouillon, /Brouillon — non visible de l'intervenant/);
  assert.match(r.annulee, /Annulée — retirée du portail/);
  assert.equal(r.envoyee, 'Envoyée'); assert.equal(r.en_cours, 'En cours');
  assert.equal(app.etat.erreursPage.length, 0, app.etat.erreursPage.join('\n'));
});
