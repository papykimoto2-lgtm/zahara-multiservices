/* Prix dynamique des lots — moteur pur (aucun DOM/réseau), testable sous Node, chargé tel quel par l'ERP.
   Il PROPOSE, il n'applique jamais : un responsable valide lot par lot.
   Principes :
   · une baisse n'est jamais proposée sous le PLANCHER de marge (coût de revient du lot, sinon plancher du programme) ;
     sans plancher fiable, la baisse est bloquée (« plancher inconnu ») ;
   · lots réservés ou vendus : jamais touchés ;
   · pas de promesse de volume : l'élasticité du marché n'est pas connue. Chaque changement est un TEST à mesurer sur 30 jours ;
   · le signal vient de vos ventes : rythme sur 90 jours, mois de stock, prospects chauds par lot disponible.
   Données : programmes, lots {id, programme_id, prix, cout_revient, statut, created_at, surface, prix_mode},
   clients {lot_id, programme_id, date_souscription, statut}, leads {programme_id, stade, statut},
   planchers {programme_id: {prix_moyen_min, prix_moyen_actuel, fiable}}. */
(function (root) {
  'use strict';

  var MS_JOUR = 86400000;
  var DEFAUT = { pas_pct: 5, mois_stock_baisse: 12, mois_stock_hausse: 2, min_ventes_hausse: 3, pression_hausse: 1, pression_baisse: 0.3, arrondi: 50000, lot_ancien_j: 180, cible_pct: 15 };

  function ts(d) { var t = Date.parse(String(d || '').length === 10 ? d + 'T12:00:00' : d); return isNaN(t) ? null : t; }
  function num(x) { return parseFloat(x) || 0; }
  function cfg(p) { var o = Object.assign({}, DEFAUT, p || {}); Object.keys(DEFAUT).forEach(function (k) { o[k] = num(o[k]) > 0 ? num(o[k]) : DEFAUT[k]; }); o.pas_pct = Math.min(o.pas_pct, 20); return o; }
  function arrondir(x, pas, vers) { var q = x / pas; return Math.round((vers === 'haut' ? Math.ceil(q - 1e-9) : vers === 'bas' ? Math.floor(q + 1e-9) : Math.round(q)) * pas); }
  function chaud(l) { return l.statut !== 'perdu' && l.statut !== 'converti' && (l.stade === 'visite' || l.stade === 'visite_faite' || l.stade === 'negociation'); }

  /* Plancher d'un lot : coût de revient / (1 − cible), sinon plancher du programme proportionnel au prix du lot, sinon inconnu. */
  function plancherLot(lot, pl, P) {
    if (num(lot.cout_revient) > 0) return { valeur: Math.ceil(num(lot.cout_revient) / (1 - P.cible_pct / 100)), source: 'cout_lot' };
    if (pl && pl.fiable && num(pl.prix_moyen_actuel) > 0 && num(pl.prix_moyen_min) > 0) return { valeur: Math.ceil(num(lot.prix) * num(pl.prix_moyen_min) / num(pl.prix_moyen_actuel)), source: 'programme' };
    return { valeur: null, source: 'inconnu' };
  }

  /* i : { programmes, lots, clients, leads, planchers, params, now } */
  function analyser(i) {
    var P = cfg(i.params), now = i.now || Date.now(), d90 = now - 90 * MS_JOUR, d180 = now - 180 * MS_JOUR;
    var lots = i.lots || [], clients = i.clients || [], leads = i.leads || [], planchers = i.planchers || {};
    var res = (i.programmes || []).filter(function (p) { return p.statut !== 'archive'; }).map(function (p) {
      var L = lots.filter(function (l) { return l.programme_id === p.id; }), dispo = L.filter(function (l) { return l.statut === 'disponible' && num(l.prix) > 0; });
      var v90 = 0, vPrec = 0;
      clients.forEach(function (c) { if (c.programme_id !== p.id || c.statut === 'resilie') return; var t = ts(c.date_souscription); if (t == null) return; if (t >= d90) v90++; else if (t >= d180) vPrec++; });
      var moisStock = v90 > 0 ? dispo.length / (v90 / 3) : (dispo.length > 0 ? Infinity : 0);
      var chauds = leads.filter(function (l) { return l.programme_id === p.id && chaud(l); }).length, pression = dispo.length ? chauds / dispo.length : 0;
      var pl = planchers[p.id] || null, tendance = v90 > vPrec ? 'hausse' : v90 < vPrec ? 'baisse' : 'stable';
      var action = 'maintien', raison = 'Rythme et demande dans la normale : ne rien changer.', sens = 0;

      if (!dispo.length) { action = 'aucun'; raison = 'Aucun lot disponible.'; }
      else if (v90 >= P.min_ventes_hausse && moisStock <= P.mois_stock_hausse && pression >= P.pression_hausse) {
        action = 'hausse'; sens = 1; raison = v90 + ' ventes en 90 jours, ' + (Math.round(moisStock * 10) / 10) + ' mois de stock et ' + chauds + ' prospect(s) chaud(s) pour ' + dispo.length + ' lot(s) : la demande dépasse l\'offre.';
      } else if (moisStock >= P.mois_stock_baisse && pression < P.pression_baisse) {
        action = 'baisse'; sens = -1; raison = (moisStock === Infinity ? 'Aucune vente en 90 jours' : Math.round(moisStock) + ' mois de stock au rythme actuel') + ' et peu de prospects chauds (' + chauds + ') : le prix ou le produit freine la vente.';
      }

      var propositions = [], impact = 0, bloques = 0;
      if (sens !== 0) {
        var cands = sens > 0 ? dispo : dispo.filter(function (l) { var t = ts(l.created_at); return t == null || t <= now - P.lot_ancien_j * MS_JOUR; });
        cands.forEach(function (l) {
          var prix = num(l.prix), brut = prix * (1 + sens * P.pas_pct / 100), plan = plancherLot(l, pl, P), sug, blocage = null;
          if (sens > 0) sug = arrondir(brut, P.arrondi, 'bas');
          else {
            if (plan.valeur == null) { blocage = 'plancher_inconnu'; sug = prix; }
            else { sug = Math.max(arrondir(brut, P.arrondi, 'haut'), arrondir(plan.valeur, P.arrondi, 'haut')); if (sug >= prix) { blocage = 'plancher'; sug = prix; } }
          }
          if (!blocage && sug === prix) return;                                    /* variation inférieure au pas d'arrondi */
          if (blocage) bloques++;
          else impact += sug - prix;
          propositions.push({ lot: l, prix: prix, suggere: sug, delta: sug - prix, delta_pct: Math.round((sug - prix) / prix * 1000) / 10, plancher: plan.valeur, source_plancher: plan.source, blocage: blocage });
        });
        if (sens < 0 && propositions.length && propositions.every(function (x) { return x.blocage; })) { action = 'bloque'; raison += ' Mais aucune baisse n\'est possible sans passer sous le plancher de marge ou faute de plancher fiable : agir sur le coût, le financement ou le produit.'; }
      }
      return { programme: p, stock: dispo.length, ventes_90j: v90, ventes_prec_90j: vPrec, tendance: tendance, mois_stock: moisStock === Infinity ? null : Math.round(moisStock * 10) / 10, sans_vente: moisStock === Infinity,
        chauds: chauds, pression: Math.round(pression * 100) / 100, action: action, raison: raison, propositions: propositions, impact: Math.round(impact), bloques: bloques, plancher_fiable: !!(pl && pl.fiable) };
    });
    var ordre = { hausse: 0, baisse: 1, bloque: 2, maintien: 3, aucun: 4 };
    res.sort(function (a, b) { return (ordre[a.action] - ordre[b.action]) || (Math.abs(b.impact) - Math.abs(a.impact)); });
    return { cfg: P, programmes: res, total: { hausses: res.filter(function (r) { return r.action === 'hausse'; }).length, baisses: res.filter(function (r) { return r.action === 'baisse'; }).length,
      bloques: res.filter(function (r) { return r.action === 'bloque'; }).length, impact: res.reduce(function (t, r) { return t + r.impact; }, 0) } };
  }

  /* Applique une proposition à un lot (mutation) et trace l'historique. Refuse tout lot non disponible ou prix déjà changé. */
  function appliquer(lot, prop, now, par, motif) {
    if (!lot || lot.statut !== 'disponible') return { ok: false, raison: 'lot_non_disponible' };
    if (num(lot.prix) !== prop.prix) return { ok: false, raison: 'prix_modifie' };
    if (!(prop.suggere > 0) || prop.blocage) return { ok: false, raison: 'proposition_invalide' };
    lot.prix_historique = (lot.prix_historique || []).concat([{ date: new Date(now || Date.now()).toISOString().slice(0, 10), ancien: prop.prix, nouveau: prop.suggere, motif: String(motif || '').slice(0, 200), par: par || '' }]);
    lot.prix = prop.suggere;
    if (lot.prix_mode === 'm2' && num(lot.surface) > 0) lot.prix_m2 = Math.round(prop.suggere / num(lot.surface));
    return { ok: true };
  }

  var API = { DEFAUT: DEFAUT, cfg: cfg, plancherLot: plancherLot, analyser: analyser, appliquer: appliquer };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PrixDynamique = API;
})(typeof window !== 'undefined' ? window : globalThis);
