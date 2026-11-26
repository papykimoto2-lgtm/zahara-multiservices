\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
-- Utilisateurs
insert into auth.users(id) values
 ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000c1'),
 ('00000000-0000-0000-0000-0000000000d1'),('00000000-0000-0000-0000-0000000000e1'),('00000000-0000-0000-0000-0000000000f1'),
 ('00000000-0000-0000-0000-000000000011'),('00000000-0000-0000-0000-000000000012');
-- a1 admin technique, b1 président, c1 trésorier, d1 second approbateur, e1 resp. commission, f1 membre, 11 commission sociale (demandeur), 12 contrôleur
insert into app.user_roles(user_id, role_code) values
 ('00000000-0000-0000-0000-0000000000a1','admin_technique'),('00000000-0000-0000-0000-0000000000b1','president'),
 ('00000000-0000-0000-0000-0000000000c1','tresorier'),('00000000-0000-0000-0000-0000000000d1','second_approbateur'),
 ('00000000-0000-0000-0000-0000000000e1','responsable_commission'),('00000000-0000-0000-0000-0000000000f1','membre'),
 ('00000000-0000-0000-0000-000000000011','commission_sociale'),('00000000-0000-0000-0000-000000000012','controleur');
insert into app.members(id, ref, nom, user_id) values
 ('10000000-0000-0000-0000-000000000001','M-001','Kouassi','00000000-0000-0000-0000-0000000000f1'),
 ('10000000-0000-0000-0000-000000000002','M-002','Traoré',null);
insert into app.lots(id, ref) values ('20000000-0000-0000-0000-000000000001','L-001'),('20000000-0000-0000-0000-000000000002','L-002');
insert into app.lot_ownerships(lot_id, member_id, lien) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','proprietaire'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','proprietaire');
insert into app.cash_accounts(id, code, nom, type, solde_ouverture) values ('30000000-0000-0000-0000-000000000001','CAI','Caisse','caisse',100000);
insert into app.budgets(id, exercice, statut) values ('40000000-0000-0000-0000-000000000001', 2026, 'adopte');
insert into app.budget_lines(id, budget_id, categorie, montant_prevu) values ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','entretien',150000);
insert into app.contributions(id, libelle, montant, debut, paiement_partiel) values ('60000000-0000-0000-0000-000000000001','Cotisation mensuelle',10000,'2026-01-01',true);

grant usage on schema t to authenticated;

-- ═══ Droits : anti-escalade ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.err($$select app.attribuer_role('00000000-0000-0000-0000-0000000000f1','tresorier')$$, 'Seul le président');
select t.err($$select app.attribuer_role('00000000-0000-0000-0000-0000000000f1','president')$$, 'Seul le président');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.eq((select count(*)::int from (select app.attribuer_role('00000000-0000-0000-0000-0000000000f1','commission_sociale')) s), 1, 'président attribue un rôle');
reset role;

-- ═══ Cotisations et paiements ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.eq(app.creer_appels('60000000-0000-0000-0000-000000000001','2026-12','2026-12-31'), 2, 'appels générés pour 2 propriétaires');
select t.eq(app.creer_appels('60000000-0000-0000-0000-000000000001','2026-12','2026-12-31'), 0, 'appels non dupliqués');
select t.eq((select statut from app.v_appels where member_id='10000000-0000-0000-0000-000000000001'), 'appele', 'statut initial = appelé');
select app.enregistrer_paiement((select id from app.v_appels where member_id='10000000-0000-0000-0000-000000000001'), null, '30000000-0000-0000-0000-000000000001', 4000, 'especes');
select t.eq((select statut from app.v_appels where member_id='10000000-0000-0000-0000-000000000001'), 'partiel', 'paiement partiel');
select t.eq((select reste from app.v_appels where member_id='10000000-0000-0000-0000-000000000001'), 6000::numeric, 'reste dû');
select t.err($$select app.enregistrer_paiement((select id from app.v_appels where member_id='10000000-0000-0000-0000-000000000001'), null, '30000000-0000-0000-0000-000000000001', 7000, 'especes')$$, 'dépasse le reste');
select t.eq((select solde from app.v_soldes_comptes), 104000::numeric, 'solde caisse = ouverture + encaissé');
-- Immuabilité du grand livre
select t.err($$update app.cash_movements set montant = 1$$, 'permission denied');
select t.err($$delete from app.cash_movements$$, 'permission denied');
-- Contrepassation motivée
select t.err($$select app.annuler_mouvement((select id from app.cash_movements limit 1), 'x')$$, 'Motif obligatoire');
select app.annuler_mouvement((select id from app.cash_movements limit 1), 'Erreur de saisie du montant');
select t.eq((select solde from app.v_soldes_comptes), 100000::numeric, 'solde revenu après contrepassation');
select t.eq((select statut from app.v_appels where member_id='10000000-0000-0000-0000-000000000001'), 'appele', 'appel redevient impayé');
select t.err($$select app.annuler_mouvement((select id from app.cash_movements limit 1), 'Double annulation')$$, 'déjà annulée');
reset role;

-- Paiement refusé à un membre ordinaire
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.err($$select app.enregistrer_paiement(null,'10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1000,'especes')$$, 'Droit insuffisant');
reset role;

-- ═══ Dépenses : circuit, séparation des tâches ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-000000000011');
create temp table ctx(k text primary key, v uuid); grant all on ctx to authenticated;
insert into ctx select 'd1', app.soumettre_depense('Réparer lampadaire', 20000, 'entretien', '50000000-0000-0000-0000-000000000001', 'Élec Plus', array['devis-001.pdf']);
select t.err($$select app.soumettre_depense('Trop cher', 200000, 'entretien', '50000000-0000-0000-0000-000000000001', 'X', array['d.pdf'])$$, 'Budget insuffisant');
select t.err($$select app.soumettre_depense('Gros chantier', 600000, 'travaux', null, 'X', array['d.pdf'])$$, 'Décision ou vote');
select t.err($$select app.decider_depense((select v from ctx where k='d1'), 'commission_sociale', 'approuve')$$, 'Droit insuffisant');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.err($$select app.payer_depense((select v from ctx where k='d1'), '30000000-0000-0000-0000-000000000001', 'RECU-1')$$, 'non approuvée');
select t.eq(app.decider_depense((select v from ctx where k='d1'), 'tresorier', 'approuve'), 'en_attente:responsable_commission', 'une seule validation ne suffit pas');
select t.err($$select app.decider_depense((select v from ctx where k='d1'), 'tresorier', 'approuve')$$, 'duplicate key');
select t.as_user('00000000-0000-0000-0000-0000000000d1');
select t.err($$select app.decider_depense((select v from ctx where k='d1'), 'second_approbateur', 'approuve')$$, 'pas requis');
select t.as_user('00000000-0000-0000-0000-0000000000e1');
select t.eq(app.decider_depense((select v from ctx where k='d1'), 'responsable_commission', 'approuve'), 'approuvee', 'dépense approuvée');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.err($$select app.payer_depense((select v from ctx where k='d1'), '30000000-0000-0000-0000-000000000001', '')$$, 'Justificatif de règlement');
select app.payer_depense((select v from ctx where k='d1'), '30000000-0000-0000-0000-000000000001', 'RECU-1');
select t.eq((select solde from app.v_soldes_comptes), 80000::numeric, 'sortie de caisse enregistrée');
select t.eq((select paye from app.v_budget_execution), 20000::numeric, 'budget : payé');
select t.err($$select app.payer_depense((select v from ctx where k='d1'), '30000000-0000-0000-0000-000000000001', 'RECU-2')$$, 'non approuvée');
-- Auto-validation interdite : le demandeur ne valide pas sa propre dépense
insert into ctx select 'd2', app.soumettre_depense('Fournitures', 5000, 'entretien', '50000000-0000-0000-0000-000000000001', 'Papeterie', array['facture.pdf']);
select t.err($$select app.decider_depense((select v from ctx where k='d2'), 'tresorier', 'approuve')$$, 'propre dépense');
select t.err($$select app.decider_depense((select v from ctx where k='d2'), 'tresorier', 'rejete', 'x')$$, 'propre dépense');
reset role;

-- ═══ RLS : cloisonnement des données ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.eq((select count(*)::int from app.cash_movements), 0, 'membre : aucun accès au grand livre');
select t.eq((select count(*)::int from app.contribution_calls), 1, 'membre : voit seulement ses appels');
select t.eq((select count(*)::int from app.members), 1, 'membre : voit seulement sa fiche');
select t.eq((select count(*)::int from app.expense_requests), 0, 'membre : aucune dépense');
select t.err($$insert into app.cash_movements(ref,account_id,sens,montant,categorie,source_type) values ('X','30000000-0000-0000-0000-000000000001','entree',5,'x','ajustement')$$, 'permission denied');
with u as (update app.members set nom = 'Pirate' returning 1) select t.eq((select count(*)::int from u), 0, 'membre : aucune fiche modifiable');
select t.err($$insert into app.validation_rules(montant_min, roles_requis) values (0,'{membre}')$$, 'row-level security');
select t.eq((select count(*)::int from app.audit_logs), 0, 'membre : journal d''audit invisible');
reset role;

-- ═══ Audit : lecture contrôleur, ajout seul, chaîne intacte ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-000000000012');
select t.eq((select count(*) > 10 from app.audit_logs), true, 'contrôleur lit le journal');
select t.err($$update app.audit_logs set action = 'X'$$, 'permission denied');
select t.eq((select count(*)::int from app.verifier_chaine_audit()), 0, 'chaîne d''audit intacte');
select t.err($$select app.payer_depense(gen_random_uuid(), '30000000-0000-0000-0000-000000000001', 'x')$$, 'Droit insuffisant');
reset role;
-- Le propriétaire de la table ne peut pas non plus réécrire l'audit
select t.err($$update app.audit_logs set action = 'X'$$, 'en ajout seul');
select t.err($$delete from app.audit_logs$$, 'en ajout seul');
select t.err($$truncate app.audit_logs$$, 'en ajout seul');
-- Rupture simulée de chaîne (en désactivant le trigger) → détectée
alter table app.audit_logs disable trigger audit_no_update;
update app.audit_logs set empreinte_prec = 'forge' where id = (select max(id) from app.audit_logs);
alter table app.audit_logs enable trigger audit_no_update;
set role authenticated; select t.as_user('00000000-0000-0000-0000-000000000012');
select t.eq((select count(*)::int from app.verifier_chaine_audit()), 1, 'falsification détectée');
reset role;

-- Grand livre immuable même pour le propriétaire de la table
select t.err($$update app.cash_movements set montant = 1$$, 'immuable');
select t.err($$delete from app.cash_movements$$, 'immuable');
select t.err($$update app.payments set montant = 1$$, 'non modifiable');

-- ═══ PV : versions figées ═══
insert into app.meetings(id, ref, type, titre, date_heure, convoquee) values ('70000000-0000-0000-0000-000000000001','R-1','bureau','Bureau',now(),true);
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000b1');
insert into app.minutes(id, meeting_id, version, contenu) values ('80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',1,'v1');
select t.err($$select app.publier_pv('80000000-0000-0000-0000-000000000001')$$, 'validé');
update app.minutes set statut = 'valide';
select t.err($$update app.minutes set contenu = 'modifié'$$, 'seule la publication');
select app.publier_pv('80000000-0000-0000-0000-000000000001');
select t.err($$update app.minutes set contenu = 'modifié'$$, 'publié');
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.eq((select count(*)::int from app.minutes), 1, 'membre voit le PV publié');
reset role;
\echo TOUS LES TESTS PASSENT
