\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
-- Suite V2 : s'exécute APRÈS arc.test.sql (mêmes utilisateurs). Nouveaux membres : 13, 14, 15 (copropriétaires), 16 (locataire).
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000013'),('00000000-0000-0000-0000-000000000014'),('00000000-0000-0000-0000-000000000015'),('00000000-0000-0000-0000-000000000016');
insert into app.members(id, ref, nom, user_id, statut) values
 ('10000000-0000-0000-0000-000000000003','M-003','Konan','00000000-0000-0000-0000-000000000013','coproprietaire'),
 ('10000000-0000-0000-0000-000000000004','M-004','Yao','00000000-0000-0000-0000-000000000014','coproprietaire'),
 ('10000000-0000-0000-0000-000000000005','M-005','Bamba','00000000-0000-0000-0000-000000000015','coproprietaire'),
 ('10000000-0000-0000-0000-000000000006','M-006','Diallo','00000000-0000-0000-0000-000000000016','locataire');
create temp table ctx(k text primary key, v text); grant all on ctx to authenticated;
grant usage on schema t to authenticated;

-- ═══ Consultations : un vote par membre, bulletin secret, résultat figé ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000b1');
insert into app.consultations(ref, titre, options, ouverture, cloture, quorum_pct, majorite)
  values ('CON-1','Priorité 2027','{Éclairage,Voirie,Sécurité}', now() - interval '1 hour', now() + interval '1 hour', 50, 'simple');
insert into ctx select 'c', id::text from app.consultations where ref = 'CON-1';
select t.err($$update app.consultations set statut = 'close', resultat = '{"adopte":true}'$$, 'permission denied');
select t.as_user('00000000-0000-0000-0000-000000000013');
select t.err($$select app.voter((select v::uuid from ctx where k='c'), 0)$$, 'non ouverte');   -- brouillon : vote refusé
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.err($$select app.ouvrir_consultation((select v::uuid from ctx where k='c'))$$, 'Droit insuffisant');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select app.ouvrir_consultation((select v::uuid from ctx where k='c'));
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.eq(length(app.voter((select v::uuid from ctx where k='c'), 0)), 64, 'le membre vote et reçoit un reçu vérifiable');
select t.err($$select app.voter((select v::uuid from ctx where k='c'), 1)$$, 'déjà voté');
select t.err($$select app.voter((select v::uuid from ctx where k='c'), 7)$$, 'Choix invalide');
select t.eq(app.a_vote((select v::uuid from ctx where k='c')), true, 'a_vote reflète l''émargement');
select t.as_user('00000000-0000-0000-0000-000000000013'); select app.voter((select v::uuid from ctx where k='c'), 0);
select t.as_user('00000000-0000-0000-0000-000000000014'); select app.voter((select v::uuid from ctx where k='c'), 1);
select t.as_user('00000000-0000-0000-0000-000000000016');
select t.err($$select app.voter((select v::uuid from ctx where k='c'), 0)$$, 'pas éligible');
select t.err($$select count(*) from app.bulletins$$, 'permission denied');
select t.err($$select count(*) from app.emargements$$, 'permission denied');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.err($$select app.clore_consultation((select v::uuid from ctx where k='c'))$$, 'période de vote');
reset role;
select t.eq((select count(*)::int from information_schema.columns where table_schema='app' and table_name='bulletins' and column_name ilike '%member%'), 0, 'secret du vote : aucun lien membre dans les bulletins');
update app.consultations set cloture = now() - interval '1 minute', ouverture = now() - interval '2 hours' where ref = 'CON-1';
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ctx select 'res', app.clore_consultation((select v::uuid from ctx where k='c'))::text;
select t.eq((select (v::jsonb->>'votants')::int from ctx where k='res'), 3, 'dépouillement : 3 votants');
select t.eq((select (v::jsonb->>'electeurs')::int from ctx where k='res'), 5, 'dépouillement : 5 électeurs (copropriétaires actifs)');
select t.eq((select v::jsonb->'voix' from ctx where k='res')::text, '[2, 1, 0]', 'dépouillement : voix par option');
select t.eq((select (v::jsonb->>'adopte')::boolean from ctx where k='res'), true, 'option gagnante adoptée (quorum 50 % atteint : 60 %)');
select t.eq((select jsonb_array_length(v::jsonb->'recus')::int from ctx where k='res'), 3, 'liste publique des reçus (preuve vérifiable)');
select t.err($$update app.consultations set titre = 'Truqué'$$, 'résultat figé');
select t.err($$select app.clore_consultation((select v::uuid from ctx where k='c'))$$, 'non ouverte');
reset role;

-- ═══ Idées ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000f1');
insert into ctx select 'idee', app.proposer('Aire de jeux', 'Aménager un espace pour les enfants', 'activites', 800000)::text;
select t.eq((select count(*)::int from app.propositions), 1, 'le membre voit sa proposition');
select t.as_user('00000000-0000-0000-0000-000000000014'); select t.eq((select count(*)::int from app.propositions), 0, 'les autres membres ne voient pas une idée non traitée');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.err($$select app.traiter_proposition((select v::uuid from ctx where k='idee'), 'rejetee')$$, 'violates check');
select app.traiter_proposition((select v::uuid from ctx where k='idee'), 'acceptee', 'À inscrire au plan à moyen terme.');
select t.as_user('00000000-0000-0000-0000-000000000014'); select t.eq((select count(*)::int from app.propositions), 1, 'idée acceptée : publique');
select t.as_user('00000000-0000-0000-0000-0000000000f1'); select t.eq((select count(*)::int from app.notifications where titre like 'Votre proposition%'), 1, 'l''auteur est notifié');
reset role;

-- ═══ Réclamations ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000f1');
insert into ctx select 'rec', app.deposer_reclamation('cotisation', 'Erreur de montant', 'Le montant appelé est faux')::text;
insert into ctx select 'med', app.deposer_reclamation('conflit_usage', 'Conflit avec un voisin', 'Détails sensibles', true)::text;
select t.as_user('00000000-0000-0000-0000-000000000013'); select t.eq((select count(*)::int from app.complaints), 0, 'un membre ne voit pas les réclamations des autres');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.err($$select app.traiter_reclamation((select v::uuid from ctx where k='rec'), 'en_analyse', 'Analyse en cours')$$, 'Droit insuffisant');
select t.as_user('00000000-0000-0000-0000-0000000000e1'); select t.eq((select count(*)::int from app.complaints), 0, 'responsable de commission : pas d''accès aux réclamations');
select t.as_user('00000000-0000-0000-0000-000000000011'); select t.eq((select count(*)::int from app.complaints), 0, 'commission sociale : pas d''accès aux réclamations');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.err($$select app.traiter_reclamation((select v::uuid from ctx where k='rec'), 'repondue', 'ok')$$, 'Message motivé');
select app.traiter_reclamation((select v::uuid from ctx where k='rec'), 'repondue', 'Erreur confirmée, correction faite.');
select t.eq((select count(*)::int from app.complaints), 2, 'président (médiation) voit les deux dossiers');
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select app.demander_reexamen((select v::uuid from ctx where k='rec'), 'Le solde reste faux');
select t.eq((select statut from app.complaints where id = (select v::uuid from ctx where k='rec')), 'reexamen', 'réexamen demandé par le propriétaire');
select t.eq((select count(*)::int from app.complaint_updates where complaint_id = (select v::uuid from ctx where k='rec')), 3, 'historique de la réclamation : 3 étapes');
select t.as_user('00000000-0000-0000-0000-000000000013'); select t.err($$select app.demander_reexamen((select v::uuid from ctx where k='rec'), 'Pas la mienne')$$, 'Réexamen impossible');
reset role;
select t.err($$update app.complaint_updates set message = 'x'$$, 'immuables');

-- ═══ Incidents ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000f1');
insert into ctx select 'inc', app.signaler_incident('fuite', 'Fuite d''eau devant le lot 12', 'Voie B')::text;
select t.as_user('00000000-0000-0000-0000-000000000013');
select t.eq((select count(*)::int from app.v_incidents_publics), 1, 'la cité voit les incidents (vue publique)');
select t.eq((select count(*)::int from information_schema.columns where table_schema='app' and table_name='v_incidents_publics' and column_name = 'declarant'), 0, 'le déclarant n''est jamais exposé');
select t.eq((select count(*)::int from app.incidents), 0, 'détail réservé au déclarant et aux responsables');
select t.eq((select priorite from app.v_incidents_publics), 'haute', 'priorité automatique d''une fuite');
select t.as_user('00000000-0000-0000-0000-0000000000e1');
select t.err($$select app.traiter_incident((select v::uuid from ctx where k='inc'), 'resolu', 'Réparé')$$, 'Preuve de résolution');
select app.traiter_incident((select v::uuid from ctx where k='inc'), 'en_intervention', 'Plombier mandaté', null, 'Plomberie Cité', current_date + 2);
select app.traiter_incident((select v::uuid from ctx where k='inc'), 'resolu', 'Réparé', null, null, null, 'RAPPORT-INT-04');
select t.err($$select app.traiter_incident((select v::uuid from ctx where k='inc'), 'en_analyse', 'x')$$, 'Incident clos');
select t.as_user('00000000-0000-0000-0000-0000000000f1'); select t.eq((select count(*)::int from app.notifications where titre like 'Incident%'), 2, 'le déclarant est informé de chaque étape');
reset role;

-- ═══ Projets, devis, contrôle ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000b1');
insert into app.projects(code, intitule, horizon, cout_estime, fin_prevue) values ('PRJ-1', 'Éclairage de la voie principale', 'court', 10000, current_date - 1);
insert into ctx select 'prj', id::text from app.projects where code = 'PRJ-1';
select t.err($$update app.projects set statut = 'en_cours'$$, 'Décision autorisant');
update app.projects set statut = 'en_cours', decision_ref = 'RES-2026-004';
select t.err($$update app.projects set statut = 'termine', avancement = 80, bilan = 'Fait'$$, '100');
select app.lier_depense_projet((select id from app.expense_requests where statut = 'payee' limit 1), (select v::uuid from ctx where k='prj'));
select t.eq((select depassement from app.v_projets where code = 'PRJ-1'), true, 'projet : dépassement de budget signalé');
select t.eq((select en_retard from app.v_projets where code = 'PRJ-1'), true, 'projet : retard signalé');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
insert into app.suppliers(nom) values ('Élec Plus'), ('Lumi Cité'), ('Volt Services');
insert into app.quotes(dossier, supplier_id, montant, delai_jours) select 'Éclairage', id, 150000, 10 from app.suppliers where nom in ('Élec Plus','Lumi Cité');
select t.err($$select app.retenir_devis((select id from app.quotes where dossier='Éclairage' order by montant, cree_le limit 1), 'Meilleur prix')$$, 'devis comparables');
insert into app.quotes(dossier, supplier_id, montant, delai_jours) select 'Éclairage', id, 140000, 14 from app.suppliers where nom = 'Volt Services';
select t.err($$select app.retenir_devis((select id from app.quotes where montant=140000), 'x')$$, 'Justification');
select app.retenir_devis((select id from app.quotes where montant=140000), 'Prix le plus bas et garantie 2 ans', 'RES-2026-005');
select t.err($$select app.retenir_devis((select id from app.quotes where montant=150000 limit 1), 'Autre choix motivé')$$, 'déjà retenu');
select t.as_user('00000000-0000-0000-0000-0000000000f1'); select t.eq((select count(*)::int from app.quotes), 0, 'devis invisibles pour un simple membre');
select t.err($$select * from app.alertes_controle()$$, 'Droit insuffisant');
select t.as_user('00000000-0000-0000-0000-000000000012');
select t.eq((select count(*) from app.alertes_controle() where type = 'projet_hors_budget') > 0, true, 'alerte : projet hors budget');
select t.eq((select count(*) from app.alertes_controle() where type = 'annulation_apres_validation') > 0, true, 'alerte : écriture contrepassée');
select t.eq((select count(*) from app.alertes_controle() where type = 'projet_en_retard') > 0, true, 'alerte : projet en retard');
reset role;

-- ═══ Solidarité ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000b1');
insert into app.cash_accounts(id, code, nom, type) values ('30000000-0000-0000-0000-000000000002','FS','Fonds de solidarité','fonds_solidarite');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select app.enregistrer_don('30000000-0000-0000-0000-000000000002', 100000, 'Association des femmes');
select t.err($$select app.enregistrer_don('30000000-0000-0000-0000-000000000001', 5000)$$, 'fonds de solidarité');
select t.as_user('00000000-0000-0000-0000-000000000013');
insert into ctx select 'soc', app.demander_aide('hospitalisation', 'Hospitalisation de ma mère à la clinique', 80000)::text;
select t.as_user('00000000-0000-0000-0000-000000000014'); select t.eq((select count(*)::int from app.social_cases), 0, 'dossier social invisible des autres membres');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.err($$select app.decider_aide((select v::uuid from ctx where k='soc'), true)$$, 'Aucune proposition');
select t.as_user('00000000-0000-0000-0000-000000000011');
select app.instruire_aide((select v::uuid from ctx where k='soc'), 50000, 'Situation vérifiée');
select t.err($$select app.decider_aide((select v::uuid from ctx where k='soc'), true)$$, 'Droit insuffisant');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.err($$select app.verser_aide((select v::uuid from ctx where k='soc'), '30000000-0000-0000-0000-000000000002')$$, 'non validée');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select app.decider_aide((select v::uuid from ctx where k='soc'), true);
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.err($$select app.verser_aide((select v::uuid from ctx where k='soc'), '30000000-0000-0000-0000-000000000001')$$, 'fonds de solidarité');
select app.verser_aide((select v::uuid from ctx where k='soc'), '30000000-0000-0000-0000-000000000002');
select t.as_user('00000000-0000-0000-0000-000000000014');
select t.eq((select aides from app.v_fonds_solidarite), 50000::numeric, 'fonds : aides versées');
select t.eq((select solde from app.v_fonds_solidarite), 50000::numeric, 'fonds : solde = dons − aides');
select t.eq((select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='app' and table_name='v_aides_publiees'), 'ref,montant,date_versement', 'publication : montant et date seulement');
select t.eq((select count(*)::int from app.v_aides_publiees), 1, 'aide publiée sans identité');
reset role;
select t.eq((select count(*)::int from app.audit_logs where apres::text like '%Hospitalisation%' or avant::text like '%Hospitalisation%'), 0, 'la situation personnelle n''apparaît jamais dans le journal d''audit');

-- ═══ Bilan trimestriel et fonctions internes ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.err($$select app.publier_bilan_trimestriel('2026-T4','2026-10-01','2026-12-31')$$, 'Droit insuffisant');
select t.err($$select app.bilan_json('2026-10-01','2026-12-31')$$, 'permission denied');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select app.publier_bilan_trimestriel('2026-T4','2026-10-01','2026-12-31');
select t.err($$select app.publier_bilan_trimestriel('2026-T4','2026-10-01','2026-12-31')$$, 'déjà publié');
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.eq((select (contenu->>'incidents_resolus')::int from app.etats_publies where titre = 'Bilan trimestriel'), 1, 'bilan : incidents résolus');
select t.eq((select (contenu->'decisions'->>'total')::int >= 0 from app.etats_publies where titre = 'Bilan trimestriel'), true, 'bilan : décisions comptées');
select t.as_user('00000000-0000-0000-0000-000000000012'); select t.eq((select count(*)::int from app.verifier_chaine_audit()) >= 0, true, 'contrôleur : vérification de chaîne disponible');
reset role;
\echo TOUS LES TESTS V2 PASSENT
