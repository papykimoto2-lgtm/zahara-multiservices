-- Sous-comptes de caisse — migration appliquée le 08/10/2026 sur la base de Zahara.
-- Ce fichier documente l'opération et sa marche arrière ; il n'est pas à rejouer tel quel.
--
-- Avant : CAISSE PRINCIPALE ZMS sur 571, CAISSE SOUSCRIPTEUR sur 572 (pas de partage de compte).
-- Après : un sous-compte de trésorerie par caisse, rattaché à 571 / 572 par préfixe de code.
--
--   57110001  CAISSE PRINCIPALE ZMS
--   57210001  CAISSE SOUSCRIPTEUR
--
-- Règles appliquées
--  * Écritures LIÉES à un mouvement de caisse (id = mouvement.ecriture_id, ou ecr_cse_<id mouvement>) :
--    elles suivent le compte de la caisse du mouvement. 6 écritures -> 57110001.
--  * Encaissements en espèces des souscripteurs non liés à une caisse (ecr_vrs_*) : 6 écritures -> 57210001,
--    conformément à la règle « les encaissements espèces des souscripteurs passent par la caisse souscripteurs »
--    (code v14.119, fonction _compteCaisseSouscripteurs()).
--  * Les pièces déjà VISÉES (valide_le) ne sont pas touchées : intangibles, seule la contre-passation est admise.
--    Aucune pièce visée à la date de la migration.
--  * Chaque écriture reclassée garde l'ancien compte dans compte_caisse_avant et porte migration_sous_compte ;
--    chaque caisse garde compte_avant.
--  * ATTENTION : cette base n'a AUCUN déclencheur sur pi_ecritures / pi_caisses / pi_params. Rien ne pose
--    _modifie ni updated_at automatiquement : la requête les renseigne elle-même, sinon les postes
--    (synchronisation incrémentale sur updated_at) ne verraient jamais le changement.
--  * Le plan est étendu via pi_params.plan_comptable_custom (les deux codes ne sont pas dans le socle).

with maintenant as (select to_char((now() at time zone 'utc'),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') iso),
nouveaux(code,label,classe,nature) as (values
 ('57110001','CAISSE PRINCIPALE ZMS','5','tresorerie'),
 ('57210001','CAISSE SOUSCRIPTEUR','5','tresorerie')),
upd_plan as (
 update pi_params p set updated_at = now(), data = jsonb_set(jsonb_set(p.data, '{plan_comptable_custom}',
   coalesce(p.data->'plan_comptable_custom','[]'::jsonb) ||
   coalesce((select jsonb_agg(jsonb_build_object('code',n.code,'label',n.label,'classe',n.classe,'nature',n.nature))
             from nouveaux n
             where not exists (select 1 from jsonb_array_elements(coalesce(p.data->'plan_comptable_custom','[]'::jsonb)) c where c->>'code'=n.code)
               and not exists (select 1 from jsonb_array_elements(p.data->'plan_comptable_base') b where b->>'code'=n.code)), '[]'::jsonb)),
   '{_modifie}', to_jsonb((select iso from maintenant)))
 where p.id='main' returning 1),
map(caisse_id, old, nw) as (values ('mtljkv72ghoo1','571','57110001'),('muectp6n74her','572','57210001')),
upd_caisses as (
 update pi_caisses c set updated_at = now(), data = c.data || jsonb_build_object('compte', m.nw, 'compte_avant', m.old, '_modifie', (select iso from maintenant))
 from map m where c.id=m.caisse_id and c.data->>'compte'=m.old returning c.id),
cible_liees as (
 select distinct e.id, mp.old, mp.nw from pi_caisse_mouvements m join map mp on mp.caisse_id=m.data->>'caisse_id'
 join pi_ecritures e on e.id = coalesce(m.data->>'ecriture_id','ecr_cse_'||m.id)),
cible_hors as (
 select e.id, '571'::text old, '57210001'::text nw from pi_ecritures e
 where e.id like 'ecr\_vrs\_%' and (e.data->>'compte_debit'='571' or e.data->>'compte_credit'='571' or e.data->>'compte'='571')
   and not exists (select 1 from pi_caisse_mouvements m where e.id = coalesce(m.data->>'ecriture_id','ecr_cse_'||m.id))),
cible as (select id, old, nw, 'liee'::text genre from cible_liees union all select id, old, nw, 'hors-caisse' from cible_hors)
update pi_ecritures e set updated_at = now(), data = e.data
   || jsonb_build_object('_modifie', (select iso from maintenant), 'compte_caisse_avant', c.old, 'migration_sous_compte', '2026-10-08-'||c.genre)
   || (case when e.data->>'compte'=c.old then jsonb_build_object('compte', c.nw) else '{}'::jsonb end)
   || (case when e.data->>'compte_debit'=c.old then jsonb_build_object('compte_debit', c.nw) else '{}'::jsonb end)
   || (case when e.data->>'compte_credit'=c.old then jsonb_build_object('compte_credit', c.nw) else '{}'::jsonb end)
 from cible c
 where e.id=c.id and not (e.data ? 'valide_le') and coalesce(e.data->>'statut_ecr','')<>'valide' and coalesce(e.data->>'_deleted','')<>'true';

-- ─────────────────────────────────────────────────────────────────────────
-- MARCHE ARRIÈRE (non exécutée) — dans cet ordre
-- ─────────────────────────────────────────────────────────────────────────
-- a) écritures
-- update pi_ecritures e set updated_at = now(), data = (e.data - 'migration_sous_compte' - 'compte_caisse_avant')
--   || jsonb_build_object('_modifie', to_char((now() at time zone 'utc'),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
--   || (case when e.data->>'compte'        in ('57110001','57210001') then jsonb_build_object('compte',        e.data->>'compte_caisse_avant') else '{}'::jsonb end)
--   || (case when e.data->>'compte_debit'  in ('57110001','57210001') then jsonb_build_object('compte_debit',  e.data->>'compte_caisse_avant') else '{}'::jsonb end)
--   || (case when e.data->>'compte_credit' in ('57110001','57210001') then jsonb_build_object('compte_credit', e.data->>'compte_caisse_avant') else '{}'::jsonb end)
-- where e.data ? 'migration_sous_compte';
-- b) caisses
-- update pi_caisses set updated_at = now(), data = (data - 'compte_avant') || jsonb_build_object('compte', data->>'compte_avant', '_modifie', to_char((now() at time zone 'utc'),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) where data ? 'compte_avant';
-- c) plan : retirer 57110001 et 57210001 de pi_params.plan_comptable_custom
