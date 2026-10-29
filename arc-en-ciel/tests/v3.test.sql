\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
-- Suite V3 : s'exécute APRÈS arc.test.sql et v2.test.sql (mêmes utilisateurs).
create temp table ctx(k text primary key, v text); grant all on ctx to authenticated;
grant usage on schema t to authenticated;

-- ═══ Géolocalisation et carte ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000e1');
insert into app.assets(ref, type, nom, localisation, lat, lng) values ('EQ-001','lampadaire','Lampadaire voie B','Voie B', 5.3361, -4.1100);
insert into ctx select 'a', id::text from app.assets where ref = 'EQ-001';
select t.err($$select app.positionner_actif((select v::uuid from ctx where k='a'), 95, 0)$$, 'invalides');
select app.positionner_actif((select v::uuid from ctx where k='a'), 5.3370, -4.1105);
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.err($$select app.positionner_actif((select v::uuid from ctx where k='a'), 5.1, -4.1)$$, 'Droit insuffisant');
select t.eq((select count(*)::int from app.v_carte where couche = 'equipement'), 1, 'carte : équipement visible de tous');
insert into ctx select 'i', app.signaler_incident('eclairage', 'Lampadaire éteint devant le lot 3', 'Voie B', (select v::uuid from ctx where k='a'))::text;
select app.positionner_incident((select v::uuid from ctx where k='i'), 5.3372, -4.1107);
select t.as_user('00000000-0000-0000-0000-000000000013');
select t.err($$select app.positionner_incident((select v::uuid from ctx where k='i'), 5.0, -4.0)$$, 'non autorisé');
select t.eq((select count(*)::int from app.v_carte where couche = 'incident'), 1, 'carte : incident ouvert visible');
select t.eq((select count(*)::int from information_schema.columns where table_schema='app' and table_name='v_carte' and column_name in ('declarant','member_id','description')), 0, 'carte : aucune donnée personnelle exposée');
reset role;

-- ═══ Assurances et sinistres ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000c1');
insert into app.insurance_contracts(assureur, police, objet, prime_annuelle, debut, fin) values ('NSIA', 'POL-001', 'Multirisque espaces communs', 450000, current_date - 100, current_date + 40);
insert into ctx select 'c', id::text from app.insurance_contracts where police = 'POL-001';
select t.eq((select etat from app.v_assurances_echeances where police = 'POL-001'), 'a_renouveler', 'assurance : échéance à renouveler (< 60 jours)');
select t.err($$select app.declarer_sinistre((select v::uuid from ctx where k='c'), current_date + 100, 'Dégât des eaux au local')$$, 'hors période');
insert into ctx select 's', app.declarer_sinistre((select v::uuid from ctx where k='c'), current_date - 2, 'Dégât des eaux au local technique', 250000)::text;
select t.err($$update app.insurance_claims set statut = 'indemnise'$$, 'violates check');
update app.insurance_claims set statut = 'indemnise', montant_indemnise = 200000;
select t.as_user('00000000-0000-0000-0000-0000000000f1'); select t.eq((select count(*)::int from app.insurance_contracts), 0, 'assurances invisibles pour un simple membre');
reset role;

-- ═══ Consommations et évolution des charges ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000c1');
insert into app.utility_readings(type, compteur, periode, consommation, montant) values ('eau','C1','2026-07',120,30000),('eau','C1','2026-08',125,31000),('eau','C1','2026-09',200,52000);
select t.eq((select variation_pct from app.v_evolution_charges where periode = '2026-08'), 3.3, 'charges : variation mensuelle');
select t.eq((select anomalie from app.v_evolution_charges where periode = '2026-09'), true, 'charges : hausse > 30 % signalée');
select t.eq((select anomalie from app.v_evolution_charges where periode = '2026-08'), false, 'charges : variation normale non signalée');
select t.err($$insert into app.utility_readings(type, compteur, periode, montant) values ('eau','C1','2026-13',1)$$, 'violates check');
select t.as_user('00000000-0000-0000-0000-0000000000f1'); select t.err($$insert into app.utility_readings(type, compteur, periode, montant) values ('eau','C2','2026-09',1)$$, 'row-level security');
reset role;

-- ═══ Enquêtes de satisfaction : anonymes, agrégées à partir de 5 réponses ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000b1');
insert into app.surveys(titre, themes, ouverture, cloture) values ('Satisfaction 2026', '{Communication,Entretien,Confiance}', now() - interval '1 hour', now() + interval '1 day');
insert into ctx select 'e', id::text from app.surveys where titre = 'Satisfaction 2026';
select app.ouvrir_enquete((select v::uuid from ctx where k='e'));
select t.as_user('00000000-0000-0000-0000-0000000000f1'); select app.repondre_enquete((select v::uuid from ctx where k='e'), array[5,4,5]);
select t.err($$select app.repondre_enquete((select v::uuid from ctx where k='e'), array[1,1,1])$$, 'déjà répondu');
select t.err($$select app.repondre_enquete((select v::uuid from ctx where k='e'), array[1,1])$$, 'Une note par thème');
select t.err($$select * from app.resultats_enquete((select v::uuid from ctx where k='e'))$$, 'au moins 5 réponses');
select t.as_user('00000000-0000-0000-0000-000000000013');
select t.err($$select app.repondre_enquete((select v::uuid from ctx where k='e'), array[1,9,1])$$, 'violates check');
select app.repondre_enquete((select v::uuid from ctx where k='e'), array[4,4,4]);
select t.as_user('00000000-0000-0000-0000-000000000014'); select app.repondre_enquete((select v::uuid from ctx where k='e'), array[3,4,5]);
select t.as_user('00000000-0000-0000-0000-000000000015'); select app.repondre_enquete((select v::uuid from ctx where k='e'), array[4,5,4]);
select t.as_user('00000000-0000-0000-0000-0000000000b1'); select t.err($$select count(*) from app.survey_answers$$, 'permission denied');
select t.err($$select app.repondre_enquete((select v::uuid from ctx where k='e'), array[5,5,5])$$, 'Seuls les membres');
reset role;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000017') on conflict do nothing;
insert into app.members(id, ref, nom, user_id) values ('10000000-0000-0000-0000-000000000007','M-007','Sidibé','00000000-0000-0000-0000-000000000017');
set role authenticated; select t.as_user('00000000-0000-0000-0000-000000000017'); select app.repondre_enquete((select v::uuid from ctx where k='e'), array[5,5,5]);
select t.eq((select moyenne from app.resultats_enquete((select v::uuid from ctx where k='e')) where theme = 'Communication'), 4.20, 'enquête : moyenne par thème (5 réponses)');
select t.eq((select count(*)::int from app.resultats_enquete((select v::uuid from ctx where k='e'))), 3, 'enquête : 3 thèmes agrégés');
reset role;
select t.eq((select count(*)::int from information_schema.columns where table_schema='app' and table_name='survey_answers' and column_name ilike '%member%'), 0, 'enquête : aucun lien membre dans les réponses');

-- ═══ Rapprochement bancaire ═══
insert into app.cash_accounts(id, code, nom, type, solde_ouverture) values ('30000000-0000-0000-0000-000000000003','BQ','Banque','banque',0);
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000c1');
select app.enregistrer_paiement((select id from app.v_appels where member_id='10000000-0000-0000-0000-000000000002' limit 1), null, '30000000-0000-0000-0000-000000000003', 10000, 'virement', 'VIR-77');
select t.eq((select count(*)::int from app.v_a_rapprocher), 1, 'banque : écriture à rapprocher');
select t.eq(app.importer_releve('30000000-0000-0000-0000-000000000003', '[{"date":"2026-10-28","libelle":"VIR M-002","montant":10000,"ref":"VIR-77"},{"date":"2026-10-29","libelle":"Frais tenue de compte","montant":-2500}]'), 2, 'relevé importé (2 lignes)');
select t.eq(app.importer_releve('30000000-0000-0000-0000-000000000003', '[{"date":"2026-10-28","libelle":"VIR M-002","montant":10000,"ref":"VIR-77"}]'), 0, 'relevé : ligne déjà importée ignorée');
select t.err($$select app.rapprocher((select id from app.bank_lines where montant = -2500), (select id from app.v_a_rapprocher))$$, 'Montants différents');
select app.rapprocher((select id from app.bank_lines where montant = 10000), (select id from app.v_a_rapprocher));
select t.err($$select app.rapprocher((select id from app.bank_lines where montant = 10000), (select id from app.cash_movements where ref like 'ENC%' limit 1))$$, 'déjà rapprochée');
select t.eq((select count(*)::int from app.v_a_rapprocher), 0, 'banque : plus rien à rapprocher');
select app.signaler_ecart((select id from app.bank_lines where montant = -2500), 'Frais bancaires non saisis en comptabilité');
select t.eq((select statut from app.bank_lines where montant = -2500), 'ecart', 'banque : écart signalé');
select t.as_user('00000000-0000-0000-0000-0000000000f1'); select t.err($$select app.importer_releve('30000000-0000-0000-0000-000000000003', '[]')$$, 'Droit insuffisant');
reset role;

-- ═══ Prévisions, plan pluriannuel, indicateurs, rappels ═══
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.err($$select app.simuler_scenarios(12, 500000)$$, 'Droit insuffisant');
select t.eq((app.indicateurs_performance(current_date - 365, current_date)->>'membres_actifs')::int >= 7, true, 'indicateurs : accessibles à tout membre (agrégats sans donnée personnelle)');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.err($$select app.simuler_scenarios(0, 1)$$, 'Horizon');
select t.eq(jsonb_array_length(app.simuler_scenarios(12, 2000000)->'scenarios'), 3, 'simulation : 3 scénarios (prudent, réaliste, ambitieux)');
select t.eq((app.simuler_scenarios(12, 2000000)->>'projection')::boolean, true, 'simulation : marquée « projection »');
select t.eq((app.simuler_scenarios(12, 2000000)->'scenarios'->0->>'scenario'), 'prudent', 'simulation : ordre des scénarios');
select t.eq((select count(*)::int from app.v_plan_pluriannuel) >= 1, true, 'plan pluriannuel : projets regroupés par année');
select t.err($$select app.bilan_json(current_date, current_date)$$, 'permission denied');
select t.eq(app.generer_rappels() >= 0, true, 'rappels automatiques générés');
select t.eq(app.generer_rappels(), 0, 'rappels : idempotents (aucun doublon)');
select t.as_user('00000000-0000-0000-0000-0000000000f1'); select t.err($$select app.generer_rappels()$$, 'Droit insuffisant');
reset role;

-- ═══ Signature numérique : registre, clé publique seule, révocation, vérification publique ═══
\echo SIGNATURE
create temp table ctx2(k text primary key, v text); grant all on ctx2 to authenticated; grant usage on schema t to authenticated;
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.err($$select app.enregistrer_cle('cle-membre-01', '{"kty":"EC","crv":"P-256","x":"AAAA","y":"BBBB"}', 'Membre')$$, 'Droit insuffisant');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.err($$select app.enregistrer_cle('cle-president-01', '{"kty":"EC","crv":"P-256","x":"AAAA","y":"BBBB","d":"SECRET"}', 'Président')$$, 'violates check');
select app.enregistrer_cle('cle-president-01', '{"kty":"EC","crv":"P-256","x":"AAAA","y":"BBBB"}', 'Président');
select t.err($$select app.enregistrer_cle('cle-president-01', '{"kty":"EC","crv":"P-256","x":"AAAA","y":"BBBB"}', 'Président')$$, 'déjà utilisé');
select app.enregistrer_signature('ARC-20261029-AB12CD', repeat('a',64), 'cle-president-01', repeat('S',86), 'Bilan T4', 'ARC1|ARC-20261029-AB12CD|' || repeat('a',64) || '|cle-president-01');
select t.err($$select app.enregistrer_signature('ARC-20261029-AB12CD', repeat('a',64), 'cle-president-01', repeat('S',86), 'Bilan T4', 'ARC1|ARC-20261029-AB12CD|' || repeat('a',64) || '|cle-president-01')$$, 'déjà signée');
select t.err($$select app.enregistrer_signature('ARC-20261029-ZZ99ZZ', repeat('b',64), 'cle-president-01', repeat('S',86), 'x', 'ARC1|AUTRE|' || repeat('b',64) || '|cle-president-01')$$, 'incohérent');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.err($$select app.enregistrer_signature('ARC-20261029-CC11CC', repeat('c',64), 'cle-president-01', repeat('S',86), 'x', 'ARC1|ARC-20261029-CC11CC|' || repeat('c',64) || '|cle-president-01')$$, 'non titulaire');
reset role;
select t.err($$update app.signed_documents set hash = repeat('f',64)$$, 'immuable');
select t.err($$delete from app.signing_keys$$, 'immuable');
-- Vérification publique SANS connexion (rôle anon)
set role anon; select set_config('request.jwt.claim.sub', '', false);
select t.eq((select (app.verifier_signature('ARC-20261029-AB12CD')->>'kid')), 'cle-president-01', 'vérification publique : document enregistré reconnu (sans connexion)');
select t.eq((select (app.verifier_signature('ARC-INCONNU-0000')->>'inconnu')::boolean), true, 'vérification publique : référence inconnue signalée');
select t.eq((select (app.verifier_signature('ARC-20261029-AB12CD') ? 'd')), false, 'vérification publique : jamais de clé privée');
select t.err($$select count(*) from app.signed_documents$$, 'permission denied');
select t.err($$select count(*) from app.members$$, 'permission denied');
select t.err($$select app.enregistrer_cle('cle-anon-001', '{"kty":"EC","crv":"P-256","x":"A","y":"B"}', 'Pirate')$$, 'permission denied');
reset role;
set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.err($$select app.revoquer_cle('cle-president-01', 'Perte de l''appareil')$$, 'Seul le titulaire');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.err($$select app.revoquer_cle('cle-president-01', 'x')$$, 'Motif');
select app.revoquer_cle('cle-president-01', 'Perte de l''appareil');
select t.err($$select app.enregistrer_signature('ARC-20261029-DD22DD', repeat('d',64), 'cle-president-01', repeat('S',86), 'x', 'ARC1|ARC-20261029-DD22DD|' || repeat('d',64) || '|cle-president-01')$$, 'révoquée');
reset role;
set role anon; select t.eq((select (app.verifier_signature('ARC-20261029-AB12CD')->>'revoquee_le') is not null), true, 'vérification publique : révocation signalée');
reset role;
\echo TOUS LES TESTS V3 PASSENT
