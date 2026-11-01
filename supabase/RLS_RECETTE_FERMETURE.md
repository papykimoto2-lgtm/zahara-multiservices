# Fermeture des règles d'accès ouvertes — procédure et recette

Statut : **préparée, NON appliquée.** Fichiers : `supabase/rls_03_fermeture.sql` (fonctions, simulation, retour arrière),
`tools/rls_sonde_anon.js` (mesure de ce que la clé publique peut faire). Le script a été **rejoué sur une base PostgreSQL 16
de test** (rôles anon / authenticated / jeton du personnel simulés) : simulation sans effet, fermeture, anon refusé,
INSERT anonyme du formulaire préservé, lecture portail préservée, personnel préservé, restauration à l'identique.

## 1. État mesuré le 31/10/2026 (correction de l'état du 13/10)

| | MENCO | Zahara |
|---|---|---|
| Tables avec une politique ouverte (cmd ALL, condition vraie, anon ou authenticated) | **167** : `*_open_rollback` sur 162 tables, `*_all` sur 5, plus `agro_state` et `menko_hub_users` | **152** (`anon_all` + `auth_all`) et quelques `*_all` |
| Politique `personnel_tout` (jeton du personnel) | présente sur 165 tables | présente sur 164 tables |
| Connexions serveur journalisées (`staff-login`, `src = srv`) | **888**, dernière le 31/10 | **700**, dernière le 30/10 |

- **Zahara n'est pas fermée.** Une lecture antérieure (« Zahara fermée, 2 tables ouvertes ») ne comptait que les politiques
  nommées `*_open_rollback` ; Zahara porte les mêmes accès totaux sous les noms `anon_all` et `auth_all`.
- Les politiques ouvertes concernent **anon ET authenticated** : un souscripteur connecté au portail (rôle `authenticated`)
  a lui aussi un accès total, y compris aux données des autres. Retirer seulement `anon` ne suffirait pas.
- Le point 3 du plan du 13/10 (« `staff-login` prouvé sur Menco ») est **levé** : 888 connexions serveur y sont journalisées.
  Les 3 tables ouvertes propres (`pi_bordereaux_caisse`, `pi_demandes_reappro`, `pi_incidents`) sont couvertes par le même script.

## 2. Pourquoi le pilote du 14/09 a échoué (à ne pas reproduire)

Il avait été retiré en moins de 18 h : le chargement initial, la file d'envoi et le Realtime partaient sous la clé anon.
Ces trois circuits attendent maintenant la session du personnel (`syncAutorise`, `_rtAppliquerJeton`). Reste un réglage :
`IMMO_SYNC_ANON_FALLBACK = true`. Tant qu'il vaut `true`, un envoi sans session part en anon et serait refusé après
fermeture. **À passer à `false` avant la vague A** : les envois sont alors différés et conservés en file locale.

## 3. Préalables (tous cochés avant la vague A)

1. ☐ Sauvegarde fraîche de la base (Supabase › Database › Backups, ou branche) **et** export JSON de l'ERP.
2. ☐ Confirmer l'organisation **et** le nom du projet (voir `rls_02_pilote.sql`, « confusion de compte »).
3. ☐ Rejouer le script sur une **copie** (branche Supabase) avec les mêmes politiques, avant la production.
4. ☐ Lancer la sonde pour avoir l'état « avant » :
   `SUPABASE_URL=… SUPABASE_ANON_KEY=… node tools/rls_sonde_anon.js > avant.txt`
5. ☐ Passer `IMMO_SYNC_ANON_FALLBACK` à `false` dans l'ERP, déployer, vérifier que le badge de session du personnel apparaît.
6. ☐ Prévenir les utilisateurs : le jeton dure **8 h** et ne se renouvelle pas ; passé ce délai, les envois sont différés
   jusqu'à la reconnexion (avertissement 10 minutes avant l'expiration).
7. ☐ Créer `rls_fermeture` (exécuter `rls_03_fermeture.sql`) et lire `select rls_fermeture.vague('A')`, `('B')`, `('C')`.

## 4. Vagues

| Vague | Contenu | Risque |
|---|---|---|
| **A** | Tables internes : le portail n'y touche pas | Faible (l'ERP seul) |
| **B** | Tables exposées au portail, qui ont déjà leurs politiques `portail_*` (jeton portail, conservées) | Moyen : espaces souscripteur, apporteur, locataire, mandant, diaspora, financier, aménageur, notaire |
| **C** | Sensibles ou à double usage, **une table à la fois** : `pi_users`, `pi_params`, `pi_suppressions`, `pi_logs_connexion`, `pi_leads`, `pi_portail_*`, `pi_audit_log`, `pi_documents`, `pi_messages`, `pi_conversations`, `pi_validations` | Élevé |

Hors périmètre, **non touchés** : `agro_state`, `menko_hub_users`, `menko_hub_audit`, `api_keys`, `api_access_log`
(autres applications : à traiter avec leurs propres tests).

Avant la vague B : repasser les 4 vues publiques en `security_invoker = false` (voir le mode d'emploi du script) ;
sinon `pi_parcelles_public`, `pi_operations_public`, `pi_biens_louer_public`, `pi_appel_financiers_public` deviennent vides.

Pour chaque vague : `fermer(vague, 'X')` en **simulation**, lire la liste, puis `fermer(vague, 'X', false)`, puis la recette ci-dessous.
**Si un critère d'arrêt est atteint : `select rls_fermeture.restaurer('X');` immédiatement.**

## 5. Recette après CHAQUE vague (cases à cocher, dans cet ordre)

**ERP (poste du personnel)**
1. ☐ Connexion : le badge de session du personnel est actif.
2. ☐ Créer, modifier puis supprimer un enregistrement de la vague (ex. vague A : un véhicule ; vague B : un souscripteur de test) :
   message de succès **cloud** à chaque fois, jamais « NON confirmé dans le cloud ».
3. ☐ Cycle de synchronisation complet (Paramètres › Synchronisation) : aucune erreur 401/403, compteurs local = cloud.
4. ☐ Second poste connecté : la création du point 2 apparaît sans rechargement (Realtime).
5. ☐ Se déconnecter puis recharger : l'ERP n'affiche pas les données, sans erreur silencieuse ; se reconnecter : tout revient.
6. ☐ Simuler l'expiration du jeton : les envois sont **différés** (file locale), puis partent à la reconnexion.

**Portail (un compte de chaque type, jeton du portail)**
7. ☐ Souscripteur : fiche, versements, lots, documents, déclaration de versement, message.
8. ☐ Apporteur : ses souscripteurs et ses commissions **uniquement**.
9. ☐ Locataire, mandant, copropriétaire, diaspora, financier, aménageur, partenaire, notaire/intervenant : chacun ne voit que ses données.
10. ☐ Un souscripteur ne voit **pas** les données d'un autre (essayer l'identifiant d'un autre dans l'adresse).

**Visiteur anonyme (sans connexion)**
11. ☐ Accueil : catalogue photos, programmes, lots, biens à louer, opportunités financières, statistiques publiques.
12. ☐ Formulaires : demande de souscription, réservation location, manifestation d'intérêt : envoi réussi (INSERT anonyme).
13. ☐ `node tools/rls_sonde_anon.js --attendu-ferme > apres.txt` : code de sortie 0, seules les tables prévues restent accessibles.

**Critères d'arrêt (retour arrière immédiat)** : un échec aux points 2, 3, 7, 11 ou 12 ; un souscripteur qui voit des données d'autrui ;
une erreur 401/403 persistante dans la console de l'ERP.

## 6. Hors du périmètre de ce script (à traiter ensuite)

- **Stockage** : le dépôt `portail-medias` n'autorise l'écriture qu'à `authenticated`, ce qui inclut les jetons du portail.
  À restreindre au personnel (claim `app_role`), comme les tables.
- **Jeton de 8 h non renouvelable** : prévoir un renouvellement ou une reconnexion guidée avant de couper tout repli.
- **Secrets dans `pi_params`** (clé FNE, jeton Twilio, clé EmailJS) : lisibles tant que `pi_params` reste ouverte ; la ligne
  `portail` est la seule à laisser en lecture publique. À sortir de `pi_params` (coffre de secrets Edge Functions).
- **Autres applications** (`agro_state`, hub Menko) : fermeture séparée.
