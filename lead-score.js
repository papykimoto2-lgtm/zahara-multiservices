/* Scoring des leads — moteur pur (aucun DOM/réseau), testable sous Node, chargé tel quel par l'ERP.
   Score 0-100, EXPLIQUÉ : chaque point vient d'un critère nommé (lead.raisons). Aucun score n'est stocké :
   il se recalcule à l'affichage, donc toujours d'après les données du jour.
   Poids (total 100) :
     avancement 30 · fraîcheur 20 · budget 15 · source 15 · joignabilité 10 · suivi planifié 10
   Les poids sont des a priori métier, PAS appris : à recalibrer quand ≥ 50 dossiers sont clos (convertis/perdus).
   La part « source » seule est apprise des données (taux de conversion réel de la source, si ≥ 5 leads). */
(function (root) {
  'use strict';

  var POIDS = { avancement: 30, fraicheur: 20, budget: 15, source: 15, joignabilite: 10, suivi: 10 };
  var AVANCEMENT = { prospect: 0, contact: 8, visite: 16, visite_faite: 24, negociation: 30 };
  var SEUIL_CHAUD = 65, SEUIL_TIEDE = 40, MIN_SOURCE = 5, MS_JOUR = 86400000;
  var STADES = ['prospect', 'contact', 'visite', 'visite_faite', 'negociation', 'reservation'];

  function ts(d) { var t = Date.parse(d); return isNaN(t) ? null : t; }
  function num(x) { return parseFloat(x) || 0; }
  function arrondi(x) { return Math.round(x * 10) / 10; }
  function telOk(t) { var d = String(t || '').replace(/\D/g, ''); return d.length >= 8; }
  function ouvert(l) { return l && l.statut !== 'perdu' && l.statut !== 'converti' && l.stade !== 'reservation'; }

  /* Dernier mouvement connu : historique, sinon date de contact, sinon date d'entrée. */
  function dernierMouvement(l) {
    var c = [];
    if (Array.isArray(l.historique_stades) && l.historique_stades.length) c.push(ts(l.historique_stades[l.historique_stades.length - 1].date));
    c.push(ts(l.date_contact), ts(l.created_at));
    c = c.filter(function (x) { return x != null; });
    return c.length ? Math.max.apply(null, c) : null;
  }

  /* Contexte calculé UNE fois pour tous les leads : taux de conversion réel par source. */
  function contexte(leads, opts) {
    opts = opts || {};
    var par = {}, total = 0, conv = 0;
    (leads || []).forEach(function (l) {
      var k = l.source || '—', s = par[k] || (par[k] = { n: 0, c: 0 });
      s.n++; total++;
      if (l.stade === 'reservation' || l.statut === 'converti') { s.c++; conv++; }
    });
    return { tauxGlobal: total ? conv / total : 0, parSource: par, ticket: num(opts.ticket), prixProgramme: opts.prixProgramme || null };
  }

  function prixReference(l, ctx) {
    var p = ctx.prixProgramme && l.programme_id ? num(ctx.prixProgramme[l.programme_id]) : 0;
    return p > 0 ? p : ctx.ticket;
  }

  function niveau(score) { return score >= SEUIL_CHAUD ? 'chaud' : score >= SEUIL_TIEDE ? 'tiede' : 'froid'; }

  /* Score d'un lead. Retour : { score, niveau, raisons:[{critere,points,max,texte}], action, jours } — ou null si le lead est clos. */
  function scorer(l, ctx, now) {
    if (!ouvert(l)) return null;
    now = now || Date.now(); ctx = ctx || contexte([l]);
    var R = [], add = function (crit, pts, texte) { R.push({ critere: crit, points: arrondi(pts), max: POIDS[crit], texte: texte }); };

    // 1. Avancement
    var av = AVANCEMENT[l.stade] != null ? AVANCEMENT[l.stade] : 0;
    add('avancement', av, 'Stade : ' + (l.stade || 'prospect').replace(/_/g, ' '));

    // 2. Fraîcheur du dernier mouvement
    var dm = dernierMouvement(l), jours = dm == null ? null : Math.max(0, Math.floor((now - dm) / MS_JOUR)), fr;
    if (jours == null) { fr = 6; add('fraicheur', fr, 'Date du dernier contact inconnue'); }
    else {
      fr = jours <= 3 ? 20 : jours <= 7 ? 16 : jours <= 14 ? 9 : jours <= 30 ? 3 : 0;
      add('fraicheur', fr, jours === 0 ? 'Contact aujourd\'hui' : 'Dernier mouvement il y a ' + jours + ' j');
    }

    // 3. Budget face au prix du bien (un budget non renseigné vaut moins qu'un budget insuffisant connu : on ne sait pas)
    var b = num(l.budget), px = prixReference(l, ctx), bu, bt;
    if (!(b > 0)) { bu = 3; bt = 'Budget non qualifié'; }
    else if (!(px > 0)) { bu = 8; bt = 'Budget renseigné (prix de référence inconnu)'; }
    else { var q = b / px; bu = q >= 1 ? 15 : q >= 0.85 ? 11 : q >= 0.7 ? 7 : 2; bt = 'Budget = ' + Math.round(q * 100) + ' % du prix de référence'; }
    add('budget', bu, bt);

    // 4. Source : taux de conversion réel (≥ 5 leads), sinon neutre
    var s = ctx.parSource[l.source || '—'], so, st;
    if (s && s.n >= MIN_SOURCE && ctx.tauxGlobal > 0) {
      var rel = (s.c / s.n) / ctx.tauxGlobal;               // 1 = dans la moyenne
      so = Math.max(0, Math.min(15, 7.5 * rel)); st = 'Source convertissant à ' + Math.round(s.c / s.n * 100) + ' % (moyenne ' + Math.round(ctx.tauxGlobal * 100) + ' %)';
    } else { so = 7.5; st = 'Source : pas assez d\'historique (neutre)'; }
    add('source', so, st);

    // 5. Joignabilité / qualification
    var jo = 0; if (telOk(l.tel)) jo += 5; if (l.email) jo += 2; if (l.programme_id) jo += 2; if (l.commercial_id) jo += 1;
    add('joignabilite', jo, telOk(l.tel) ? 'Joignable' + (l.programme_id ? ', programme ciblé' : '') : 'Téléphone manquant ou invalide');

    // 6. Suivi planifié
    var su, sut, dr = l.date_relance ? ts(l.date_relance) : null;
    if (dr == null) { su = 0; sut = 'Aucune relance planifiée'; }
    else if (dr < now - MS_JOUR) { su = 2; sut = 'Relance en retard de ' + Math.floor((now - dr) / MS_JOUR) + ' j'; }
    else { su = 10; sut = 'Relance planifiée'; }
    add('suivi', su, sut);

    var score = Math.max(0, Math.min(100, Math.round(R.reduce(function (t, r) { return t + r.points; }, 0))));
    return { score: score, niveau: niveau(score), raisons: R, jours: jours, action: action(l, jours, dr, now, b, px) };
  }

  /* Prochaine action recommandée — une seule, la plus rentable. */
  function action(l, jours, dr, now, b, px) {
    if (!telOk(l.tel)) return 'Corriger le téléphone';
    if (dr != null && dr < now - MS_JOUR) return 'Relance en retard : appeler aujourd\'hui';
    if (l.stade === 'negociation') return jours != null && jours > 7 ? 'Relancer la négociation et proposer une date de signature' : 'Conclure : envoyer l\'offre et l\'échéancier';
    if (l.stade === 'visite_faite') return 'Relancer dans les 48 h après la visite : proposer la réservation';
    if (l.stade === 'visite') return 'Confirmer la visite (rappel la veille)';
    if (!(b > 0)) return 'Qualifier le budget et le mode de financement';
    if (l.stade === 'contact') return 'Proposer une visite du programme';
    if (jours != null && jours > 30) return 'Réactiver par WhatsApp ou clôturer (perdu avec motif)';
    return 'Premier appel de qualification';
  }

  /* Classement des leads ouverts : score décroissant, puis budget décroissant. */
  function classer(leads, ctx, now) {
    ctx = ctx || contexte(leads);
    return (leads || []).map(function (l) { var s = scorer(l, ctx, now); return s ? { lead: l, s: s } : null; }).filter(Boolean)
      .sort(function (a, b) { return b.s.score - a.s.score || num(b.lead.budget) - num(a.lead.budget); });
  }

  var API = { POIDS: POIDS, SEUIL_CHAUD: SEUIL_CHAUD, SEUIL_TIEDE: SEUIL_TIEDE, MIN_SOURCE: MIN_SOURCE, STADES: STADES,
              contexte: contexte, scorer: scorer, classer: classer, niveau: niveau, dernierMouvement: dernierMouvement };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.LeadScore = API;
})(typeof window !== 'undefined' ? window : globalThis);
