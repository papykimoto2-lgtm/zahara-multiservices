# Arc-en-Ciel Connect — V1 (socle)

Plateforme de gouvernance de la Cité Arc-en-Ciel de Songon Kassamblé. Développée par Sanix Africa Division Technologies.
Cahier des charges : `docs/CAHIER_DES_CHARGES_ARC_EN_CIEL_CONNECT.pdf`.

> **Projet Supabase dédié obligatoire.** Ne jamais l'exécuter dans la base d'une autre entreprise (Zahara ou autre). Ce dossier est déployable seul (`arc-en-ciel/` = racine du site) ; il est exclu du déploiement Zahara (`.vercelignore`).

## Contenu V1
| Domaine | Livré |
|---|---|
| Noyau | membres, lots, propriétés, rôles/permissions, mandats datés, journal d'audit **en ajout seul, chaîné par empreintes** (vérifiable) |
| Finance | grand livre **immuable**, comptes, cotisations → appels → paiements (partiels), **contrepassation motivée**, budgets, dépenses, **circuit de validation à seuils paramétrables**, séparation des tâches, états financiers publiés (figés) |
| Gouvernance | réunions, PV versionnés (validé = figé, publié = définitif), décisions, annonces, notifications, documents (Storage privé) |
| Sécurité | RLS sur toutes les tables, écritures financières uniquement par fonctions SQL, anti-escalade des rôles, CSP stricte, aucune clé secrète côté client |
| Interface | PWA mobile first : Ma cité, Finances, Dépenses, Réunions, Documents, Audit |

## Déploiement
1. Créer un projet Supabase **nouveau**. Exécuter dans l'ordre `supabase/migrations/001…004*.sql`.
2. *Settings → API → Exposed schemas* : ajouter `app`.
3. Créer les comptes (Auth), puis lier chaque membre (`app.members.user_id`) et attribuer les premiers rôles en SQL (le premier président) ; ensuite le président attribue via `app.attribuer_role`.
4. Renseigner `config.js` (URL + clé **anon** uniquement).
5. Faire valider par le comité de pilotage les seuils de `app.validation_rules` (valeurs actuelles **illustratives**), la liste des rôles et les droits (`004`/`001`).
6. Déployer le dossier (Vercel : `vercel.json` fournit les en-têtes de sécurité).

## Tests
`bash arc-en-ciel/tests/run.sh` — PostgreSQL jetable : migrations + 54 contrôles (droits, circuit de dépense, grand livre, RLS, audit, PV). Aucune base réelle touchée.

## Hors périmètre V1 (phases suivantes)
Votes, projets, social, incidents, prestataires, SMS/WhatsApp, exports PDF/Excel côté serveur, rapprochement bancaire, rapports automatisés, cartographie. Clé de signature et page de vérification des documents : à créer.
