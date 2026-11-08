/* Cockpit — actions de croissance. Moteur pur : transforme des signaux chiffrés en actions pour la file existante du Cockpit
   (ckActions). Même schéma que les autres règles : { aid, prio, urgent, icone, titre, detail, montant, boutons }.
   Échelle de priorité du Cockpit : 25-120 (relances exigibles ≥ 100, échéances légales 95, trésorerie négative proche 110).
   Les identifiants (aid) changent chaque jour : « reporter » ou « ignorer » une action ne la masque que pour la journée. */
(function (root) {
  'use strict';

  function plur(n, s, p) { return n + ' ' + (n > 1 ? p : s); }

  /* s : { jour, tresorerie:{premierNegatif, besoin, soldeMin, semaineMin, seuil}, wa:{actif, nb, montant}, leads:{chauds, budgetChauds, dormantsNego, budgetNego, relancesRetard},
           parrainage:{aValider, montant}, marges:{rouge, orange, incomplets, premier}, apporteurs:{dormants, contrats}, locatif:{vacants, perteMensuelle, recouvrement, sousLoues, finsProches} } ; f : formateur de montant */
  function construire(s, f) {
    f = f || function (n) { return String(Math.round(n)); };
    var A = [], j = s.jour || '';
    var push = function (a) { A.push(a); };

    var t = s.tresorerie;
    if (t && t.premierNegatif) {
      push({ aid: 'cr_treso_' + j, prio: t.premierNegatif <= 4 ? 110 : 80, urgent: t.premierNegatif <= 4, icone: '🔮',
        titre: 'Trésorerie négative prévue en semaine ' + t.premierNegatif,
        detail: 'Creux de ' + f(t.soldeMin) + ' F (semaine ' + t.semaineMin + '). Besoin pour tenir le seuil : ' + f(t.besoin) + ' F. Recouvrer, décaler un décaissement ou prévoir un financement.',
        montant: t.besoin, boutons: [{ lib: '🔮 Voir la projection', fn: "goTo('tresorerie-page')" }, { lib: '📲 Relances', fn: "goTo('relances')" }] });
    } else if (t && t.besoin > 0) {
      push({ aid: 'cr_treso_' + j, prio: 60, urgent: false, icone: '🔮', titre: 'Trésorerie sous le seuil de sécurité en semaine ' + t.semaineMin,
        detail: 'Le solde projeté descend à ' + f(t.soldeMin) + ' F, seuil ' + f(t.seuil) + ' F.', montant: t.besoin, boutons: [{ lib: '🔮 Voir la projection', fn: "goTo('tresorerie-page')" }] });
    }

    var w = s.wa;
    if (w && w.actif && w.nb > 0)
      push({ aid: 'cr_wa_' + j, prio: 84, urgent: false, icone: '📲', titre: plur(w.nb, 'relance WhatsApp prête', 'relances WhatsApp prêtes') + ' aujourd\'hui',
        detail: f(w.montant) + ' F à recouvrer, avec lien de paiement. Un clic pour tout envoyer après aperçu.', montant: w.montant, boutons: [{ lib: '📲 Ouvrir la campagne', fn: 'goTo(\'relances\');waRelOuvrir()' }] });

    var l = s.leads || {};
    if (l.dormantsNego > 0)
      push({ aid: 'cr_nego_' + j, prio: 82, urgent: false, icone: '💤', titre: plur(l.dormantsNego, 'négociation sans mouvement depuis 7 jours', 'négociations sans mouvement depuis 7 jours'),
        detail: 'Budget en jeu : ' + f(l.budgetNego) + ' F. Un prospect en négociation qui ne bouge plus est rarement gagné.', montant: l.budgetNego, boutons: [{ lib: '🎯 À appeler', fn: 'goTo(\'leads\');lsOuvrir()' }] });
    if (l.chauds > 0)
      push({ aid: 'cr_chauds_' + j, prio: 78, urgent: false, icone: '🔥', titre: plur(l.chauds, 'prospect chaud à appeler', 'prospects chauds à appeler'),
        detail: 'Score 65 et plus. Budget cumulé : ' + f(l.budgetChauds) + ' F.', montant: l.budgetChauds, boutons: [{ lib: '🎯 À appeler', fn: 'goTo(\'leads\');lsOuvrir()' }] });
    if (l.relancesRetard > 0)
      push({ aid: 'cr_relp_' + j, prio: 72, urgent: false, icone: '⏰', titre: plur(l.relancesRetard, 'relance prospect en retard', 'relances prospects en retard'),
        detail: 'La date de relance prévue est dépassée.', boutons: [{ lib: '🎯 À appeler', fn: 'goTo(\'leads\');lsOuvrir()' }] });

    var m = s.marges;
    if (m && m.rouge > 0)
      push({ aid: 'cr_marge_r_' + j, prio: 88, urgent: true, icone: '🔴', titre: plur(m.rouge, 'programme à marge négative', 'programmes à marge négative') + (m.premier ? ' (' + m.premier + ')' : ''),
        detail: 'La marge potentielle est négative même nette des commissions à venir : revoir prix, coûts ou stratégie de vente.', boutons: [{ lib: '🚦 Santé des marges', fn: "goTo('bilan-promotion')" }] });
    else if (m && (m.orange > 0 || m.incomplets > 0))
      push({ aid: 'cr_marge_o_' + j, prio: 52, urgent: false, icone: '🚦', titre: 'Marges à surveiller : ' + (m.orange ? plur(m.orange, 'programme sous la cible', 'programmes sous la cible') : '') + (m.orange && m.incomplets ? ', ' : '') + (m.incomplets ? plur(m.incomplets, 'à données incomplètes', 'à données incomplètes') : ''),
        detail: 'Une marge élevée sur des coûts manquants est trompeuse : compléter foncier, travaux, prix.', boutons: [{ lib: '🚦 Santé des marges', fn: "goTo('bilan-promotion')" }] });

    var p = s.parrainage;
    if (p && p.aValider > 0)
      push({ aid: 'cr_parr_' + j, prio: 50, urgent: false, icone: '🤝', titre: plur(p.aValider, 'récompense de parrainage à valider', 'récompenses de parrainage à valider'),
        detail: 'Les filleuls ont versé le seuil. Montant : ' + f(p.montant) + ' F.', montant: p.montant, boutons: [{ lib: '🤝 Parrainage', fn: 'parOuvrir()' }] });

    var lo = s.locatif;
    if (lo && lo.vacants > 0)
      push({ aid: 'cr_locvac_' + j, prio: 76, urgent: false, icone: '🕳', titre: plur(lo.vacants, 'bien locatif vacant depuis plus de 30 jours', 'biens locatifs vacants depuis plus de 30 jours'),
        detail: 'Perte de ' + f(lo.perteMensuelle) + ' F de loyer chaque mois. Relouer, ajuster le loyer ou lancer les travaux.', montant: lo.perteMensuelle, boutons: [{ lib: '📉 Rentabilité', fn: "goTo('locatif');rloOuvrir()" }] });
    if (lo && lo.recouvrement > 0)
      push({ aid: 'cr_locrec_' + j, prio: 64, urgent: false, icone: '💸', titre: plur(lo.recouvrement, 'bien au recouvrement faible', 'biens au recouvrement faible'),
        detail: 'Moins de 80 % des loyers encaissés sur 12 mois.', boutons: [{ lib: '📉 Rentabilité', fn: "goTo('locatif');rloOuvrir()" }] });
    if (lo && (lo.sousLoues > 0 || lo.finsProches > 0))
      push({ aid: 'cr_loclev_' + j, prio: 46, urgent: false, icone: '📈', titre: 'Locatif : ' + (lo.sousLoues ? plur(lo.sousLoues, 'bien sous-loué', 'biens sous-loués') : '') + (lo.sousLoues && lo.finsProches ? ', ' : '') + (lo.finsProches ? plur(lo.finsProches, 'bail à renouveler', 'baux à renouveler') : ''),
        detail: 'Loyers sous la médiane du parc ou baux échus sous 90 jours.', boutons: [{ lib: '📉 Rentabilité', fn: "goTo('locatif');rloOuvrir()" }] });

    var a = s.apporteurs;
    if (a && a.contrats > 0)
      push({ aid: 'cr_apc_' + j, prio: 48, urgent: false, icone: '📄', titre: plur(a.contrats, 'contrat d\'apporteur expiré ou à renouveler', 'contrats d\'apporteurs expirés ou à renouveler'),
        detail: 'Sous 60 jours ou déjà expirés.', boutons: [{ lib: '🏆 Classement', fn: "goTo('crm-apporteurs');aprOuvrir()" }] });
    if (a && a.dormants > 0)
      push({ aid: 'cr_apd_' + j, prio: 42, urgent: false, icone: '💤', titre: plur(a.dormants, 'apporteur dormant', 'apporteurs dormants'),
        detail: 'Sans vente depuis 90 jours. Un message WhatsApp prêt les attend.', boutons: [{ lib: '🏆 Classement', fn: "goTo('crm-apporteurs');aprOuvrir()" }] });

    return A;
  }

  var API = { construire: construire };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.CockpitCroissance = API;
})(typeof window !== 'undefined' ? window : globalThis);
