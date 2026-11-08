/* Relances WhatsApp — cadence J-3 / J0 / J+3 / J+10.
   Partie pure (aucun accès DOM/réseau) : testable sous Node, chargée telle quelle par l'ERP.
   Règles :
   · échéance = jour du mois de la date de départ du souscripteur (ramené au dernier jour du mois si besoin) ;
   · J-3 : à jour, mais en retard dès la prochaine échéance (dans 1 à 3 jours) ;
   · J0 / J+3 / J+10 : en retard, selon les jours écoulés depuis la dernière échéance ;
   · ≥ 3 mois de retard : aucun envoi automatique (mise en demeure = décision humaine) ;
   · un palier ne part qu'une fois par client et par échéance (clé client|cycle|palier). */
(function (root) {
  'use strict';

  var PALIERS = ['J-3', 'J0', 'J3', 'J10'];
  var MAX_MOIS_AUTO = 3;
  var MS_JOUR = 86400000;

  var TEXTES = {
    'J-3': 'Bonjour {prenom}, votre échéance de {montant} ({dossier}) arrive dans 3 jours. Réglez en un clic (Wave, Orange Money, MTN, carte) : {lien}\n{societe}. Répondez STOP pour ne plus recevoir ces messages.',
    'J0':  'Bonjour {prenom}, votre échéance de {montant} ({dossier}) est due aujourd\'hui. Réglez en un clic : {lien}\n{societe}. Répondez STOP pour ne plus recevoir ces messages.',
    'J3':  'Bonjour {prenom}, sauf erreur de notre part, {montant} ({dossier}) reste à régler. Évitez tout retard supplémentaire : {lien}\n{societe}. Répondez STOP pour ne plus recevoir ces messages.',
    'J10': 'Bonjour {prenom}, {montant} ({dossier}) est en retard de paiement. Régularisez dès maintenant : {lien}. Besoin d\'un échéancier ? Répondez à ce message.\n{societe}. Répondez STOP pour ne plus recevoir ces messages.'
  };
  var TEMPLATES = { 'J-3': 'rel_j_moins3', 'J0': 'rel_j0', 'J3': 'rel_j3', 'J10': 'rel_j10' };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function jourLocal(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function parseIso(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function joursDansMois(a, m) { return new Date(a, m + 1, 0).getDate(); }
  /* Échéance du mois (a, m) pour le jour « jour » : plafonnée au dernier jour du mois. */
  function echeanceDuMois(a, m, jour) { return new Date(a, m, Math.min(jour, joursDansMois(a, m))); }
  function ecartJours(a, b) { return Math.round((jourLocal(b) - jourLocal(a)) / MS_JOUR); }

  /* Dernière et prochaine échéances par rapport à « now » (aujourd'hui compte comme dernière). */
  function echeances(ancreIso, now) {
    var ancre = parseIso(ancreIso);
    if (!ancre) return null;
    var jour = ancre.getDate(), auj = jourLocal(now);
    var ce = echeanceDuMois(auj.getFullYear(), auj.getMonth(), jour), derniere, prochaine;
    if (ce <= auj) { derniere = ce; prochaine = echeanceDuMois(auj.getFullYear(), auj.getMonth() + 1, jour); }
    else { prochaine = ce; derniere = echeanceDuMois(auj.getFullYear(), auj.getMonth() - 1, jour); }
    return { derniere: derniere, prochaine: prochaine, joursDepuis: ecartJours(derniere, auj), joursAvant: ecartJours(auj, prochaine) };
  }

  /* Palier du jour, ou null. Entrées :
     ancre      date de départ (AAAA-MM-JJ) ; now : Date
     ecart      montant en retard aujourd'hui ; moisRetard : retard en mois
     ecartAvenir montant en retard à la prochaine échéance (pour J-3) ; mensualite : repli du montant J-3
     Retour : { palier, cycle (AAAA-MM-JJ), montant } | { palier:null, raison } */
  function palierDuJour(p) {
    var e = echeances(p.ancre, p.now);
    if (!e) return { palier: null, raison: 'sans_date' };
    var ecart = +p.ecart || 0;
    if (ecart > 0.5) {
      if ((+p.moisRetard || 0) >= MAX_MOIS_AUTO) return { palier: null, raison: 'escalade_humaine' };
      var d = e.joursDepuis, pal = d >= 10 ? 'J10' : d >= 3 ? 'J3' : 'J0';
      return { palier: pal, cycle: iso(e.derniere), montant: Math.ceil(ecart) };
    }
    if (e.joursAvant >= 1 && e.joursAvant <= 3 && (+p.ecartAvenir || 0) > 0.5)
      return { palier: 'J-3', cycle: iso(e.prochaine), montant: Math.ceil(+p.ecartAvenir || +p.mensualite || 0) };
    return { palier: null, raison: 'rien' };
  }

  function normaliserTel(tel) {
    var d = String(tel == null ? '' : tel).replace(/[\s.\-()\/]/g, '');
    if (/[^0-9+]/.test(d)) return '';
    if (d.indexOf('00') === 0) d = '+' + d.slice(2);
    var c = d.replace(/\D/g, '');
    if (d.charAt(0) === '+') return c.length >= 8 && c.length <= 15 ? c : '';
    if (c.length === 10) return '225' + c;
    if (c.length === 13 && c.indexOf('225') === 0) return c;
    return '';
  }

  function formatMontant(n) {
    return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  }

  function cle(clientId, cycle, palier) { return clientId + '|' + cycle + '|' + palier; }

  function rendreTexte(palier, v) {
    var t = TEXTES[palier] || '';
    return t.replace(/\{(\w+)\}/g, function (_, k) { return v && v[k] != null ? String(v[k]) : ''; });
  }

  /* Construit la file d'envoi du jour.
     retardataires : sortie de getRetardataires() ; aJour : [{client, ecartAvenir, mensualite}] ;
     deja : ensemble des clés déjà envoyées (statut ≠ échec) ; optout : ensemble de numéros (225…). */
  function construireFile(entrees, deja, optout, now) {
    var file = [], ignores = [];
    (entrees || []).forEach(function (x) {
      var r = palierDuJour({ ancre: x.ancre, now: now, ecart: x.ecart, moisRetard: x.moisRetard, ecartAvenir: x.ecartAvenir, mensualite: x.mensualite });
      if (!r.palier) { if (r.raison === 'escalade_humaine') ignores.push({ client_id: x.client_id, raison: r.raison }); return; }
      var tel = normaliserTel(x.tel);
      if (!tel) { ignores.push({ client_id: x.client_id, raison: 'telephone_invalide' }); return; }
      if (optout && optout[tel]) { ignores.push({ client_id: x.client_id, raison: 'desinscrit' }); return; }
      if (deja && deja[cle(x.client_id, r.cycle, r.palier)]) { ignores.push({ client_id: x.client_id, raison: 'deja_envoye' }); return; }
      file.push({ client_id: x.client_id, nom: x.nom, prenom: x.prenom, tel: tel, dossier: x.dossier, palier: r.palier,
                  cycle: r.cycle, montant: r.montant, mois_retard: +x.moisRetard || 0 });
    });
    return { file: file, ignores: ignores };
  }

  var API = { PALIERS: PALIERS, MAX_MOIS_AUTO: MAX_MOIS_AUTO, TEXTES: TEXTES, TEMPLATES: TEMPLATES,
              echeances: echeances, palierDuJour: palierDuJour, normaliserTel: normaliserTel, formatMontant: formatMontant,
              cle: cle, rendreTexte: rendreTexte, construireFile: construireFile };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.WaRelances = API;
})(typeof window !== 'undefined' ? window : globalThis);
