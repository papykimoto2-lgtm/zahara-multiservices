# RLS — phase 1 : classification des tables

Établie **depuis le code**, pas à l'estime : les tables viennent de
`SUPA_STORE_MAP` (index.html), l'exposition au portail est déduite des appels
réellement présents dans `portail-unique.html`, et la couverture existante de
`portal_rls.sql`.

## Résultat

| | Tables |
|---|---|
| Synchronisées au total | **161** |
| Exposées au portail | **40** |
| Internes (personnel uniquement) | **121** |
| Exposées **déjà** couvertes par `portal_rls.sql` | 13 |
| Exposées **sans aucune** politique portail | **27** |

## Le constat qui commande l'ordre des travaux

Les 27 tables exposées au portail mais dépourvues de politique dédiée sont le
cœur de la difficulté. Aujourd'hui elles fonctionnent uniquement parce que
tout est permissif. **Les verrouiller sans écrire d'abord leur politique
portail casse les espaces correspondants** — diaspora, copropriété, gestion
locative, partenaires, aménageurs.

À l'inverse, les **121 tables internes** ne sont touchées par aucun écran du
portail : les protéger n'a aucun effet sur lui. C'est le lot sûr.

> Correction de ma recommandation initiale : j'avais suggéré de commencer par
> `pi_clients`, `pi_versements`, `pi_users`. C'était une erreur — les deux
> premières sont **exposées au portail**, donc parmi les plus délicates. Les
> commencer en premier, c'est prendre le risque maximal d'emblée.

## État réel des bases, mesuré le 14/09/2026

L'accès aux projets Supabase ayant été accordé, la classification ci-dessus
peut être confrontée à la réalité :

| | Zahara | Menco |
|---|---|---|
| Tables `pi_*` | 162 | 162 |
| RLS activée | 162 | 162 |
| Politique `anon` **sans aucune condition** | **162** | **162** |

**La RLS est activée partout mais entièrement permissive.** La clé anon, qui
figure en clair dans le portail public, donne un accès complet en lecture et
en écriture à la totalité des tables — `pi_users` comprise, avec ses logins,
ses hashs et ses sels.

Cela infirme un point sur lequel je m'étais appuyé : je croyais, d'après un
commentaire de l'ERP, que `pi_users` était déjà protégée et que le mécanisme
jeton → politique → accès était donc éprouvé en production. Il ne l'est pas.
Le pilote (`rls_02_pilote.sql`) n'est donc plus une simple précaution : c'est
la première validation réelle du mécanisme.

Le claim à exiger est en revanche connu et vérifié : **`app_role`**, présent
dans les jetons de `staff-login` et absent de ceux du portail (voir
`functions/staff-login/CONTRAT.md`).

## Ordre recommandé

1. **Pilote** sur `pi_demandes_reappro` (`rls_02_pilote.sql`) — table sans
   aucune donnée de production, échec sans conséquence.
2. **Les 121 internes**, par lots de 10 à 20, en commençant par les plus
   sensibles : `pi_bulletins`, `pi_employes`, `pi_ecritures`, `pi_caisse_*`,
   `pi_audit_log`, `pi_logs_connexion`, `pi_releves_bank`.
3. **Les 13 exposées déjà couvertes** — leur politique portail existe, il
   reste à y ajouter l'accès du personnel.
4. **Les 27 exposées non couvertes** — une politique par profil à écrire.
   C'est ici que se concentre l'essentiel de la charge de recette.

## Exposées au portail — sans politique dédiée (27)

- `pi_af_financiers` | `pi_af_manifestations` | `pi_af_operations`
- `pi_af_versements_financiers` | `pi_ag_copro` | `pi_amenageurs`
- `pi_appels_charges_copro` | `pi_baux` | `pi_conventions_amenagement`
- `pi_coproprietes` | `pi_declarations_versement_financier` | `pi_diaspo_dossiers`
- `pi_diaspo_jalons` | `pi_diaspo_parts` | `pi_diaspo_preuves`
- `pi_documents` | `pi_dossiers_lot` | `pi_fonds_travaux_copro`
- `pi_lots_copro` | `pi_ordres_travaux` | `pi_paiements_online`
- `pi_partenaires_lot` | `pi_proprietaires_bailleurs` | `pi_quittances`
- `pi_rapports_lot` | `pi_signalements` | `pi_situations_amenagement`

## Exposées au portail — politique portail existante (13)

- `pi_apporteurs` | `pi_cessions_foncieres` | `pi_clients`
- `pi_commissions` | `pi_conventions` | `pi_declarations_versement_foncier`
- `pi_lots` | `pi_portail_medias` | `pi_portail_messages`
- `pi_programmes` | `pi_rapports_chantier` | `pi_receptions_dossiers`
- `pi_versements`

## Internes — personnel uniquement (121)

- `pi_actions_marketing` | `pi_actions_reunion` | `pi_af_agents`
- `pi_af_relances` | `pi_agrement_programme` | `pi_agrement_promoteur`
- `pi_artisans` | `pi_audit_log` | `pi_avenants`
- `pi_avenants_amenagement` | `pi_biens_amort` | `pi_biens_locatifs`
- `pi_bons_commande` | `pi_budgets_copro` | `pi_bulletins`
- `pi_caisse_budgets` | `pi_caisse_mouvements` | `pi_caisse_sessions`
- `pi_caisses` | `pi_campagnes` | `pi_candidats_rh`
- `pi_candidatures_loc` | `pi_chantier_couts` | `pi_conceptions`
- `pi_conges_rh` | `pi_constructeurs` | `pi_conv_agrement`
- `pi_conventions_reglementees` | `pi_conversations` | `pi_cout_gestion_exercices`
- `pi_cr_visites` | `pi_custom_roles` | `pi_declarations`
- `pi_demandes_paiement` | `pi_demandes_reappro` | `pi_demarcheurs`
- `pi_depots` | `pi_devis_fournisseurs` | `pi_diaspo_ancrages`
- `pi_divisions` | `pi_docs_juridiques` | `pi_dossiers_juridiques`
- `pi_ecritures` | `pi_eds_etudes` | `pi_eds_ouvrages`
- `pi_eds_ressources` | `pi_employes` | `pi_etapes_itineraire`
- `pi_etats_lieux_bail` | `pi_evenements_calendrier` | `pi_factures_client`
- `pi_factures_fournisseur` | `pi_factures_fournisseur_attente` | `pi_fiches_engagement_depense`
- `pi_financements_programme` | `pi_formations_rh` | `pi_fournisseurs`
- `pi_historique_actions` | `pi_immobilisations` | `pi_incidents`
- `pi_itineraires` | `pi_kyc_fiches` | `pi_lbc_alertes`
- `pi_lbc_artci` | `pi_lbc_cappi` | `pi_lbc_conformx`
- `pi_lbc_declarations` | `pi_leads` | `pi_livraisons`
- `pi_loc_relances` | `pi_logs_connexion` | `pi_lot_unites`
- `pi_masse_dxf_presets` | `pi_messages` | `pi_mobilites_rh`
- `pi_modeles_logement` | `pi_mutations` | `pi_nomenclatures`
- `pi_ordres_mission` | `pi_parcelles` | `pi_parcelles_morcellement`
- `pi_permis` | `pi_plans_arch` | `pi_plans_morcellement`
- `pi_pointages` | `pi_postes_ouverts` | `pi_previsionnels`
- `pi_prix_unitaire` | `pi_quinzainiers` | `pi_rapports_commissaire_copro`
- `pi_rapprochements` | `pi_receptions` | `pi_receptions_travaux`
- `pi_relances` | `pi_relances_locatives` | `pi_releves_bank`
- `pi_restitutions_caution` | `pi_reunions_direction` | `pi_segments_marketing`
- `pi_sfc_centif` | `pi_sfc_criblages` | `pi_sfc_liste`
- `pi_sig_couches` | `pi_signatures` | `pi_situations`
- `pi_stock_mouvements` | `pi_suppressions` | `pi_terrains`
- `pi_tiers_comptables` | `pi_transferts_budgetaires` | `pi_users`
- `pi_validations` | `pi_vehicule_affectations` | `pi_vehicule_carburant`
- `pi_vehicule_courses` | `pi_vehicule_entretiens` | `pi_vehicules`
- `pi_visites_blacklist` | `pi_visites_log` | `pi_visites_rdv`
- `pi_workflow_configs`

## Ce qui reste bloqué

Rien de tout cela ne peut être appliqué avant que les vérifications de la
phase 0 soient faites (`functions/staff-login/CONTRAT.md`, §4) : sans le nom
du claim exigé, toute politique écrite le serait à l'aveugle.

`rls_01_inspection.sql` est en lecture seule et peut être lancé dès
maintenant, en production, sans risque.
