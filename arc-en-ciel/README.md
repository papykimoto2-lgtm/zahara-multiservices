# ARC-EN-CIEL CONNECT — V1 (socle) + V2 (participation, projets, solidarité) + V3 (pilotage, patrimoine, carte)

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
| `participation-engine.js` | V2 : consultations et votes (bulletin secret, reçu vérifiable), boîte à idées, réclamations (réexamen, médiation confidentielle), incidents |
| `projets-engine.js` | V2 : plan court / moyen / long terme, avancement, coût engagé et payé, retard et dépassement, comparatif des devis |
| `solidarite-engine.js` | V2 : demandes d'aide confidentielles, fonds de solidarité, aides publiées sans identité |
| `export-engine.js` (`ARC_EXPORT`) | CSV (Excel FR), Excel, impression / PDF avec pied (référence, SHA-256, QR) — **QR signé** si l'appareil a une clé de signature ; formules neutralisées |
| `signature-engine.js` (`ARC_SIGN`) | signature ECDSA P-256 : clé privée **non exportable** (IndexedDB), clé publique et registre en base |
| `verifier-engine.js` + `verifier.html` | vérification publique d'un QR, sans connexion : registre, empreinte, signature, révocation |
| `carte-engine.js` | V3 : carte schématique sans fond externe (équipements, incidents ouverts), position par GPS, lien OpenStreetMap à la demande |
| `previsions-engine.js` | V3 : simulation prudent / réaliste / ambitieux, plan pluriannuel, 11 indicateurs de performance, aide à la décision par règles |
| `patrimoine-engine.js` | V3 : assurances et sinistres, consommations et évolution des charges, enquêtes de satisfaction anonymes |
| `gestion-engine.js` | Administration : membres et lots, réunions / PV / décisions, annonces et rappels, rapprochement bancaire |
| `modules.css` | charte graphique d'ANGEL'S GROUP : menu latéral sombre, cartes arrondies, pastilles, 6 thèmes de couleur (`data-theme`, choix mémorisé), menu ☰ sur mobile, pastille « Synchronisé hh:mm » |

## Base de données (`supabase/migrations/`, exécuter dans l'ordre)
- **001 Noyau** : membres, lots, propriétés, rôles et permissions, **mandats datés** (un changement de bureau ne perd aucun historique), **journal d'audit en ajout seul chaîné par empreintes** (`verifier_chaine_audit()` détecte une falsification).
- **002 Finance** : un seul **grand livre immuable** ; comptes ; cotisations → appels → paiements (partiels) ; **contrepassation motivée** ; budgets ; dépenses avec **circuit de validation à seuils paramétrables** (table `validation_rules`, tranches sans chevauchement) ; le demandeur ne valide ni ne paie sa propre dépense ; chaque rôle requis doit approuver, une personne ne compte qu'une fois ; paiement refusé sans justificatif, sans solde suffisant ou sans approbation. Sommes **appelées** distinguées des sommes **encaissées**. Seuils fournis = **illustratifs**, à faire adopter par le comité.
- **003 Gouvernance** : réunions, **PV versionnés** (validé = contenu figé, publié = définitif), décisions, annonces, notifications, documents (Storage privé), **états financiers publiés** (instantané non modifiable).
- **004 Sécurité** : RLS sur toutes les tables, écritures financières **uniquement par fonctions SQL**, **anti-escalade** (seul le président attribue un rôle financier ; l'administrateur technique n'a aucun droit de validation), bucket `documents` privé.

## V2 (migrations 005 à 007)
- **005 Participation** : `voter()` (un bulletin par membre, **émargement et bulletin dans deux tables sans lien**, reçu SHA-256 publié à la clôture), `clore_consultation()` (quorum, majorité simple / absolue / deux tiers, égalité détectée, résultat figé) ; idées (`proposer`, `traiter_proposition`) ; réclamations traçables (`deposer_reclamation`, `traiter_reclamation`, `demander_reexamen`, historique en ajout seul, médiation réservée à `mediation.lire`) ; incidents (`signaler_incident`, `traiter_incident` ; preuve de résolution et motif de rejet obligatoires ; la vue publique n'expose jamais le déclarant).
- **006 Projets et solidarité** : projets (décision obligatoire pour autoriser / démarrer / terminer, `v_projets` : engagé, payé, dépassement, retard) ; prestataires et devis (`retenir_devis` : au-delà du seuil, plusieurs devis exigés ; choix motivé et journalisé) ; aides (`demander_aide` → `instruire_aide` → `decider_aide` → `verser_aide` : trois personnes différentes, versement uniquement depuis le fonds, **aucune donnée personnelle dans le journal d'audit**) ; `publier_bilan_trimestriel` (contrat de confiance numérique) ; `alertes_controle()` (dépenses similaires, contrepassations, dépassements, projets hors budget ou en retard, droits modifiés).
- **007 Sécurité V2** : RLS, privilèges par colonne (statut et résultat d'une consultation ne s'écrivent jamais directement), `emargements` et `bulletins` sans aucun accès direct. Seuils de devis (`app.parametres`) et règles de vote : **illustratifs**, à faire adopter par le comité ; un vote en ligne reste consultatif tant que le cadre juridique ne l'a pas validé.

## V3 et administration (migrations 008 à 010)
- **008 Patrimoine** : géolocalisation (`positionner_actif`, `positionner_incident`, vue publique `v_carte` sans donnée personnelle) ; assurances (échéance à 60 jours, sinistre dans la période du contrat, indemnisation = montant obligatoire) ; consommations (`v_evolution_charges` : variation mensuelle et annuelle, hausse > 30 % signalée) ; enquêtes de satisfaction (émargement et réponses séparés, résultats à partir de **5 réponses**) ; rapprochement bancaire (`importer_releve`, `rapprocher` à montant et compte identiques, `signaler_ecart` motivé, `v_a_rapprocher`).
- **009 Prévisions** : `simuler_scenarios` (PROJECTION sur 6 mois réels, jamais comptée comme recette), `v_plan_pluriannuel`, `indicateurs_performance` (agrégats sans donnée personnelle), `generer_rappels` (idempotent, utilisable par pg_cron).
- **010 Sécurité V3** : RLS et privilèges ; `survey_answers` et `survey_emargements` sans accès direct.
- **Aide à la décision** : règles lisibles (recouvrement, incidents, réclamations, décisions, trésorerie du scénario prudent) ; elle ne décide de rien et ne touche à aucun paiement, sanction ni aide sociale.
- **Exports et impression** : toute table exportable en CSV / Excel ; l'impression (PDF navigateur) ajoute référence, empreinte SHA-256 et QR d'intégrité **non signé** (aucune clé de la cité n'est encore publiée).

## Signature numérique (migration 011)
- Le signataire (président, trésorier, secrétaire, contrôleur) crée sa clé dans **Administration → Signature** : la clé privée est générée sur l'appareil et **ne peut plus en sortir** ; seule la clé publique est inscrite (`enregistrer_cle` refuse toute partie privée).
- Chaque impression signée inscrit au registre (**immuable, journalisé**) : référence, empreinte SHA-256 du contenu, clé, signature. Texte signé : `ARC1|référence|empreinte|clé`.
- `verifier.html` (ouvert par le QR, sans connexion, fonction SQL `verifier_signature` accordée à `anon`) contrôle : inscription au registre, empreinte, signature ECDSA avec la clé publique, révocation (une signature **antérieure** à la révocation reste valable mais signalée ; **postérieure** : rejetée).
- Perte de l'appareil : `revoquer_cle` (titulaire ou président, motif obligatoire). Pour un QR lu hors du site, `config.js` doit contenir l'URL et la clé anon du projet.

## Charte visuelle
Même charte qu'ANGEL'S GROUP, **dégradé conservé** : bandeau dégradé (couleurs du thème) avec titre et actions, indicateurs qui chevauchent le bandeau, onglets en pilules à dégradé, cartes arrondies ombrées, horloge et recherche (`/`) dans le menu, pastille « Passerelle connectée ». Six thèmes de couleur.

## Déploiement
1. Créer un projet Supabase **nouveau**, exécuter `001…011`, puis *Settings → API → Exposed schemas* : ajouter `app`.
2. Créer les comptes (Auth), lier chaque membre (`app.members.user_id`), attribuer en SQL le premier rôle de président ; ensuite le président utilise `app.attribuer_role`.
3. Faire valider par le comité : seuils (`app.validation_rules`), rôles et droits (`001`/`004`), règles de publication.
4. Déployer le dossier (Vercel : `vercel.json` fournit CSP, HSTS, anti-framing).

## Tests
- `node arc-en-ciel/tests/base-sql.js` — migrations 001–011 + 88 scénarios dans un PostgreSQL jetable (droits, circuit de dépense, grand livre, RLS, audit, PV). Aucune base réelle touchée. (`tests/run.sh` en est le moteur.)
- `node arc-en-ciel/tests/interface.js` — 52 contrôles navigateur : configuration, refus de clé service_role, démonstration, accueil « Aujourd'hui » et alertes, menu mobile, six écrans, XSS, construction du DOM, fichier unique, ouverture `file://`. (`PLAYWRIGHT=/chemin/playwright` si besoin.)
- `node arc-en-ciel/tests/conventions.js` — 11 contrôles de conventions : IIFE strict, scripts classiques, aucun innerHTML, aucun secret, aucune adresse Supabase réelle, migrations numérotées, manifeste, icônes, service worker.
- `npm run test:arc` les enchaîne.

## Limites assumées / suite
SMS/WhatsApp (intégration autorisée à contracter), carte avec fond cartographique, import automatique des relevés bancaires, rapports générés côté serveur. Pas encore éprouvé sur un projet Supabase réel avec Auth.
