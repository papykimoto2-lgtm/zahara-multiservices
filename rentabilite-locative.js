/* Rentabilité locative — moteur pur (aucun DOM/réseau), testable sous Node, chargé tel quel par l'ERP.
   Répond à : quels biens perdent de l'argent, combien, et que faire ? Tout est calculé sur les 12 derniers mois
   à partir des baux, quittances et ordres de travaux. Aucun montant n'est inventé : une alerte sans base chiffrée
   n'affiche pas de montant (par exemple une révision sans taux saisi).
   Données : biens {id, designation|ref, loyer, surface, commune, type, statut, disponible_le, created_at},
   baux {bien_id, statut:'actif'|'preavis'|'resilie', loyer, debut, fin, date_resiliation, derniere_revision},
   quittances {bail_id, periode, loyer, total, regle, commission, echeance},
   travaux {bail_id|bien_id, statut, cout_reel, date_fin, imputation}. */
(function (root) {
  'use strict';

  var MS_JOUR = 86400000, MOIS = 30.4375;
  var DEFAUT = { seuil_vacance_j: 30, seuil_recouvrement_pct: 80, seuil_entretien_pct: 15, seuil_sous_location_pct: 15, fin_bail_j: 90, taux_revision_pct: null };

  function ts(d) { var t = Date.parse(String(d || '').length === 10 ? d + 'T12:00:00' : d); return isNaN(t) ? null : t; }
  function num(x) { return parseFloat(x) || 0; }
  function r0(x) { return Math.round(x); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function cfg(p) { var o = Object.assign({}, DEFAUT, p || {}); Object.keys(DEFAUT).forEach(function (k) { if (k !== 'taux_revision_pct') o[k] = num(o[k]) || DEFAUT[k]; }); o.taux_revision_pct = p && p.taux_revision_pct != null && p.taux_revision_pct !== '' && !isNaN(parseFloat(p.taux_revision_pct)) ? parseFloat(p.taux_revision_pct) : null; return o; }
  function nomBien(b) { return b.designation || b.ref || b.id; }
  function mediane(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  /* Jours occupés dans [debut, fin] : union des périodes de bail (un bail actif court jusqu'à aujourd'hui, même passé sa date de fin : reconduction tacite). */
  function joursOccupes(baux, debut, fin, now) {
    var iv = [];
    baux.forEach(function (b) {
      if (b.statut !== 'actif' && b.statut !== 'preavis' && b.statut !== 'resilie') return;
      var d = ts(b.debut); if (d == null) return;
      var f = b.statut === 'actif' ? now : (ts(b.date_resiliation) != null ? ts(b.date_resiliation) : ts(b.fin));
      if (f == null) f = b.statut === 'preavis' ? now : d;
      if (b.statut === 'preavis' && ts(b.fin) != null) f = Math.max(ts(b.fin), now > ts(b.fin) ? ts(b.fin) : now);
      var a = Math.max(d, debut), z = Math.min(f, fin); if (z > a) iv.push([a, z]);
    });
    iv.sort(function (x, y) { return x[0] - y[0]; });
    var tot = 0, cur = null;
    iv.forEach(function (p) { if (!cur) cur = p.slice(); else if (p[0] <= cur[1]) cur[1] = Math.max(cur[1], p[1]); else { tot += cur[1] - cur[0]; cur = p.slice(); } });
    if (cur) tot += cur[1] - cur[0];
    return Math.round(tot / MS_JOUR);
  }

  /* i : { biens, baux, quittances, travaux, params, now } */
  function analyser(i) {
    var P = cfg(i.params), now = i.now || Date.now(), debut12 = now - 365 * MS_JOUR;
    var baux = i.baux || [], parBail = {}; baux.forEach(function (b) { parBail[b.id] = b; });
    var biens = (i.biens || []).filter(function (b) { return b.statut !== 'retire'; });

    /* Références de loyer au m² par (commune, type) : médiane du parc. */
    var groupes = {};
    biens.forEach(function (b) { if (num(b.surface) > 0 && num(b.loyer) > 0) { var k = (b.commune || '') + '|' + (b.type || ''); (groupes[k] = groupes[k] || []).push(num(b.loyer) / num(b.surface)); } });

    var lignes = biens.map(function (b) {
      var bx = baux.filter(function (x) { return x.bien_id === b.id; }), ids = {}; bx.forEach(function (x) { ids[x.id] = true; });
      var debutFen = Math.max(debut12, ts(b.created_at) != null ? ts(b.created_at) : debut12);
      var fenetre = Math.max(1, Math.round((now - debutFen) / MS_JOUR));
      var occ = Math.min(fenetre, joursOccupes(bx, debutFen, now, now)), vac = fenetre - occ;
      var actif = bx.filter(function (x) { return x.statut === 'actif' || x.statut === 'preavis'; })[0] || null;
      var loyerRef = actif ? num(actif.loyer) : num(b.loyer) || num(bx.slice(-1)[0] && bx.slice(-1)[0].loyer);
      var enTravaux = b.statut === 'travaux';

      /* Vacance courante : depuis la fin du dernier bail, sinon depuis la mise en disponibilité, sinon depuis la création. */
      var vacCour = 0;
      if (!actif && !enTravaux) {
        var fins = bx.map(function (x) { return x.statut === 'resilie' ? (ts(x.date_resiliation) != null ? ts(x.date_resiliation) : ts(x.fin)) : null; }).filter(function (x) { return x != null; });
        var ref = fins.length ? Math.max.apply(null, fins) : (ts(b.disponible_le) != null ? ts(b.disponible_le) : ts(b.created_at));
        if (ts(b.disponible_le) != null && fins.length && ts(b.disponible_le) > ref) ref = ts(b.disponible_le);
        vacCour = ref != null ? Math.max(0, Math.floor((now - ref) / MS_JOUR)) : 0;
      }

      var q12 = (i.quittances || []).filter(function (q) { return ids[q.bail_id]; });
      var qFen = q12.filter(function (q) { var t = ts((q.periode || '') + '-01'); return t != null && t >= debut12 - 15 * MS_JOUR; });
      var quitte = qFen.reduce(function (t, q) { return t + num(q.total); }, 0), encaisse = qFen.reduce(function (t, q) { return t + num(q.regle); }, 0);
      var impaye = q12.reduce(function (t, q) { return t + Math.max(0, num(q.total) - num(q.regle)); }, 0);
      var loyersEnc = qFen.reduce(function (t, q) { return t + (num(q.total) > 0 ? num(q.loyer) * num(q.regle) / num(q.total) : 0); }, 0);
      var taux = quitte > 0 ? encaisse / quitte * 100 : null;

      var tr = (i.travaux || []).filter(function (o) { return (ids[o.bail_id] || o.bien_id === b.id) && (o.statut === 'termine' || o.statut === 'facture') && ts(o.date_fin) != null && ts(o.date_fin) >= debut12; });
      var coutTot = tr.reduce(function (t, o) { return t + num(o.cout_reel); }, 0);
      var coutNous = tr.filter(function (o) { return o.imputation === 'promoteur' || o.imputation === 'auto' || !o.imputation; }).reduce(function (t, o) { return t + num(o.cout_reel); }, 0);

      var m2 = num(b.surface) > 0 && loyerRef > 0 ? loyerRef / num(b.surface) : null, grp = groupes[(b.commune || '') + '|' + (b.type || '')] || [];
      var med = grp.length >= 3 ? mediane(grp) : null;

      var A = [], loyerMois = loyerRef;
      if (!enTravaux && vacCour >= P.seuil_vacance_j && loyerMois > 0)
        A.push({ k: 'vacance', niveau: vacCour >= 90 ? 'rouge' : 'orange', montant: r0(loyerMois * vacCour / MOIS), texte: 'Vacant depuis ' + vacCour + ' j : ' + r0(loyerMois * vacCour / MOIS) + ' F de loyer perdus, ' + r0(loyerMois) + ' F de plus chaque mois.' });
      if (qFen.length >= 3 && taux != null && taux < P.seuil_recouvrement_pct)
        A.push({ k: 'recouvrement', niveau: taux < 60 ? 'rouge' : 'orange', montant: r0(impaye), texte: 'Recouvrement de ' + r1(taux) + ' % sur 12 mois (seuil ' + P.seuil_recouvrement_pct + ' %), ' + r0(impaye) + ' F impayés.' });
      if (loyersEnc > 0 && coutTot / loyersEnc * 100 > P.seuil_entretien_pct)
        A.push({ k: 'entretien', niveau: coutTot / loyersEnc * 100 > 30 ? 'rouge' : 'orange', montant: r0(coutTot), texte: 'Entretien : ' + r0(coutTot) + ' F soit ' + r1(coutTot / loyersEnc * 100) + ' % des loyers encaissés (seuil ' + P.seuil_entretien_pct + ' %).' });
      if (med != null && m2 != null && m2 < med * (1 - P.seuil_sous_location_pct / 100) && actif) {
        var gain = r0((med * num(b.surface) - loyerRef) * 12);
        A.push({ k: 'sous_loue', niveau: 'orange', montant: gain, texte: 'Loyer de ' + r0(m2) + ' F/m² contre ' + r0(med) + ' F/m² (médiane du parc, même commune et type) : potentiel de ' + gain + ' F par an.' });
      }
      if (actif && actif.statut === 'actif' && ts(actif.fin) != null && ts(actif.fin) >= now && ts(actif.fin) - now <= P.fin_bail_j * MS_JOUR)
        A.push({ k: 'fin_proche', niveau: 'orange', montant: null, texte: 'Bail échu dans ' + Math.ceil((ts(actif.fin) - now) / MS_JOUR) + ' j : renouveler ou préparer la relocation avant de perdre des mois de loyer.' });
      if (actif && actif.statut === 'actif') {
        var base = ts(actif.derniere_revision) != null ? ts(actif.derniere_revision) : ts(actif.debut);
        if (base != null && now - base >= 365 * MS_JOUR) {
          var g = P.taux_revision_pct != null ? r0(num(actif.loyer) * P.taux_revision_pct / 100 * 12) : null;
          A.push({ k: 'revision', niveau: 'orange', montant: g, texte: 'Révision de loyer due (dernière il y a ' + Math.floor((now - base) / MS_JOUR / 365 * 10) / 10 + ' an(s))' + (g != null ? ' : +' + g + ' F par an à ' + P.taux_revision_pct + ' %.' : '. Saisissez le taux de révision pour chiffrer le gain.') });
        }
      }
      return { bien: b, nom: nomBien(b), statut: enTravaux ? 'travaux' : actif ? 'loue' : 'vacant', loyer: loyerRef, occupation_pct: r1(occ / fenetre * 100), vacance_jours: vac, vacance_courante: vacCour,
        manque_a_gagner: r0(loyerRef * vac / MOIS), quitte: r0(quitte), encaisse: r0(encaisse), taux_recouvrement: taux == null ? null : r1(taux), impaye: r0(impaye),
        loyers_encaisses: r0(loyersEnc), travaux_total: r0(coutTot), travaux_nous: r0(coutNous), loyer_m2: m2 == null ? null : r0(m2), mediane_m2: med == null ? null : r0(med), alertes: A };
    });

    var gerables = lignes.filter(function (l) { return l.statut !== 'travaux'; });
    var loues = gerables.filter(function (l) { return l.statut === 'loue'; }).length;
    var alertes = [];
    lignes.forEach(function (l) { l.alertes.forEach(function (a) { alertes.push(Object.assign({ bien_id: l.bien.id, nom: l.nom }, a)); }); });
    var ordre = { rouge: 0, orange: 1 };
    alertes.sort(function (a, b) { return (ordre[a.niveau] - ordre[b.niveau]) || ((b.montant || 0) - (a.montant || 0)); });
    lignes.sort(function (a, b) { return (b.alertes.length ? 1 : 0) - (a.alertes.length ? 1 : 0) || b.manque_a_gagner - a.manque_a_gagner || b.impaye - a.impaye; });
    return { cfg: P, biens: lignes, alertes: alertes,
      total: { biens: gerables.length, loues: loues, vacants: gerables.length - loues, occupation_pct: gerables.length ? r1(loues / gerables.length * 100) : null,
        perte_mensuelle: r0(gerables.filter(function (l) { return l.statut === 'vacant'; }).reduce(function (t, l) { return t + l.loyer; }, 0)),
        manque_a_gagner_12m: r0(lignes.reduce(function (t, l) { return t + l.manque_a_gagner; }, 0)), impaye: r0(lignes.reduce(function (t, l) { return t + l.impaye; }, 0)),
        quitte: r0(lignes.reduce(function (t, l) { return t + l.quitte; }, 0)), encaisse: r0(lignes.reduce(function (t, l) { return t + l.encaisse; }, 0)),
        potentiel_sous_loyer: r0(alertes.filter(function (a) { return a.k === 'sous_loue'; }).reduce(function (t, a) { return t + (a.montant || 0); }, 0)) } };
  }

  var API = { DEFAUT: DEFAUT, cfg: cfg, joursOccupes: joursOccupes, analyser: analyser };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.RentabiliteLocative = API;
})(typeof window !== 'undefined' ? window : globalThis);
