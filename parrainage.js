/* Parrainage souscripteur — moteur pur (aucun DOM/réseau), testable sous Node, chargé tel quel par l'ERP.
   Données (aucune nouvelle table) :
   · lead.parrain_id / client.parrain_id : identifiant du souscripteur PARRAIN ;
   · parrain.parrainage_recompenses[] : journal des récompenses {id, filleul_key, filleul_nom, montant, statut:'due'|'versee'|'annulee', ...}
     (même principe que les actions commerciales : le journal vit dans la fiche du parrain et se synchronise avec elle) ;
   · parrain.parrainage_demandes[] : dates des sollicitations envoyées.
   Une récompense n'est JAMAIS créée automatiquement : le moteur la propose (« éligible »), un humain la valide.
   Déclencheur anti-abus : l'argent du filleul doit être entré (seuil % du prix versé), pas seulement sa signature. */
(function (root) {
  'use strict';

  var MS_JOUR = 86400000;
  var DEFAUT = { actif: false, montant: 100000, seuil_pct: 10, plafond: 0, exige_a_jour: true, type: 'prime' };

  function ts(d) { var t = Date.parse(String(d || '').length === 10 ? d + 'T12:00:00' : d); return isNaN(t) ? null : t; }
  function num(x) { return parseFloat(x) || 0; }
  function tel(v) {
    var d = String(v == null ? '' : v).replace(/[\s.\-()\/]/g, '');
    if (/[^0-9+]/.test(d)) return '';
    var c = (d.indexOf('00') === 0 ? d.slice(2) : d).replace(/\D/g, '');
    if (d.charAt(0) === '+' || d.indexOf('00') === 0) return c.length >= 8 && c.length <= 15 ? c : '';
    if (c.length === 10) return '225' + c;
    return c.length === 13 && c.indexOf('225') === 0 ? c : '';
  }
  function cfg(p) { var o = Object.assign({}, DEFAUT, p || {}); o.montant = num(o.montant); o.seuil_pct = num(o.seuil_pct); o.plafond = Math.max(0, Math.floor(num(o.plafond))); return o; }
  function nomDe(c) { return ((c.prenoms || '') + ' ' + (c.nom || '')).trim(); }
  function resilie(c) { return c.statut === 'resilie' || c.statut === 'inactif'; }

  /* i : { params, clients, leads, versements, enRetard:{id:true}, now } */
  function analyser(i) {
    var P = cfg(i.params), now = i.now || Date.now();
    var clients = i.clients || [], parId = {}, parTel = {};
    clients.forEach(function (c) { parId[c.id] = c; [c.tel, c.tel2].forEach(function (t) { var n = tel(t); if (n && !parTel[n]) parTel[n] = c; }); });
    var verse = {};
    (i.versements || []).forEach(function (v) { if (v.statut === 'annule' || v.type === 'frais_souscription') return; verse[v.client_id] = (verse[v.client_id] || 0) + num(v.montant); });

    /* 1. Liens bruts : prospects parrainés (join par téléphone vers un éventuel souscripteur) + souscripteurs parrainés. */
    var liens = {}, ordre = [];
    var ajouter = function (cle, l) { if (!liens[cle]) { liens[cle] = l; ordre.push(cle); } };
    (i.leads || []).forEach(function (ld) {
      if (!ld.parrain_id) return;
      var cl = parTel[tel(ld.tel)] || null;
      var key = cl ? 'client:' + cl.id : 'lead:' + ld.id;
      ajouter(key, { key: key, parrain_id: ld.parrain_id, lead: ld, client: cl, nom: cl ? nomDe(cl) : ld.nom, tel: tel(ld.tel), date: ts(ld.created_at) });
    });
    clients.forEach(function (c) {
      if (!c.parrain_id) return;
      var key = 'client:' + c.id;
      if (liens[key]) { liens[key].client = c; return; }
      ajouter(key, { key: key, parrain_id: c.parrain_id, lead: null, client: c, nom: nomDe(c), tel: tel(c.tel), date: ts(c.date_souscription) || ts(c.date_debut) });
    });

    /* 2. Journal par clé de filleul. */
    var journal = {};
    clients.forEach(function (p) { (p.parrainage_recompenses || []).forEach(function (r) { var k = r.parrain_id || p.id; (journal[k + '|' + r.filleul_key] = journal[k + '|' + r.filleul_key] || []).push(r); }); });

    /* 3. État de chaque lien, dans l'ordre d'ancienneté (le plafond s'applique aux plus anciens d'abord). */
    ordre.sort(function (a, b) { return (liens[a].date || 0) - (liens[b].date || 0); });
    var compte = {}, parrains = {}, aCreer = [], res = [];
    ordre.forEach(function (key) {
      var L = liens[key], parrain = parId[L.parrain_id], c = L.client, e = {};
      e.key = key; e.parrain = parrain || null; e.parrain_id = L.parrain_id; e.nom = L.nom; e.tel = L.tel; e.client = c || null; e.lead = L.lead;
      e.valeur = c ? num(c.montant_total) : 0; e.verse_pct = c && num(c.montant_total) > 0 ? Math.round((verse[c.id] || 0) / num(c.montant_total) * 1000) / 10 : 0;
      var pj = (journal[L.parrain_id + '|' + key] || []).filter(function (r) { return r.statut !== 'annulee'; }), derniere = (journal[L.parrain_id + '|' + key] || []).slice(-1)[0];
      if (!parrain) e.etat = 'parrain_inconnu';
      else if (c && (c.id === parrain.id || (tel(parrain.tel) && tel(parrain.tel) === L.tel) || (tel(parrain.tel2) && tel(parrain.tel2) === L.tel))) e.etat = 'refuse_auto';
      else if (pj.length) e.etat = pj.some(function (r) { return r.statut === 'versee'; }) ? 'versee' : 'due';
      else if (derniere && derniere.statut === 'annulee') e.etat = 'annulee';
      else if (!c) e.etat = L.lead && L.lead.statut === 'perdu' ? 'perdu' : 'prospect';
      else if (resilie(c)) e.etat = 'annulee_resilie';
      else if (e.verse_pct < P.seuil_pct) e.etat = 'attente_versement';
      else if (resilie(parrain)) e.etat = 'refuse_parrain';
      else if (P.exige_a_jour && i.enRetard && i.enRetard[parrain.id]) e.etat = 'bloque_retard';
      else if (P.plafond > 0 && (compte[parrain.id] || 0) >= P.plafond) e.etat = 'plafond';
      else e.etat = 'eligible';
      if (parrain && (e.etat === 'eligible' || e.etat === 'due' || e.etat === 'versee')) compte[parrain.id] = (compte[parrain.id] || 0) + 1;
      if (e.etat === 'eligible') aCreer.push({ parrain_id: parrain.id, filleul_key: key, filleul_nom: e.nom, montant: P.montant, type: P.type });
      var s = parrains[L.parrain_id] || (parrains[L.parrain_id] = { parrain_id: L.parrain_id, parrain: parrain || null, liens: 0, souscrits: 0, valeur: 0, due: 0, versee: 0 });
      s.liens++; if (c && !resilie(c)) { s.souscrits++; s.valeur += e.valeur; }
      (journal[L.parrain_id + '|' + key] || []).forEach(function (r) { if (r.statut === 'due') s.due += num(r.montant); if (r.statut === 'versee') s.versee += num(r.montant); });
      res.push(e);
    });
    var classement = Object.keys(parrains).map(function (k) { var s = parrains[k]; s.cout_pct = s.valeur > 0 ? Math.round((s.due + s.versee) / s.valeur * 1000) / 10 : null; return s; })
      .sort(function (a, b) { return b.souscrits - a.souscrits || b.valeur - a.valeur; });

    /* 4. Ambassadeurs à solliciter : souscripteurs satisfaits (soldés ou ≥ 50 % versé), à jour, non sollicités depuis 90 j. */
    var ambassadeurs = clients.filter(function (c) {
      if (resilie(c) || !(num(c.montant_total) > 0) || (i.enRetard && i.enRetard[c.id]) || !tel(c.tel)) return false;
      var pct = (verse[c.id] || 0) / num(c.montant_total) * 100; if (pct < 50) return false;
      var der = (c.parrainage_demandes || []).slice(-1)[0]; return !(der && now - (ts(der.date) || 0) < 90 * MS_JOUR);
    }).map(function (c) { var pct = (verse[c.id] || 0) / num(c.montant_total) * 100; return { client: c, solde: pct >= 100, pct: Math.round(pct) }; })
      .sort(function (a, b) { return (b.solde - a.solde) || (b.pct - a.pct); });

    return { cfg: P, liens: res, a_creer: aCreer, classement: classement, ambassadeurs: ambassadeurs,
      totaux: { liens: res.length, souscrits: res.filter(function (e) { return e.client && !resilie(e.client); }).length,
                due: classement.reduce(function (t, s) { return t + s.due; }, 0), versee: classement.reduce(function (t, s) { return t + s.versee; }, 0),
                valeur: classement.reduce(function (t, s) { return t + s.valeur; }, 0) } };
  }

  function messageDemande(c, P, societe) {
    var pre = (c.prenoms || c.nom || '').trim();
    var offre = P.actif && P.montant > 0 ? ' Pour vous remercier, ' + (societe || 'nous') + ' vous offre ' + Math.round(P.montant).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA lorsqu\'un proche que vous nous présentez souscrit et règle son premier versement.' : '';
    return 'Bonjour ' + pre + ', merci pour votre confiance.' + offre + ' Connaissez-vous quelqu\'un qui cherche un terrain ou un logement ? Donnez-nous simplement son nom et son numéro (avec son accord) et nous nous occupons du reste.';
  }

  var LIBELLES = { prospect: 'Prospect en cours', perdu: 'Prospect perdu', attente_versement: 'Souscrit : en attente du versement seuil', eligible: 'Récompense à valider', due: 'À verser', versee: 'Versée',
    annulee: 'Annulée', annulee_resilie: 'Filleul résilié', refuse_auto: 'Refusé : auto-parrainage', refuse_parrain: 'Refusé : parrain inactif', bloque_retard: 'Bloqué : parrain en retard',
    plafond: 'Plafond atteint', parrain_inconnu: 'Parrain introuvable' };

  var API = { DEFAUT: DEFAUT, LIBELLES: LIBELLES, cfg: cfg, tel: tel, analyser: analyser, messageDemande: messageDemande };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Parrainage = API;
})(typeof window !== 'undefined' ? window : globalThis);
