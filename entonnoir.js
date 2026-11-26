/* Entonnoir commercial — moteur pur (aucun DOM/réseau), testable sous Node, chargé tel quel par l'ERP.
   Apport face à l'ancien graphique instantané :
   · HISTORIQUE des stades (lead.historique_stades) : le franchissement est mesuré, pas déduit du stade actuel ;
   · PERTES tracées (lead.statut = 'perdu', lead.perte = {stade, motif, date, par, note}) : où et pourquoi on perd ;
   · COHORTE : on suit les leads entrés sur la période, pas un instantané qui mélange les époques ;
   · SEGMENTS (source, commercial, programme), durée médiane par étape, goulot, scénario chiffré, leads dormants.
   Les leads anciens, sans historique, restent comptés d'après leur stade actuel et sont signalés « estimés ». */
(function (root) {
  'use strict';

  var STADES = ['prospect', 'contact', 'visite', 'visite_faite', 'negociation', 'reservation'];
  var LIBELLES = { prospect: 'Prospect', contact: 'Contact établi', visite: 'Visite planifiée', visite_faite: 'Visite effectuée', negociation: 'Négociation', reservation: 'Converti' };
  var MOTIFS = {
    prix: 'Prix trop élevé', budget: 'Budget insuffisant', financement: 'Financement refusé', concurrent: 'Parti chez un concurrent',
    injoignable: 'Injoignable', pas_interesse: 'Plus intéressé', localisation: 'Localisation', delai: 'Délai de livraison', autre: 'Autre'
  };
  var MIN_EFFECTIF = 5;      /* en dessous, un taux n'est pas fiable : affiché mais jamais désigné goulot */
  var DORMANT_JOURS = 14;
  var MS_JOUR = 86400000;

  function idx(s) { return STADES.indexOf(s); }
  function ts(d) { var t = Date.parse(d); return isNaN(t) ? null : t; }
  function iso(now) { return new Date(now).toISOString(); }
  function num(x) { return parseFloat(x) || 0; }

  /* ── Écriture ─────────────────────────────────────────────────────────── */
  /* Change le stade et trace le passage. Ne fait rien si le stade est inchangé. Retourne true si modifié. */
  function transition(lead, nouveau, now, par) {
    if (!lead || idx(nouveau) < 0 || lead.stade === nouveau) return false;
    if (!Array.isArray(lead.historique_stades) || !lead.historique_stades.length)
      lead.historique_stades = [{ stade: lead.stade && idx(lead.stade) >= 0 ? lead.stade : 'prospect', date: lead.created_at || lead.date_contact || null, par: 'initial' }];
    lead.historique_stades.push({ stade: nouveau, date: iso(now || Date.now()), par: par || '' });
    lead.stade = nouveau;
    return true;
  }
  /* Création d'un lead : première entrée de l'historique. */
  function initialiser(lead, now, par) {
    if (lead && !Array.isArray(lead.historique_stades))
      lead.historique_stades = [{ stade: idx(lead.stade) >= 0 ? lead.stade : 'prospect', date: iso(now || Date.now()), par: par || '' }];
    return lead;
  }
  function marquerPerdu(lead, motif, note, now, par) {
    if (!lead || !MOTIFS[motif]) return false;
    lead.perte = { stade: lead.stade, motif: motif, note: String(note || '').slice(0, 300), date: iso(now || Date.now()), par: par || '' };
    lead.statut = 'perdu';
    return true;
  }
  function rouvrir(lead) {
    if (!lead || lead.statut !== 'perdu') return false;
    lead.statut = 'actif'; lead.perte = null; return true;
  }

  /* ── Lecture ──────────────────────────────────────────────────────────── */
  function dateEntree(l) {
    var h = Array.isArray(l.historique_stades) && l.historique_stades[0];
    return ts(l.created_at) != null ? ts(l.created_at) : ts(l.date_contact) != null ? ts(l.date_contact) : h && ts(h.date);
  }
  function aHistorique(l) { return Array.isArray(l.historique_stades) && l.historique_stades.length > 0; }
  function estConverti(l) { return l.stade === 'reservation' || l.statut === 'converti'; }
  /* Rang le plus avancé réellement atteint. */
  function rangAtteint(l) {
    var m = Math.max(0, idx(l.stade));
    if (aHistorique(l)) l.historique_stades.forEach(function (h) { m = Math.max(m, idx(h.stade)); });
    if (estConverti(l)) m = STADES.length - 1;
    if (l.statut === 'perdu' && l.perte && idx(l.perte.stade) >= 0) m = Math.max(m, idx(l.perte.stade));
    return m;
  }
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /* Durée passée à chaque étape (jours), pour les leads dont les dates sont connues. */
  function dureesParEtape(leads, now) {
    var par = STADES.map(function () { return []; });
    leads.forEach(function (l) {
      if (!aHistorique(l)) return;
      var h = l.historique_stades;
      for (var i = 0; i < h.length; i++) {
        var a = ts(h[i].date), r = idx(h[i].stade);
        if (a == null || r < 0 || r === STADES.length - 1) continue;
        var b = i + 1 < h.length ? ts(h[i + 1].date) : (l.statut === 'perdu' && l.perte ? ts(l.perte.date) : estConverti(l) ? null : now);
        if (b == null || b < a) continue;
        par[r].push((b - a) / MS_JOUR);
      }
    });
    return par.map(function (a) { return { n: a.length, mediane: median(a) == null ? null : Math.round(median(a) * 10) / 10 }; });
  }

  function filtrer(leads, o) {
    var d = o.debut ? ts(o.debut) : null, f = o.fin ? ts(o.fin + 'T23:59:59') : null;
    return (leads || []).filter(function (l) {
      if (o.source && l.source !== o.source) return false;
      if (o.commercial_id && l.commercial_id !== o.commercial_id) return false;
      if (o.programme_id && l.programme_id !== o.programme_id) return false;
      var e = dateEntree(l);
      if (d != null && (e == null || e < d)) return false;
      if (f != null && (e == null || e > f)) return false;
      return true;
    });
  }

  function segments(leads, champ, min) {
    var m = {};
    leads.forEach(function (l) {
      var k = l[champ] || '—'; var s = m[k] || (m[k] = { cle: k, n: 0, convertis: 0, perdus: 0, valeur_convertie: 0 });
      s.n++; if (estConverti(l)) { s.convertis++; s.valeur_convertie += num(l.budget); } if (l.statut === 'perdu') s.perdus++;
    });
    return Object.keys(m).map(function (k) {
      var s = m[k]; s.taux = s.n ? Math.round(s.convertis / s.n * 1000) / 10 : 0; s.fiable = s.n >= (min || MIN_EFFECTIF); return s;
    }).sort(function (a, b) { return (b.fiable - a.fiable) || (b.taux - a.taux) || (b.n - a.n); });
  }

  /* Analyse complète d'une cohorte. */
  function analyser(leads, opts, now) {
    opts = opts || {}; now = now || Date.now();
    var min = opts.minEffectif || MIN_EFFECTIF;
    var c = filtrer(leads, opts), N = STADES.length;
    var atteint = STADES.map(function () { return 0; }), pertesEtape = STADES.map(function () { return 0; }), estimes = 0;
    var perdus = [], motifs = {};
    c.forEach(function (l) {
      var r = rangAtteint(l);
      for (var i = 0; i <= r; i++) atteint[i]++;
      if (!aHistorique(l)) estimes++;
      if (l.statut === 'perdu') {
        perdus.push(l);
        var pe = l.perte && idx(l.perte.stade) >= 0 ? idx(l.perte.stade) : r;
        pertesEtape[pe]++;
        var mk = l.perte && MOTIFS[l.perte.motif] ? l.perte.motif : 'non_renseigne';
        var o = motifs[mk] || (motifs[mk] = { motif: mk, libelle: MOTIFS[mk] || 'Non renseigné', n: 0, valeur: 0 }); o.n++; o.valeur += num(l.budget);
      }
    });
    var etapes = STADES.map(function (s, i) {
      var prev = i ? atteint[i - 1] : null;
      return { stade: s, libelle: LIBELLES[s], atteint: atteint[i], taux_etape: i && prev ? Math.round(atteint[i] / prev * 1000) / 10 : (i ? 0 : 100),
               perdus: pertesEtape[i], fiable: i === 0 || prev >= min };
    });
    var goulot = null;
    etapes.forEach(function (e, i) { if (i && e.fiable && (goulot == null || e.taux_etape < etapes[goulot].taux_etape)) goulot = i; });
    var ticket = num(opts.ticket) || null;
    var scenario = null;
    if (goulot != null && atteint[0] > 0) {
      var gain = opts.gainPoints || 10, taux = etapes[goulot].taux_etape / 100, tauxNouv = Math.min(1, taux + gain / 100);
      var fin = atteint[N - 1], extra = taux > 0 ? Math.round(fin * (tauxNouv / taux - 1) * 10) / 10 : Math.round(atteint[goulot - 1] * gain / 100 * 10) / 10;
      scenario = { etape: etapes[goulot].libelle, gain_points: gain, ventes_en_plus: extra, valeur_en_plus: ticket ? Math.round(extra * ticket) : null };
    }
    return {
      total: c.length, estimes: estimes, estimes_part: c.length ? Math.round(estimes / c.length * 100) : 0,
      etapes: etapes, conversion_globale: atteint[0] ? Math.round(atteint[N - 1] / atteint[0] * 1000) / 10 : 0,
      perdus: perdus.length, valeur_perdue: perdus.reduce(function (t, l) { return t + num(l.budget); }, 0),
      motifs: Object.keys(motifs).map(function (k) { return motifs[k]; }).sort(function (a, b) { return b.n - a.n; }),
      sans_motif: perdus.filter(function (l) { return !(l.perte && MOTIFS[l.perte.motif]); }).length,
      durees: dureesParEtape(c, now), goulot: goulot == null ? null : etapes[goulot].stade, scenario: scenario,
      par_source: segments(c, 'source', min), par_commercial: segments(c, 'commercial_id', min), par_programme: segments(c, 'programme_id', min)
    };
  }

  /* Leads ouverts sans mouvement depuis N jours : l'argent qui dort. Triés par budget. */
  function dormants(leads, now, jours) {
    now = now || Date.now(); var lim = (jours || DORMANT_JOURS) * MS_JOUR;
    return (leads || []).filter(function (l) { return l.statut !== 'perdu' && !estConverti(l); }).map(function (l) {
      var h = aHistorique(l) ? ts(l.historique_stades[l.historique_stades.length - 1].date) : null;
      var cand = [h, dateEntree(l)].filter(function (x) { return x != null; });
      var dernier = cand.length ? Math.max.apply(null, cand) : null;
      return { lead: l, jours: dernier ? Math.floor((now - dernier) / MS_JOUR) : null };
    }).filter(function (x) { return x.jours != null && x.jours * MS_JOUR >= lim; })
      .sort(function (a, b) { return num(b.lead.budget) - num(a.lead.budget) || b.jours - a.jours; });
  }

  var API = { STADES: STADES, LIBELLES: LIBELLES, MOTIFS: MOTIFS, MIN_EFFECTIF: MIN_EFFECTIF, DORMANT_JOURS: DORMANT_JOURS,
              transition: transition, initialiser: initialiser, marquerPerdu: marquerPerdu, rouvrir: rouvrir,
              rangAtteint: rangAtteint, analyser: analyser, dormants: dormants, dureesParEtape: dureesParEtape };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Entonnoir = API;
})(typeof window !== 'undefined' ? window : globalThis);
