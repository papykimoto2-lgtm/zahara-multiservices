/* Mode démonstration ARC-EN-CIEL CONNECT : données FICTIVES en mémoire, aucune écriture, aucun réseau.
   Imite la partie lecture du client Supabase (from().select().eq().in().gte().order().limit()) pour que les écrans s'affichent sans base.
   Toute écriture (rpc) est refusée avec un message clair. Activé par sessionStorage « arc_demo ». Expose ARC_DEMO. */
(function (G) {
  "use strict";
function j(n, d) { var x = new Date(); x.setDate(x.getDate() + n); return d ? x.toISOString() : x.toISOString().slice(0, 10); }
var U = "demo-user", M = "m1", C1 = "c1";
var T = {
  user_roles: [{ user_id: U, role_code: "president", date_debut: "2025-01-01", date_fin: null }, { user_id: U, role_code: "tresorier", date_debut: "2025-01-01", date_fin: null }],
  role_permissions: (function () {
    var L = [];
    ["finance.lire", "finance.encaisser", "finance.annuler", "finance.publier", "depense.creer", "depense.approuver", "depense.payer", "audit.lire", "vote.gerer", "proposition.traiter", "reclamation.traiter", "mediation.lire", "incident.traiter", "projet.gerer", "prestataire.gerer", "social.valider", "assurance.gerer", "charges.gerer", "enquete.gerer", "membres.gerer", "reunion.gerer", "annonce.publier", "pv.publier"].forEach(function (p) {
      ["president", "tresorier"].forEach(function (r) { L.push({ role_code: r, perm_code: p }); });
    });
    return L;
  })(),
  members: [{ id: M, ref: "M-001", nom: "Kouassi (démo)", prenoms: "Awa", user_id: U }],
  contributions: [{ id: C1, libelle: "Cotisation mensuelle (démo)" }],
  v_appels: [
    { id: "a1", contribution_id: C1, member_id: M, periode: "2026-08", echeance: j(-70), montant_appele: 10000, montant_paye: 10000, reste: 0, statut: "paye" },
    { id: "a2", contribution_id: C1, member_id: M, periode: "2026-09", echeance: j(-40), montant_appele: 10000, montant_paye: 4000, reste: 6000, statut: "en_retard" },
    { id: "a3", contribution_id: C1, member_id: M, periode: "2026-10", echeance: j(-5), montant_appele: 10000, montant_paye: 0, reste: 10000, statut: "en_retard" },
    { id: "a4", contribution_id: C1, member_id: "m2", periode: "2026-11", echeance: j(25), montant_appele: 10000, montant_paye: 0, reste: 10000, statut: "appele" }],
  announcements: [{ titre: "Journée de salubrité (démo)", corps: "Samedi prochain à 8 h, devant le portail principal.", categorie: "officielle", publie_le: j(-2, 1) },
    { titre: "Coupure d'eau programmée (démo)", corps: "Intervention de la SODECI mercredi de 9 h à 13 h.", categorie: "travaux", publie_le: j(-6, 1) }],
  etats_publies: [{ periode: "2026-T3", titre: "Situation financière", publie_le: j(-20, 1), contenu: { recettes: 1850000, depenses: 920000, tresorerie: 1430000, impayes: 310000 } }],
  meetings: [{ id: "r1", titre: "Assemblée générale ordinaire (démo)", type: "ag_ordinaire", date_heure: j(14, 1), lieu: "Salle polyvalente", ordre_du_jour: "Bilan, budget" },
    { id: "r2", titre: "Réunion du bureau (démo)", type: "bureau", date_heure: j(-12, 1), lieu: "Bureau du syndic", ordre_du_jour: "" }],
  minutes: [{ meeting_id: "r2", version: 1, statut: "publie", contenu: "Présents : bureau au complet.\nRésolution 1 : remise en état de l'éclairage de la voie principale." }],
  resolutions: [{ numero: "RES-2026-004", sujet: "Réparation de l'éclairage", responsable: "Commission technique", echeance: j(20), statut: "en_cours", cree_le: j(-12, 1) }],
  v_soldes_comptes: [{ id: "k1", code: "CAI", nom: "Caisse (démo)", type: "caisse", solde: 230000 }, { id: "k2", code: "BQ", nom: "Banque (démo)", type: "banque", solde: 1200000 }],
  cash_accounts: [{ id: "k1", code: "CAI", nom: "Caisse (démo)", type: "caisse", actif: true }, { id: "k2", code: "BQ", nom: "Banque (démo)", type: "banque", actif: true }, { id: "k3", code: "FS", nom: "Fonds de solidarité (démo)", type: "fonds_solidarite", actif: true }],
  cash_movements: [
    { id: "x1", ref: "ENC-2026-000012", sens: "entree", montant: 4000, categorie: "cotisation", date_op: j(-3), cree_le: j(-3, 1), source_type: "paiement", motif: null, contre_ecriture_de: null },
    { id: "x2", ref: "PAY-2026-000007", sens: "sortie", montant: 85000, categorie: "entretien", date_op: j(-9), cree_le: j(-9, 1), source_type: "depense", motif: null, contre_ecriture_de: null }],
  expense_requests: [
    { id: "e1", ref: "DEP-2026-000021", objet: "Remplacement de 3 lampadaires", fournisseur: "Élec Plus (démo)", montant: 180000, statut: "soumise", cree_le: j(-2, 1) },
    { id: "e2", ref: "DEP-2026-000019", objet: "Nettoyage des caniveaux", fournisseur: "Net Cité (démo)", montant: 60000, statut: "approuvee", cree_le: j(-8, 1) },
    { id: "e3", ref: "DEP-2026-000015", objet: "Peinture du portail", fournisseur: "Déco Songon (démo)", montant: 85000, statut: "payee", cree_le: j(-20, 1) }],
  expense_approvals: [{ expense_id: "e1", role_code: "president", decision: "approuve", le: j(-1, 1) }, { expense_id: "e2", role_code: "president", decision: "approuve", le: j(-6, 1) }, { expense_id: "e2", role_code: "tresorier", decision: "approuve", le: j(-5, 1) }],
  v_budget_execution: [{ line_id: "b1", exercice: 2026, categorie: "entretien", disponible: 420000 }],
  validation_rules: [{ montant_min: 1, montant_max: 25000, roles_requis: ["responsable_commission", "tresorier"], decision_requise: false },
    { montant_min: 25001, montant_max: 100000, roles_requis: ["president", "tresorier"], decision_requise: false },
    { montant_min: 100001, montant_max: 500000, roles_requis: ["president", "tresorier", "second_approbateur"], decision_requise: false },
    { montant_min: 500001, montant_max: null, roles_requis: ["president", "tresorier", "second_approbateur"], decision_requise: true }],
  documents: [{ titre: "Règlement de copropriété (démo)", categorie: "reglement", version: 2, chemin: "demo/reglement.pdf", visibilite: "membres", cree_le: j(-90, 1) }],
  consultations: [
    { id: "co1", ref: "CON-DEMO-1", titre: "Priorité d'investissement 2027 (démo)", description: "Quel chantier financer en premier ?", type: "priorisation", options: ["Éclairage des voies", "Réfection de la voirie", "Renforcement de la sécurité", "Aire de loisirs"], statut: "ouverte", ouverture: j(-2, 1), cloture: j(5, 1), quorum_pct: 30, majorite: "simple", consultatif: true, resultat: null },
    { id: "co2", ref: "CON-DEMO-0", titre: "Horaires de la salubrité (démo)", description: "", type: "sondage", options: ["Samedi 7 h", "Samedi 9 h"], statut: "close", ouverture: j(-30, 1), cloture: j(-20, 1), quorum_pct: 0, majorite: "simple", consultatif: true,
      resultat: { electeurs: 40, votants: 26, participation_pct: 65, quorum_pct: 0, quorum_atteint: true, majorite: "simple", consultatif: true, options: ["Samedi 7 h", "Samedi 9 h"], voix: [9, 17], gagnant: 1, egalite: false, adopte: true, recus: [] } }],
  propositions: [{ id: "i1", ref: "IDE-2026-000003", titre: "Bancs près du portail (démo)", description: "", categorie: "infrastructures", statut: "acceptee", reponse: "Inscrit au plan à moyen terme.", member_id: M, cree_le: j(-15, 1) },
    { id: "i2", ref: "IDE-2026-000004", titre: "Collecte des déchets le dimanche (démo)", description: "", categorie: "environnement", statut: "recue", reponse: null, member_id: "m2", cree_le: j(-3, 1) }],
  complaints: [{ id: "r1", ref: "REC-2026-000002", categorie: "cotisation", objet: "Montant appelé différent (démo)", statut: "repondue", reponse: "Erreur confirmée et corrigée.", delai_cible: j(4), confidentiel: false, member_id: M, cree_le: j(-9, 1) },
    { id: "r2", ref: "REC-2026-000005", categorie: "entretien", objet: "Caniveau bouché devant le lot 12 (démo)", statut: "deposee", reponse: null, delai_cible: j(11), confidentiel: false, member_id: "m2", cree_le: j(-4, 1) }],
  v_incidents_publics: [{ id: "n1", ref: "INC-2026-000008", categorie: "eclairage", description: "Lampadaire éteint voie B (démo)", localisation: "Voie B", priorite: "normale", statut: "nouveau", responsable: null, delai_cible: null, signale_le: j(-1, 1) },
    { id: "n2", ref: "INC-2026-000006", categorie: "fuite", description: "Fuite d'eau près du lot 7 (démo)", localisation: "Lot 7", priorite: "haute", statut: "en_intervention", responsable: "Plomberie Cité", delai_cible: j(2), signale_le: j(-3, 1) }],
  v_projets: [{ id: "p1", code: "PRJ-2026-01", intitule: "Remise en état de l'éclairage (démo)", horizon: "court", responsable: "Commission technique", avancement: 40, cout_estime: 1500000, engage: 180000, paye: 85000, fin_prevue: j(40), statut: "en_cours", depassement: false, en_retard: false, decision_ref: "RES-2026-004", cree_le: j(-60, 1) },
    { id: "p2", code: "PRJ-2026-02", intitule: "Nettoyage des caniveaux (démo)", horizon: "court", responsable: "Commission entretien", avancement: 60, cout_estime: 300000, engage: 0, paye: 60000, fin_prevue: j(-10), statut: "en_cours", depassement: false, en_retard: true, decision_ref: "RES-2026-002", cree_le: j(-90, 1) },
    { id: "p3", code: "PRJ-2027-01", intitule: "Aire de loisirs pour enfants (démo)", horizon: "moyen", responsable: "Bureau", avancement: 0, cout_estime: 2000000, engage: 0, paye: 0, fin_prevue: null, statut: "idee", depassement: false, en_retard: false, decision_ref: null, cree_le: j(-10, 1) }],
  suppliers: [{ id: "f1", nom: "Élec Plus (démo)", actif: true }, { id: "f2", nom: "Lumi Cité (démo)", actif: true }, { id: "f3", nom: "Volt Services (démo)", actif: true }],
  quotes: [{ id: "q1", dossier: "Éclairage voie principale (démo)", supplier_id: "f1", montant: 150000, delai_jours: 10, garantie: "1 an", retenu: false },
    { id: "q2", dossier: "Éclairage voie principale (démo)", supplier_id: "f2", montant: 140000, delai_jours: 14, garantie: "2 ans", retenu: false },
    { id: "q3", dossier: "Éclairage voie principale (démo)", supplier_id: "f3", montant: 165000, delai_jours: 7, garantie: "1 an", retenu: false }],
  v_fonds_solidarite: [{ solde: 310000, dons: 400000, aides: 90000 }],
  v_aides_publiees: [{ ref: "SOC-2026-000001", montant: 90000, date_versement: j(-25) }],
  social_cases: [{ id: "s1", ref: "SOC-2026-000007", type: "hospitalisation", description: "Dossier fictif de démonstration", montant_demande: 80000, statut: "proposee", montant_propose: 50000, motif: "Situation vérifiée", cree_le: j(-6, 1), member_id: "m2" }],
  v_carte: [{ couche: "equipement", id: "g1", ref: "EQ-001", libelle: "Lampadaire entrée", sous_type: "lampadaire", statut: "bon", lat: 5.3361, lng: -4.1100 },
    { couche: "equipement", id: "g2", ref: "EQ-002", libelle: "Portail principal", sous_type: "portail", statut: "bon", lat: 5.3372, lng: -4.1086 },
    { couche: "equipement", id: "g3", ref: "EQ-003", libelle: "Pompe du local technique", sous_type: "local", statut: "hors_service", lat: 5.3355, lng: -4.1072 },
    { couche: "incident", id: "n1", ref: "INC-2026-000008", libelle: "Lampadaire éteint voie B", sous_type: "eclairage", statut: "nouveau", lat: 5.3366, lng: -4.1094 }],
  incidents: [], 
  v_assurances_echeances: [{ id: "as1", assureur: "NSIA (démo)", police: "POL-DEMO-1", objet: "Multirisque espaces communs", fin: j(40), jours_restants: 40, etat: "a_renouveler" }],
  insurance_claims: [{ id: "sn1", ref: "SIN-2026-000001", date_sinistre: j(-12), description: "Dégât des eaux au local technique (démo)", montant_estime: 250000, montant_indemnise: null, statut: "instruction", cree_le: j(-12, 1) }],
  v_evolution_charges: [{ type: "eau", compteur: "C1", periode: "2026-09", consommation: 200, montant: 52000, variation_pct: 67.7, variation_an_pct: null, anomalie: true },
    { type: "eau", compteur: "C1", periode: "2026-08", consommation: 125, montant: 31000, variation_pct: 3.3, variation_an_pct: null, anomalie: false },
    { type: "electricite", compteur: "E1", periode: "2026-09", consommation: 900, montant: 118000, variation_pct: 2.1, variation_an_pct: 5.4, anomalie: false }],
  surveys: [{ id: "sv1", titre: "Satisfaction 2026 (démo)", themes: ["Communication", "Entretien", "Confiance"], ouverture: j(-3, 1), cloture: j(10, 1), statut: "ouverte" }],
  v_plan_pluriannuel: [{ annee: 2026, horizon: "court", projets: 2, cout_estime: 1800000, codes: "PRJ-2026-01, PRJ-2026-02" }, { annee: 2028, horizon: "moyen", projets: 1, cout_estime: 2000000, codes: "PRJ-2027-01" }],
  lots: [{ id: "l1", ref: "L-001", libelle: "", statut: "occupe" }, { id: "l2", ref: "L-002", libelle: "", statut: "occupe" }],
  lot_ownerships: [{ id: "o1", lot_id: "l1", member_id: M, lien: "proprietaire", quote_part: 1, date_fin: null }],
  bank_lines: [{ id: "b1", account_id: "k2", date_op: j(-3), libelle: "VIR M-002 (démo)", montant: 10000, statut: "a_rapprocher" }, { id: "b2", account_id: "k2", date_op: j(-10), libelle: "Frais de tenue de compte (démo)", montant: -2500, statut: "ecart" }],
  v_a_rapprocher: [{ id: "x9", ref: "ENC-2026-000015", account_id: "k2", date_op: j(-3), sens: "entree", montant: 10000 }],
  audit_logs: [{ id: 3, le: j(-1, 1), acteur: U, action: "DEPENSE_APPROUVE", table_nom: "expense_requests", ligne_id: "e1" }, { id: 2, le: j(-3, 1), acteur: U, action: "PAIEMENT", table_nom: "payments", ligne_id: "x1" }, { id: 1, le: j(-9, 1), acteur: U, action: "DEPENSE_PAYEE", table_nom: "expense_requests", ligne_id: "e3" }]
};
function Q(t) { this.rows = (T[t] || []).slice(); }
Q.prototype.select = function () { return this; };
Q.prototype.eq = function (k, v) { this.rows = this.rows.filter(function (r) { return r[k] === v; }); return this; };
Q.prototype.in = function (k, v) { this.rows = this.rows.filter(function (r) { return v.indexOf(r[k]) >= 0; }); return this; };
Q.prototype.gte = function (k, v) { this.rows = this.rows.filter(function (r) { return r[k] >= v; }); return this; };
Q.prototype.order = function (k, o) { var s = o && o.ascending === false ? -1 : 1; this.rows.sort(function (a, b) { return (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * s; }); return this; };
Q.prototype.limit = function (n) { this.rows = this.rows.slice(0, n); return this; };
Q.prototype.then = function (res, rej) { return Promise.resolve({ data: this.rows, error: null }).then(res, rej); };

var session = { user: { id: U } };
var client = {
  from: function (t) { return new Q(t); },
  rpc: function (fn) { return Promise.resolve(fn === "verifier_chaine_audit" ? { data: [], error: null } : fn === "a_vote" ? { data: false, error: null } : fn === "indicateurs_performance" ? { data: { taux_recouvrement_pct: 62.5, taux_membres_connectes_pct: 78, execution_budget_pct: 41.2, depenses_avec_justificatif_pct: 100, delai_moyen_validation_depense_h: 31.5, projets_termines_pct: 25, incidents_resolus_pct: 54.5, delai_moyen_reclamation_j: 9.2, participation_moyenne_pct: 65, decisions_executees_pct: 40, aides_versees: 1 }, error: null } : fn === "simuler_scenarios" ? { data: { projection: true, base: { solde_actuel: 1430000, recettes_moy_6m: 260000, depenses_moy_6m: 190000, lots: 40 }, horizon_mois: 12, projet: 2000000, scenarios: [{ scenario: "prudent", recettes_mensuelles: 208000, depenses_mensuelles: 200000, solde_final: 1526000, mois_pour_financer: 71, cotisation_supplementaire_par_lot_et_par_mois: 0 }, { scenario: "realiste", recettes_mensuelles: 260000, depenses_mensuelles: 190000, solde_final: 2270000, mois_pour_financer: 9, cotisation_supplementaire_par_lot_et_par_mois: 0 }, { scenario: "ambitieux", recettes_mensuelles: 299000, depenses_mensuelles: 180500, solde_final: 2851000, mois_pour_financer: 5, cotisation_supplementaire_par_lot_et_par_mois: 0 }] }, error: null } : fn === "resultats_enquete" ? { data: null, error: { message: "Résultats masqués : au moins 5 réponses sont nécessaires pour préserver l'anonymat (démo)." } } : fn === "alertes_controle" ? { data: [{ type: "projet_en_retard", ref: "PRJ-2026-02", detail: "Échéance dépassée (démo)", le: j(0, 1) }], error: null } : { data: null, error: { message: "Mode démonstration : aucune écriture n'est enregistrée." } }); },
  auth: {
    getSession: function () { return Promise.resolve({ data: { session: session } }); },
    signOut: function () { try { sessionStorage.removeItem("arc_demo"); } catch (e) { } return Promise.resolve({}); },
    onAuthStateChange: function () { return {}; },
    signInWithPassword: function () { return Promise.resolve({ error: { message: "démo" } }); }
  },
  storage: { from: function () { return { createSignedUrl: function () { return Promise.resolve({ error: { message: "démo" } }); } }; } }
};

G.ARC_DEMO = { client: client };
})(window);
