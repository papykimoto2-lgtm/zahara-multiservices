# ARC-EN-CIEL CONNECT — V1 (socle)

Plateforme de gouvernance de la Cité Arc-en-Ciel de Songon Kassamblé, développée par **Sanix Africa Division Technologies** (WhatsApp +225 0779181075 / 0140017751). Cahier des charges : `docs/CAHIER_DES_CHARGES_ARC_EN_CIEL_CONNECT.pdf`. Même style de développement qu'ANGEL'S GROUP : fichiers statiques sans framework ni compilation, **moteurs `*-engine.js` en IIFE**, identité d'instance dans `marque.js`, tests `node tests/*.js` au format PASS / FAIL.

> **Projet Supabase dédié obligatoire.** Ne jamais l'exécuter dans la base d'une autre entreprise (Zahara ou autre). Le dossier se déploie seul (`arc-en-ciel/` = racine du site) ; il est exclu du déploiement Zahara (`.vercelignore`).

**Application** : `index.html` — ouvrable par double-clic (scripts classiques, aucun module ES, aucun serveur requis pour l'interface), installable (PWA : `manifest.webmanifest`, `icons/arc-*.png` générées par `node arc-en-ciel/tools/gen-icons.js`, hors ligne grâce à `sw.js`). Version à envoyer par WhatsApp : `node arc-en-ciel/build-single.js` → `dist/arc-en-ciel-connect.html` (un seul fichier, CSP par empreintes SHA-256).

**Première ouverture** : écran **Connecter la cité** (URL du projet + clé *anon*, mémorisées dans le navigateur ; une clé *service_role* est refusée) ou **Ouvrir la démo** (données fictives, bandeau orange, aucune écriture). Autre option : renseigner `config.js` au déploiement.

## Moteurs (fichiers partagés, globals `ARC_*`)
| Fichier | Rôle |
|---|---|
| `marque.js` | identité de l'instance (nom, cité, éditeur, contact, modules) — une autre cité remplace ce fichier |
| `ui-engine.js` (`ARC_UI`) | construction du DOM sans innerHTML, montants F CFA, dates, pastilles, tableaux, notifications |
| `demo-engine.js` (`ARC_DEMO`) | client Supabase factice (lecture) pour la démonstration |
| `api-engine.js` (`ARC_API`) | client Supabase (schéma `app`), configuration, droits d'affichage |
| `arc-engine.js` | écrans : Aujourd'hui (salutation, actions rapides, indicateurs, alertes avec « Je m'en occupe » / 30 min / 2 h), Ma cité, Argent, Dépenses, Réunions, Documents, Audit et contrôle ; connexion (5 essais puis blocage 60 s) |
| `modules.css` | charte graphique d'ANGEL'S GROUP : menu latéral sombre, cartes arrondies, pastilles, 6 thèmes de couleur (`data-theme`, choix mémorisé), menu ☰ sur mobile, pastille « Synchronisé hh:mm » |

## Base de données (`supabase/migrations/`, exécuter dans l'ordre)
- **001 Noyau** : membres, lots, propriétés, rôles et permissions, **mandats datés** (un changement de bureau ne perd aucun historique), **journal d'audit en ajout seul chaîné par empreintes** (`verifier_chaine_audit()` détecte une falsification).
- **002 Finance** : un seul **grand livre immuable** ; comptes ; cotisations → appels → paiements (partiels) ; **contrepassation motivée** ; budgets ; dépenses avec **circuit de validation à seuils paramétrables** (table `validation_rules`, tranches sans chevauchement) ; le demandeur ne valide ni ne paie sa propre dépense ; chaque rôle requis doit approuver, une personne ne compte qu'une fois ; paiement refusé sans justificatif, sans solde suffisant ou sans approbation. Sommes **appelées** distinguées des sommes **encaissées**. Seuils fournis = **illustratifs**, à faire adopter par le comité.
- **003 Gouvernance** : réunions, **PV versionnés** (validé = contenu figé, publié = définitif), décisions, annonces, notifications, documents (Storage privé), **états financiers publiés** (instantané non modifiable).
- **004 Sécurité** : RLS sur toutes les tables, écritures financières **uniquement par fonctions SQL**, **anti-escalade** (seul le président attribue un rôle financier ; l'administrateur technique n'a aucun droit de validation), bucket `documents` privé.

## Déploiement
1. Créer un projet Supabase **nouveau**, exécuter `001…004`, puis *Settings → API → Exposed schemas* : ajouter `app`.
2. Créer les comptes (Auth), lier chaque membre (`app.members.user_id`), attribuer en SQL le premier rôle de président ; ensuite le président utilise `app.attribuer_role`.
3. Faire valider par le comité : seuils (`app.validation_rules`), rôles et droits (`001`/`004`), règles de publication.
4. Déployer le dossier (Vercel : `vercel.json` fournit CSP, HSTS, anti-framing).

## Tests
- `node arc-en-ciel/tests/base-sql.js` — migrations + 23 scénarios dans un PostgreSQL jetable (droits, circuit de dépense, grand livre, RLS, audit, PV). Aucune base réelle touchée. (`tests/run.sh` en est le moteur.)
- `node arc-en-ciel/tests/interface.js` — 20 contrôles navigateur : configuration, refus de clé service_role, démonstration, accueil « Aujourd'hui » et alertes, menu mobile, six écrans, XSS, construction du DOM, fichier unique, ouverture `file://`. (`PLAYWRIGHT=/chemin/playwright` si besoin.)
- `node arc-en-ciel/tests/conventions.js` — 10 contrôles de conventions : IIFE strict, scripts classiques, aucun innerHTML, aucun secret, aucune adresse Supabase réelle, migrations numérotées, manifeste, icônes, service worker.
- `npm run test:arc` les enchaîne.

## Limites assumées / suite
Votes, projets, social, incidents, prestataires, SMS/WhatsApp, exports PDF/Excel côté serveur, rapprochement bancaire, rapports automatisés, cartographie (V2/V3). Documents imprimables avec QR de sécurité signé (moteur d'impression d'ANGEL'S GROUP) : à porter, avec clé de signature et page de vérification propres à la cité. Pas encore éprouvé sur un projet Supabase réel avec Auth.
