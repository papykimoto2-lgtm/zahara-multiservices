/* Classement des apporteurs d'affaires — moteur pur (aucun DOM/réseau), testable sous Node.
   Classement par ARGENT ENCAISSÉ sur la période (pas par nombre de promesses), avec la qualité à côté :
   retards, résiliations, coût de commission. Aucune prime n'est calculée ni versée ici : les paliers sont des
   niveaux de reconnaissance ; la récompense est une décision de la direction.
   Données lues : apporteurs {id, nom, prenoms, statut, date_contrat, date_expiration, non_contournement},
   clients {id, apporteur_id, montant_total, date_souscription|date_debut, statut}, versements {client_id, montant, date, statut, type},
   commissions {type_beneficiaire, apporteur_id|client_id, montant_comm, statut, date_versement}. */
(function (root) {
  'use strict';

  var MS_JOUR = 86400000;
  var PALIERS_DEFAUT = [{ nom: 'Bronze', min: 1 }, { nom: 'Argent', min: 3 }, { nom: 'Or', min: 6 }, { nom: 'Platine', min: 12 }];
  var DORMANT_JOURS = 90, CONTRAT_ALERTE_JOURS = 60, SEUIL_RETARD = 0.4, MIN_QUALITE = 3, JAMAIS_VENDU_JOURS = 60;

  function ts(d) { var t = Date.parse(String(d || '').length === 10 ? d + 'T12:00:00' : d); return isNaN(t) ? null : t; }
  function num(x) { return parseFloat(x) || 0; }
  function dateVente(c) { return ts(c.date_souscription) != null ? ts(c.date_souscription) : ts(c.date_debut); }
  function resilie(c) { return c.statut === 'resilie'; }
  function dansPeriode(t, p) { return t != null && (p.debut == null || t >= p.debut) && (p.fin == null || t <= p.fin); }

  function palierDe(n, paliers) {
    var res = null; (paliers || PALIERS_DEFAUT).slice().sort(function (a, b) { return a.min - b.min; }).forEach(function (p) { if (n >= p.min) res = p.nom; });
    return res;
  }

  /* i : { apporteurs, clients, versements, commissions, enRetard:{clientId:true}, soldes:{clientId:true}, now, periode:{debut,fin}, paliers } */
  function analyser(i) {
    var now = i.now || Date.now(), per = i.periode || {}, paliers = i.paliers || PALIERS_DEFAUT;
    var parClient = {}, parAp = {};
    (i.apporteurs || []).forEach(function (a) {
      parAp[a.id] = { id: a.id, apporteur: a, ventes_n: 0, ventes_valeur: 0, resilies_n: 0, encaisse: 0, clients_n: 0, retard_n: 0, ventes_12m: 0,
                      commission_periode: 0, commission_due: 0, derniere_vente: null };
    });
    var an = now - 365 * MS_JOUR;
    (i.clients || []).forEach(function (c) {
      var a = c.apporteur_id && parAp[c.apporteur_id]; if (!a) return;
      parClient[c.id] = a;
      var t = dateVente(c);
      if (t != null && (a.derniere_vente == null || t > a.derniere_vente) && !resilie(c)) a.derniere_vente = t;
      if (!resilie(c)) { a.clients_n++; if (i.enRetard && i.enRetard[c.id] && !(i.soldes && i.soldes[c.id])) a.retard_n++; }
      if (t != null && t >= an && !resilie(c)) a.ventes_12m++;
      if (dansPeriode(t, per)) { if (resilie(c)) a.resilies_n++; else { a.ventes_n++; a.ventes_valeur += num(c.montant_total); } }
    });
    (i.versements || []).forEach(function (v) {
      if (v.statut === 'annule' || v.type === 'frais_souscription') return;
      var a = parClient[v.client_id]; if (!a) return;
      if (dansPeriode(ts(v.date), per)) a.encaisse += num(v.montant);
    });
    (i.commissions || []).forEach(function (m) {
      if (m.type_beneficiaire !== 'apporteur' || m.statut === 'annulee') return;
      var a = (m.apporteur_id && parAp[m.apporteur_id]) || parClient[m.client_id]; if (!a) return;
      if (m.statut === 'a_payer') a.commission_due += num(m.montant_comm);
      if (dansPeriode(ts(m.date_versement), per)) a.commission_periode += num(m.montant_comm);
    });

    var rows = Object.keys(parAp).map(function (k) {
      var r = parAp[k], ap = r.apporteur, tags = [];
      var actifs = r.clients_n;
      r.taux_retard = actifs ? r.retard_n / actifs : 0;
      r.cout_pct = r.encaisse > 0 ? Math.round(r.commission_periode / r.encaisse * 1000) / 10 : null;
      r.jours_sans_vente = r.derniere_vente == null ? null : Math.floor((now - r.derniere_vente) / MS_JOUR);
      r.palier = palierDe(r.ventes_12m, paliers);
      var exp = ts(ap.date_expiration), contratJ = exp == null ? null : Math.floor((exp - now) / MS_JOUR);
      r.contrat_jours = contratJ;
      if (ap.statut && ap.statut !== 'actif') tags.push({ k: 'inactif', t: 'Apporteur ' + ap.statut });
      else {
        if (r.derniere_vente != null && r.jours_sans_vente >= DORMANT_JOURS) tags.push({ k: 'dormant', t: 'Sans vente depuis ' + r.jours_sans_vente + ' j' });
        var debutContrat = ts(ap.date_contrat);
        if (r.derniere_vente == null && debutContrat != null && now - debutContrat >= JAMAIS_VENDU_JOURS * MS_JOUR) tags.push({ k: 'jamais', t: 'Aucune vente depuis la signature' });
        if (actifs >= MIN_QUALITE && r.taux_retard >= SEUIL_RETARD) tags.push({ k: 'qualite', t: Math.round(r.taux_retard * 100) + ' % de ses clients en retard' });
        if (contratJ != null && contratJ < 0) tags.push({ k: 'contrat', t: 'Contrat expiré' });
        else if (contratJ != null && contratJ <= CONTRAT_ALERTE_JOURS) tags.push({ k: 'contrat', t: 'Contrat expire dans ' + contratJ + ' j' });
      }
      if (ap.non_contournement && ap.non_contournement !== 'signe' && (r.ventes_n || r.clients_n)) tags.push({ k: 'nc', t: 'Non-contournement non signé' });
      r.tags = tags; r.classable = !ap.statut || ap.statut === 'actif';
      return r;
    });

    var classes = rows.filter(function (r) { return r.classable && (r.encaisse > 0 || r.ventes_n > 0); })
      .sort(function (a, b) { return b.encaisse - a.encaisse || b.ventes_valeur - a.ventes_valeur || b.ventes_n - a.ventes_n; });
    var totalEnc = classes.reduce(function (t, r) { return t + r.encaisse; }, 0), cumul = 0;
    classes.forEach(function (r, k) { r.rang = k + 1; r.part = totalEnc ? r.encaisse / totalEnc : 0; cumul += r.part; r.part_cumulee = cumul; });
    var autres = rows.filter(function (r) { return classes.indexOf(r) < 0; })
      .sort(function (a, b) { return (b.ventes_12m - a.ventes_12m) || String(a.apporteur.nom).localeCompare(String(b.apporteur.nom)); });

    /* Part du réseau dans les ventes de la période (dépendance aux apporteurs). */
    var ventesTot = 0, ventesAp = 0;
    (i.clients || []).forEach(function (c) { if (resilie(c) || !dansPeriode(dateVente(c), per)) return; ventesTot++; if (c.apporteur_id && parAp[c.apporteur_id]) ventesAp++; });
    return {
      classes: classes, autres: autres, total_encaisse: totalEnc, ventes_total: ventesTot, ventes_reseau: ventesAp,
      part_reseau: ventesTot ? Math.round(ventesAp / ventesTot * 1000) / 10 : null,
      top3_part: classes.length ? Math.round(classes.slice(0, 3).reduce(function (t, r) { return t + r.part; }, 0) * 1000) / 10 : null,
      nb_dormants: rows.filter(function (r) { return r.tags.some(function (t) { return t.k === 'dormant'; }); }).length,
      commission_due_totale: rows.reduce(function (t, r) { return t + r.commission_due; }, 0)
    };
  }

  function messageRelance(r, societe) {
    var ap = r.apporteur, pre = (ap.prenoms || ap.nom || '').trim(), soc = societe || '';
    if (r.tags.some(function (t) { return t.k === 'dormant' || t.k === 'jamais'; }))
      return 'Bonjour ' + pre + ', c\'est ' + soc + '. Nous avons de nouveaux biens disponibles et des clients qui cherchent. Un point de 10 minutes cette semaine pour faire le tour des opportunités ? Merci de votre confiance.';
    if (r.rang && r.rang <= 3) return 'Bonjour ' + pre + ', merci pour vos résultats : vous faites partie de nos meilleurs apporteurs. Un point cette semaine sur vos prochains dossiers ?';
    return 'Bonjour ' + pre + ', un point rapide sur vos dossiers en cours chez ' + soc + ' ?';
  }

  var API = { PALIERS_DEFAUT: PALIERS_DEFAUT, DORMANT_JOURS: DORMANT_JOURS, SEUIL_RETARD: SEUIL_RETARD, MIN_QUALITE: MIN_QUALITE, analyser: analyser, palierDe: palierDe, messageRelance: messageRelance };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.ApporteursRang = API;
})(typeof window !== 'undefined' ? window : globalThis);
