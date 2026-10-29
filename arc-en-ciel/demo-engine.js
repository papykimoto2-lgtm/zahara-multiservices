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
    ["finance.lire", "finance.encaisser", "finance.annuler", "finance.publier", "depense.creer", "depense.approuver", "depense.payer", "audit.lire"].forEach(function (p) {
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
  cash_accounts: [{ id: "k1", code: "CAI", nom: "Caisse (démo)", actif: true }, { id: "k2", code: "BQ", nom: "Banque (démo)", actif: true }],
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
  rpc: function (fn) { return Promise.resolve(fn === "verifier_chaine_audit" ? { data: [], error: null } : { data: null, error: { message: "Mode démonstration : aucune écriture n'est enregistrée." } }); },
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
