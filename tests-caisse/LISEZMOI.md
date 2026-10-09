# Tests de non-régression — module Caisse

Chaque test charge la **vraie page de l'ERP** dans Chromium (aucune fonction réimplémentée), coupe le réseau
et simule le cloud. Ils protègent les règles ajoutées à la caisse :

| Fichier | Règles couvertes |
|---|---|
| `cloture.test.js` | comptage à l'aveugle, mouvements en attente (précision obligatoire, écart double), recalcul après validation tardive, alerte session > 24 h |
| `ouverture.test.js` | vérification de la session sur le cloud, refus si état inconnu, confirmation hors ligne, annulation en cas de course entre postes, motif si fond ≠ dernier comptage, fond négatif refusé |
| `garde-fous.test.js` | pas de bon sans session, numéro unique, alerte de bon identique, interdiction de valider sa propre demande |
| `reprise.test.js` | reprise d'historique (session technique, solde du tiroir inchangé, bannière de rattachement) |
| `regularisation.test.js` | net par caisse, motif obligatoire, confirmation de la régularisation en masse |
| `cloture-encadree.test.js` | clôture par un tiers ou tardive (motif obligatoire, marque administrative), clôture existante jamais écrasée (cloud et synchro) |
| `apres-cloture.test.js` | bons validés ou rattachés après la clôture : marque, badge, bannière, alerte, recalcul |
| `rapprochement.test.js` | écart réel cumulé par caisse, ruptures de chaîne, sessions techniques et rejets ignorés |
| `remise.test.js` | remises banque/direction (pièce obligatoire, confirmation de réception par une autre personne), explication obligatoire d'un écart de clôture |
| `reappro.test.js` | virement lié à la demande, doublon de demande, validation par un autre, statut monotone à la synchro |

Lancer : `npm run test:caisse` (ou `node --test tests-caisse/*.test.js`).
Variables : `PLAYWRIGHT_PATH` (module playwright), `CHROMIUM_PATH` (navigateur), `ERP_PAGE` (autre page à tester).
Prérequis : Node 20+, `playwright` et un Chromium installés.
