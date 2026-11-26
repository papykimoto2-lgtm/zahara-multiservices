/* Trésorerie prévisionnelle à 13 semaines — moteur pur (aucun DOM/réseau), testable sous Node.
   Principes (aucune donnée inventée) :
   · ENTRÉES = échéances contractuelles des souscripteurs × taux de recouvrement RÉEL des 90 derniers jours ;
   · SORTIES = rythme réel des décaissements de trésorerie des 90 derniers jours, par catégorie :
       paie / impôts / emprunts → montant mensuel moyen posé au jour du mois habituel (pics visibles) ;
       fournisseurs / autres    → étalés à la semaine ;
       investissements          → exclus du rythme (ponctuels) : à saisir en ligne manuelle ;
   · LIGNES MANUELLES (unique, hebdomadaire, mensuelle, avec probabilité) pour tout engagement connu ;
   · 3 scénarios (prudent / base / optimiste) qui ne jouent que sur le recouvrement et le rythme des sorties diffuses.
   C'est une projection de ce qui se passe SI le comportement des 90 derniers jours se répète, pas une prévision certaine. */
(function (root) {
  'use strict';

  var MS_JOUR = 86400000, SEMAINES = 13;
  var CATEGORIES = { paie: 'Paie et charges sociales', impots: 'Impôts et taxes', emprunts: 'Remboursement d\'emprunts', fournisseurs: 'Fournisseurs et chantiers', autres: 'Autres charges', manuel: 'Lignes manuelles' };
  var MENSUELLES = { paie: 1, impots: 1, emprunts: 1 };   /* catégories posées au jour du mois habituel */
  var SCENARIOS = {
    prudent:    { label: 'Prudent',    recouvrement: 0.8, sorties: 1.1 },
    base:       { label: 'Base',       recouvrement: 1.0, sorties: 1.0 },
    optimiste:  { label: 'Optimiste',  recouvrement: 1.1, sorties: 0.95 }
  };

  function ts(d) { var t = typeof d === 'number' ? d : Date.parse(String(d).length === 10 ? d + 'T12:00:00' : d); return isNaN(t) ? null : t; }
  function jourDe(t) { var d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime(); }
  function iso(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate(); }
  function num(x) { return parseFloat(x) || 0; }
  function r0(x) { return Math.round(x); }
  function mediane(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function joursMois(a, m) { return new Date(a, m + 1, 0).getDate(); }

  /* Préfixes par catégorie. Le plan comptable de l'ERP range le personnel en 64x (et les intérêts en 661) ;
     un plan SYSCOHADA strict le range en 66x : surcharge possible via params.treso_prev_prefixes. */
  var PREFIXES = { paie: ['42', '43', '64'], impots: ['44', '89'], emprunts: ['16', '17', '661', '67'], investissement: ['2'], fournisseurs: ['40', '60', '61', '62'] };
  /* Classe une contrepartie comptable (compte débité lors d'un décaissement) en catégorie de sortie. */
  function categorieDe(compte, prefixes) {
    var c = String(compte || ''), P = prefixes || PREFIXES, ordre = ['paie', 'impots', 'emprunts', 'investissement', 'fournisseurs'];
    for (var i = 0; i < ordre.length; i++) { var l = P[ordre[i]] || []; for (var j = 0; j < l.length; j++) if (c.indexOf(l[j]) === 0) return ordre[i]; }
    return 'autres';
  }

  /* Profil des sorties à partir de l'historique : hist = [{date, montant, cat}] (montants positifs = argent sorti). */
  function profilSorties(hist, now, jours) {
    jours = jours || 90;
    var fin = jourDe(now), debut = fin - jours * MS_JOUR, par = {};
    (hist || []).forEach(function (h) {
      var t = ts(h.date); if (t == null || t < debut || t > fin + MS_JOUR) return;
      var c = h.cat || 'autres'; if (c === 'investissement') return;
      var o = par[c] || (par[c] = { total: 0, n: 0, jours: [] }); o.total += num(h.montant); o.n++; o.jours.push(new Date(t).getDate());
    });
    var mois = jours / 30.4375, out = {};
    Object.keys(par).forEach(function (c) {
      var o = par[c]; if (!(o.total > 0)) return;
      out[c] = { mode: MENSUELLES[c] ? 'mensuel' : 'diffus', mensuel: o.total / mois, hebdo: o.total / (jours / 7), jour: Math.round(mediane(o.jours) || 28), n: o.n };
    });
    return out;
  }

  /* Taux de recouvrement réel : encaissé / dû théorique sur la même période et le même périmètre. */
  function tauxRecouvrement(encaisse, theorique, defaut) {
    if (!(theorique > 0)) return { taux: defaut == null ? 0.7 : defaut, mesure: false };
    return { taux: Math.max(0, Math.min(1.2, encaisse / theorique)), mesure: true };
  }

  /* Échéances d'un souscripteur dans l'horizon : jour du mois d'ancrage, mensualité, plafonné au reste à payer. */
  function echeancesClient(c, now, semaines) {
    var out = [], fin = jourDe(now) + semaines * 7 * MS_JOUR, a = ts(c.ancre); if (a == null || !(c.mensualite > 0)) return out;
    var jour = new Date(a).getDate(), d0 = new Date(jourDe(now)), reste = Math.max(0, num(c.reste));
    for (var k = 0; k <= semaines / 4 + 2; k++) {
      var y = d0.getFullYear(), m = d0.getMonth() + k, dt = new Date(y, m, Math.min(jour, joursMois(y, m)), 12).getTime();
      if (dt < jourDe(now) || dt >= fin || dt < a) continue;
      var montant = Math.min(c.mensualite, reste); if (montant <= 0) break;
      out.push({ date: iso(dt), montant: montant, client_id: c.client_id }); reste -= montant;
    }
    return out;
  }

  function semaineDe(t, debut) { var i = Math.floor((jourDe(t) - debut) / (7 * MS_JOUR)); return i; }

  /* Occurrences d'une ligne manuelle dans l'horizon. */
  function occurrences(l, debut, fin) {
    var t = ts(l.date), out = [], proba = l.proba == null ? 1 : Math.max(0, Math.min(1, num(l.proba)));
    if (t == null || !(num(l.montant) > 0)) return out;
    var stop = l.fin ? ts(l.fin) : null, rec = l.recurrence || 'unique';
    if (rec === 'unique') { if (t >= debut && t < fin) out.push(t); }
    else if (rec === 'hebdo') { for (var x = t; x < fin; x += 7 * MS_JOUR) if (x >= debut && (stop == null || x <= stop)) out.push(x); }
    else if (rec === 'mensuel') {
      var d = new Date(t), jr = d.getDate();
      for (var k = 0; k < 40; k++) { var y = d.getFullYear(), m = d.getMonth() + k, x2 = new Date(y, m, Math.min(jr, joursMois(y, m)), 12).getTime();
        if (x2 >= fin) break; if (x2 >= debut && (stop == null || x2 <= stop)) out.push(x2); }
    }
    return out.map(function (x) { return { t: x, montant: num(l.montant) * proba }; });
  }

  /* Projection hebdomadaire.
     e : { now, soldeInitial, echeances:[{date,montant}], tauxRecouvrement, profil, manuels:[{date,libelle,sens,montant,recurrence,fin,proba}], scenario, seuil, semaines } */
  function projeter(e) {
    var N = e.semaines || SEMAINES, sc = SCENARIOS[e.scenario || 'base'] || SCENARIOS.base;
    var debut = jourDe(e.now), fin = debut + N * 7 * MS_JOUR, S = [];
    for (var i = 0; i < N; i++) S.push({ i: i + 1, debut: iso(debut + i * 7 * MS_JOUR), fin: iso(debut + (i * 7 + 6) * MS_JOUR), clients: 0, manuel_in: 0, sorties: {}, manuel_out: 0 });
    var taux = (e.tauxRecouvrement == null ? 0.7 : e.tauxRecouvrement) * sc.recouvrement;
    (e.echeances || []).forEach(function (x) { var t = ts(x.date); if (t == null) return; var w = semaineDe(t, debut); if (w >= 0 && w < N) S[w].clients += num(x.montant) * taux; });
    var prof = e.profil || {};
    Object.keys(prof).forEach(function (c) {
      var p = prof[c];
      if (p.mode === 'diffus') for (var w = 0; w < N; w++) S[w].sorties[c] = (S[w].sorties[c] || 0) + p.hebdo * sc.sorties;
      else {
        var d0 = new Date(debut);
        for (var k = 0; k < Math.ceil(N / 4) + 2; k++) {
          var y = d0.getFullYear(), m = d0.getMonth() + k, t = new Date(y, m, Math.min(p.jour, joursMois(y, m)), 12).getTime(), w2 = semaineDe(t, debut);
          if (t >= debut && w2 >= 0 && w2 < N) S[w2].sorties[c] = (S[w2].sorties[c] || 0) + p.mensuel * (c === 'paie' ? 1 : sc.sorties);
        }
      }
    });
    (e.manuels || []).forEach(function (l) {
      occurrences(l, debut, fin).forEach(function (o) { var w = semaineDe(o.t, debut); if (w < 0 || w >= N) return; if (l.sens === 'entree') S[w].manuel_in += o.montant; else S[w].manuel_out += o.montant; });
    });
    var solde = num(e.soldeInitial), min = { solde: solde, semaine: 0 }, premierNegatif = null, seuil = num(e.seuil);
    S.forEach(function (s) {
      s.entrees = s.clients + s.manuel_in;
      s.total_sorties = Object.keys(s.sorties).reduce(function (t, c) { return t + s.sorties[c]; }, 0) + s.manuel_out;
      s.net = s.entrees - s.total_sorties; solde += s.net; s.solde = solde;
      if (s.solde < min.solde) min = { solde: s.solde, semaine: s.i };
      if (premierNegatif == null && s.solde < 0) premierNegatif = s.i;
    });
    var cumulSorties = S.reduce(function (t, s) { return t + s.total_sorties; }, 0), cumulEntrees = S.reduce(function (t, s) { return t + s.entrees; }, 0);
    var brulure = cumulSorties - cumulEntrees;           /* > 0 : on consomme du cash sur l'horizon */
    return {
      scenario: e.scenario || 'base', taux: taux, semaines: S, solde_initial: num(e.soldeInitial), solde_final: solde,
      solde_min: min.solde, semaine_min: min.semaine, premier_negatif: premierNegatif,
      entrees: cumulEntrees, sorties: cumulSorties, besoin: Math.max(0, seuil - min.solde),
      autonomie_semaines: brulure > 0 && e.soldeInitial > 0 ? Math.floor(e.soldeInitial / (brulure / N)) : null
    };
  }

  function comparer(e) {
    var out = {}; Object.keys(SCENARIOS).forEach(function (k) { out[k] = projeter(Object.assign({}, e, { scenario: k })); }); return out;
  }

  /* Messages d'alerte priorisés pour la direction. */
  function alertes(p, seuil) {
    var a = [];
    if (p.premier_negatif) a.push({ niveau: 'rouge', texte: 'Trésorerie négative dès la semaine ' + p.premier_negatif + ' (' + p.semaines[p.premier_negatif - 1].debut + ') : creux de ' + r0(p.solde_min) + ' F.' });
    else if (seuil > 0 && p.solde_min < seuil) a.push({ niveau: 'orange', texte: 'Le solde passe sous le seuil de sécurité (' + r0(seuil) + ' F) en semaine ' + p.semaine_min + '.' });
    if (p.autonomie_semaines != null && p.autonomie_semaines < 13) a.push({ niveau: p.autonomie_semaines < 8 ? 'rouge' : 'orange', texte: 'Au rythme prévu, la trésorerie couvre ' + p.autonomie_semaines + ' semaine(s) de dépenses nettes.' });
    return a;
  }

  var API = { PREFIXES: PREFIXES, SEMAINES: SEMAINES, CATEGORIES: CATEGORIES, SCENARIOS: SCENARIOS, categorieDe: categorieDe, profilSorties: profilSorties, tauxRecouvrement: tauxRecouvrement,
              echeancesClient: echeancesClient, occurrences: occurrences, projeter: projeter, comparer: comparer, alertes: alertes };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.TresoPrev = API;
})(typeof window !== 'undefined' ? window : globalThis);
