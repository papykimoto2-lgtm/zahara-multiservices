-- ═══════════════════════════════════════════════════════════════════════════
-- pi_portail_analytics — localisation des visites (pays, ville) — SCRIPT PRÉPARÉ, NON APPLIQUÉ
--
-- Alimenté uniquement par l'Edge Function « portail-geo » (clé de service) : le navigateur n'écrit
-- jamais ces colonnes. L'adresse IP n'est JAMAIS stockée : seuls le pays et la ville en sont déduits.
-- ORDRE : 1) jouer ce script  2) déployer portail-geo  3) déployer hub-sync  4) fusionner le portail.
-- Confirmer l'organisation ET le nom du projet avant d'écrire (voir rls_02_pilote.sql).
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.pi_portail_analytics add column if not exists pays  text;
alter table public.pi_portail_analytics add column if not exists ville text;

-- Rollback : alter table public.pi_portail_analytics drop column if exists pays, drop column if exists ville;
