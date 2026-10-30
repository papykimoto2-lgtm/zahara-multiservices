# Manuel de procédures — Programmes, lots et commercialisation

**Réf.** PRO-PRG · **Version** 1.1 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour créer un programme immobilier, créer et valoriser ses lots et suivre son cycle de vie, du foncier à la livraison.
**Principe directeur** : un programme avance par étapes ; chaque étape se constate dans l'ERP (parcelle titrée, conception, chiffrage, lots, marchés, ventes, encaissements, livraison) ; la vente d'un lot est comptabilisée dès qu'il passe « vendu ».

> Les noms de boutons sont ceux des modules **Programmes Immobiliers** et **Lots & Foncier** (Tableau de bord, Grille des lots, Carte commercialisation, Terrains, Marge).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Responsable de programme** | Crée le programme, pilote le cycle de vie |
| **Service commercial** | Crée et valorise les lots, suit la carte de commercialisation |
| **Comptabilité** | Contrôle les écritures de vente |
| **Direction** | Décide lancement, prix et livraison |

## 2. Règles d'or

1. **Nom du programme** obligatoire ; rattacher le programme à une **division** et à une **parcelle**.
2. **Numéro de lot** obligatoire ; la somme des surfaces des lots ne dépasse pas la parcelle.
3. Un lot **vendu** avec un prix est comptabilisé ; un lot qui **quitte** « vendu » révoque la vente.
4. Un lot attribué à un souscripteur ne se réattribue pas à un autre.

## 3. Procédures

### PRG-01 — Créer un programme

**Où** : Programmes › **+ Nouveau Programme**.

| Champ | Règle |
|---|---|
| **Nom** | Obligatoire |
| Localisation, nombre de lots, nature (construction par défaut), description | Identification |
| **Statut** | En étude, lancement commercial, en travaux, livraison, terminé |
| Date de lancement, date de livraison | Planning |
| Parcelle, division | Rattachements comptables et fonciers |
| Honoraires techniques (%), aléas (%) | Paramètres de chiffrage |
| Publier sur le portail, rappel CGV | Communication |

Enregistrer : le programme apparaît dans tous les filtres.

### PRG-02 — Piloter le cycle de vie

**Où** : **🧭 Pilotage** (choisir le programme).

L'ERP calcule la progression en **10 étapes** et indique la prochaine action :

| Phase | Étapes |
|---|---|
| Montage | Sécuriser le foncier ; Concevoir les plans ; Chiffrer le coût de revient ; Obtenir les autorisations |
| Production | Créer et valoriser les lots ; Attribuer les marchés de travaux ; Suivre le chantier |
| Commercialisation | Commercialiser ; Encaisser |
| Livraison | Réceptionner et livrer |

1. Lire le pourcentage d'avancement et le détail de chaque étape.
2. Cliquer **Y aller →** sur la prochaine étape.
3. Relire le pilotage à chaque comité de programme.

### PRG-03 — Créer un lot

**Où** : Lots & Foncier › **+ Nouveau Lot**.

| Champ | Règle |
|---|---|
| **Numéro** | Obligatoire |
| Programme, parcelle, îlot, opération | Rattachement |
| **Nature** | Terrain ou logement |
| Surface, prix (au m² ou global), coût de revient | Valorisation |
| Type, pièces, standing, mode de livraison | Logement |
| TVA du terrain, prix TTC | Terrain |
| N° de titre foncier, frais de notaire | Foncier |
| **Statut** | Disponible, réservé, vendu |

1. Enregistrer : si la somme des surfaces des lots dépasse la parcelle, un avertissement signale la **sur-allocation**.
2. **Vendu** avec prix : l'ERP comptabilise la vente (terrain ou logement) ; un compte de vente manquant est signalé sans annuler le lot.
3. Retour à un statut autre que « vendu » : la vente comptabilisée est révoquée (pas de chiffre d'affaires fantôme).

Les lots peuvent aussi être **réservés** ou **attribués** à un aménageur (voir PRO-AME).

### PRG-04 — Suivre la commercialisation

| Onglet | Usage |
|---|---|
| Tableau de bord | Disponibles, réservés, vendus |
| Grille des lots | Liste filtrable |
| Carte commercialisation | Vue cartographique des lots |
| Terrains | Lots de nature terrain |
| Marge | Marge par lot |

Le statut d'un lot suit le souscripteur : réservé à l'enregistrement, vendu au seuil d'immobilisation (voir PRO-SOUS).

**📅 Dates des programmes** (page Programmes) : renseigner en masse les dates de lancement et de livraison ; elles fixent le calendrier des échéanciers.

#### Contrôles Ventes

**Où** : Commercialisation › **🔎 Contrôles Ventes** (le compteur indique le nombre d'anomalies). Six onglets :

| Onglet | Ce qu'il repère |
|---|---|
| **Souscripteurs sans lot** | Souscripteur actif sans lot rattaché : statut de vente, commission et échéancier sans bien |
| **Lots sans souscripteur** | Lot réservé ou vendu qu'aucun souscripteur actif ne référence (y compris les lots multiples) |
| **Lots partagés** | Un lot référencé par plusieurs souscripteurs : le plus souvent une fiche saisie deux fois à fusionner, parfois une double vente |
| **Réservations expirées** | Lot réservé depuis plus que le délai de validité (30 jours par défaut) ou sans date |
| **Lots sans prix** | Par programme, avec les lots réservés ou vendus sans prix (plus grave : échéancier et comptabilité sans base) |
| **Montant total à 0** | Souscripteur sans montant total : ni échéancier ni taux de cotisation calculables |

**Libérer une réservation expirée** (managers) : **🔓 Libérer** sur la ligne, ou le bouton groupé. Le lot redevient disponible et est détaché du souscripteur, avec historique et audit. **Seules les réservations sans aucun versement** sont libérables ; si un versement existe, la ligne indique « à relancer / résilier » et le dossier suit REL ou SOU-13. Le même accès existe sous l'alerte **Réservations à échéance** (bouton « Traiter / libérer »).

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Nom de programme absent | Refusé |
| Numéro de lot absent | Refusé |
| Surfaces > parcelle | Avertissement |
| Vente sans compte paramétré | Lot enregistré, vente non comptabilisée (message) |
| Lot hors statut « vendu » | Vente révoquée |
| Réservation expirée avec versement | Jamais libérée par les contrôles : relance ou résiliation |
| Réservation expirée sans versement | Libération par un manager uniquement |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Programme | Table des programmes |
| Lot | Table des lots (historique de statuts) |
| Vente | Écriture de vente liée au lot |

## 6. RACI

| Procédure | Resp. programme | Commercial | Compta | Direction |
|---|---|---|---|---|
| PRG-01 Programme | R | C | I | A |
| PRG-02 Pilotage | R | C | I | A |
| PRG-03 Lots | C | R | C | I |
| PRG-04 Commercialisation | C | R | I | I |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Étape « foncier » non faite | Parcelles non titrées | Engager l'immatriculation (PRO-FON) |
| Vente non comptabilisée | Comptes de vente non paramétrés | Paramètres › Comptes par défaut |
| Sur-allocation de surface | Lots trop grands | Corriger les surfaces |

## 8. Liste de contrôle

1. ☐ Programme rattaché à sa parcelle et à sa division
2. ☐ Pilotage relu
3. ☐ Lots valorisés, surfaces cohérentes
4. ☐ Ventes comptabilisées

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
| 1.1 | Octobre 2026 | Contrôles Ventes (souscripteurs sans lot, lots orphelins ou partagés, réservations expirées, prix manquants), libération des réservations sans versement, dates des programmes en masse |
