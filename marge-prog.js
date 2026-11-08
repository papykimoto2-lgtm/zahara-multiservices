/* Santé des marges par programme — moteur pur (aucun DOM/réseau), testable sous Node.
   Entrée : le résumé chiffré d'un programme (issu de bpCompute) ; sortie : statut, fiabilité des données, prix plancher.
   Principe : une marge flatteuse sur des coûts MANQUANTS est pire qu'une marge faible. On signale donc d'abord ce qui
   rend la marge non fiable, puis seulement on juge la marge. */
(function (root) {
  'use strict';
  var CIBLE_DEFAUT = 15;   /* % de marge visée sur le potentiel, réglable via params.marge_cible_pct */

  function num(x) { return parseFloat(x) || 0; }
  function pct(a, b) { return b > 0 ? a / b * 100 : null; }
  function r1(x) { return Math.round(x * 10) / 10; }

  /* r : { produitsEngages, produitsPotentiel, couts, margePot, caRestant, nbLotsRestants, coutFoncier, coutTravaux, foncierLie,
           programmeConstruction, nbLogements, nbLotsSansPrix, coutCommercial, commissionsAVenir, encaisse, nbCommissions } */
  function evaluer(r, cible) {
    cible = cible == null ? CIBLE_DEFAUT : num(cible);
    var manques = [];
    if (!r.foncierLie || num(r.coutFoncier) <= 0) manques.push({ k: 'foncier', t: 'Coût du foncier absent (aucune parcelle liée ou prix d\'acquisition à 0)' });
    if (r.programmeConstruction && r.nbLogements > 0 && num(r.coutTravaux) <= 0) manques.push({ k: 'travaux', t: 'Aucun marché de travaux rattaché alors que le programme compte des logements' });
    if (r.nbLotsSansPrix > 0) manques.push({ k: 'prix', t: r.nbLotsSansPrix + ' lot(s) sans prix : le potentiel est sous-estimé' });
    if (num(r.encaisse) > 0 && !(r.nbCommissions > 0)) manques.push({ k: 'commissions', t: 'Des encaissements existent mais aucune commission n\'est rattachée au programme' });

    var taux = pct(num(r.margePot), num(r.produitsPotentiel));
    var margeNette = r.commissionsAVenir != null ? num(r.margePot) - num(r.commissionsAVenir) : null;
    var tauxNet = margeNette != null ? pct(margeNette, num(r.produitsPotentiel)) : null;
    var ref = tauxNet != null ? tauxNet : taux;
    var statut = ref == null ? 'inconnu' : num(r.margePot) < 0 || ref < 0 ? 'rouge' : ref < cible ? 'orange' : 'vert';

    /* Prix plancher : prix moyen minimal des lots restants pour tenir la marge cible sur toute l'opération. */
    var plancher = null;
    if (r.nbLotsRestants > 0 && num(r.couts) > 0 && cible < 100) {
      var requis = num(r.couts) / (1 - cible / 100), reste = requis - num(r.produitsEngages), parLot = reste / r.nbLotsRestants, actuel = num(r.caRestant) / r.nbLotsRestants;
      plancher = { prix_moyen_min: Math.max(0, Math.round(parLot)), prix_moyen_actuel: Math.round(actuel),
                   remise_max_pct: actuel > 0 ? r1((1 - Math.max(0, parLot) / actuel) * 100) : null, deja_insuffisant: actuel > 0 && parLot > actuel };
    }
    return { statut: statut, taux_pot: taux == null ? null : r1(taux), taux_net: tauxNet == null ? null : r1(tauxNet), marge_nette: margeNette,
             cible: cible, manques: manques, fiable: manques.length === 0, plancher: plancher };
  }

  /* Tri d'attention : rouge d'abord, puis orange, puis non fiables, puis les moins marginaux. */
  var ORDRE = { rouge: 0, orange: 1, inconnu: 2, vert: 3 };
  function classer(lignes) {
    return lignes.slice().sort(function (a, b) {
      return (ORDRE[a.e.statut] - ORDRE[b.e.statut]) || ((a.e.fiable ? 1 : 0) - (b.e.fiable ? 1 : 0)) || ((a.e.taux_pot == null ? 999 : a.e.taux_pot) - (b.e.taux_pot == null ? 999 : b.e.taux_pot));
    });
  }

  var API = { CIBLE_DEFAUT: CIBLE_DEFAUT, evaluer: evaluer, classer: classer };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MargeProg = API;
})(typeof window !== 'undefined' ? window : globalThis);
