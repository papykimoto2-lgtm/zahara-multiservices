# Manuel de procédures — Portefeuille foncier : acquisition, financement, mutation, cession

Public : service Foncier, comptabilité, direction.
Complète deux manuels : *Foncier — sécurisation du titre* (dossiers, étapes, intervenants) et *Procédures Foncier* (RACI du titre). Ce manuel couvre le **patrimoine foncier** : parcelles, financeurs, mutations, cessions, recouvrement.

## 1. Rôles

| Rôle | Fait | Ne fait pas |
|---|---|---|
| Foncier | Saisit parcelles, mutations, cessions ; suit les jalons | Valide les paiements, supprime |
| Comptabilité | Contrôle les écritures de cession, encaisse, relance | Modifie une parcelle |
| Direction / admin | Supprime, valide les exceptions, lit le rapport stratégique | — |

## 2. Parcours en bref

| Phase | Onglet Foncier | Résultat |
|---|---|---|
| Vue d'ensemble | Tableau de bord, Ma journée, Kanban, Calendrier, Pilotage | Priorités du jour |
| 1 Acquisition | Parcelles | Parcelle au portefeuille |
| 2 Sécurisation | 2.1 Situation des titres, 2.2 Dossiers, 2.4 Jalons | Titre sécurisé |
| 3 Financement | Financiers, Candidatures | Fonds apportés, lots rétrocédés |
| 4 Exploitation | Fiscalité immo, Mutations | Charges chiffrées, propriétaire à jour |
| 5 Cession | Cessions, Recouvrement | Vente enregistrée, créance encaissée |

Règle : le flux avance, jamais en arrière. On acquiert, on sécurise, on finance, on exploite, on cède.

## 3. Procédures

### FON-01 — Créer une parcelle

**Où** : Foncier › Parcelles › « + Nouvelle parcelle ». **Qui** : Foncier.

1. Onglet **Identification** : référence interne (obligatoire, ex. PARC-2026-001), localisation, commune, sous-préfecture, zone UTM, superficie totale (m²), superficie constructible, programme affecté.
2. Onglet **Titre & Droits** : type de titre, numéro, date, notaire, vendeur, statut, niveau de risque, observations juridiques. Indivision avec un partenaire de lotissement : renseigner lots totaux et lots du promoteur.
3. Onglet **Financier** : prix d'acquisition, frais de mutation, de bornage, de notaire, valeur actuelle. Le **coût total** se calcule seul.
4. Onglet **Bornage & Coordonnées** : bornes, points altimétriques, géomètre, plan.
5. Enregistrer.

**Statuts** : Prospection, Négociation, ACD obtenu, TF provisoire, TF définitif, Affecté à programme, Contentieux.

**Contrôles** : référence unique obligatoire. Une parcelle liée à une opération d'aménagement met à jour commune, village et superficie de l'opération.

### FON-02 — Suivre le portefeuille

1. **Parcelles** : filtre par statut ou programme ; recherche libre (localité, TF, ACD) ; vue **Grille** ou **Tableau**.
2. **Tableau de bord** : parcelles et superficie totale, titres définitifs, ACD en cours, valeur foncière, dossiers contentieux.
3. **Géolocaliser** : carte des parcelles.
4. **Export** : CSV avec coût total, quote-part promoteur, valeur patrimoniale, indivision. À remettre au comptable tel quel.
5. **Rapport stratégique** : état du portefeuille, constats chiffrés, actions proposées. À transmettre à la direction.

**Indivision** : la valeur portée au patrimoine = coût × quote-part du promoteur (lots promoteur ÷ lots totaux). Répartition non renseignée : 100 %.

### FON-03 — Situation et jalons du titre

1. **2.1 Situation des titres** : point de départ, titre détenu par chaque parcelle.
2. **2.2 Dossiers fonciers** : ouvrir le dossier (voir manuel Foncier).
3. **2.4 Jalons du titre** : vue par parcelle, de la lettre d'attribution à la mutation, en passant par l'ACD et le TF. Bouton « Réinitialiser depuis le statut » si le jalon est faux.

Le détail des étapes, contrôles et justificatifs reste dans 2.2.

### FON-04 — Financeur partenaire

**Où** : Financiers › « + Nouveau financier » ; Candidatures pour les demandes reçues. **Qui** : Foncier, validation direction.

1. Créer le financeur : opération, engagement financier, nombre de lots rétrocédés (part cessible de l'opérateur).
2. Enregistrer chaque versement par la comptabilité.
3. Traiter les **candidatures** reçues : accepter ou refuser, avec motif.
4. Émettre l'**attestation de cession** uniquement après **acquittement complet** de l'engagement.

**Blocage** : pas d'attestation tant que l'engagement n'est pas soldé.

### FON-05 — Calcul fiscal

**Où** : Fiscalité immo.

1. Vérifier les taux **chaque année** (annexe fiscale ivoirienne) : droits d'enregistrement 4 %, conservation foncière 0,4 %, émoluments notaire, TVA immeuble neuf, plus-value immobilière, patrimoine foncier.
2. « Pré-remplir depuis une parcelle » reprend la valeur d'acquisition.
3. Lire le coût total des charges avant toute mutation ou cession.

Les taux modifiés restent sur le poste de l'utilisateur. Contrôle avec l'expert-comptable.

### FON-06 — Enregistrer une mutation

**Où** : Mutations › « + Nouvelle mutation ».

1. Choisir la parcelle et le **type** : vente, donation, succession, expropriation, échange, apport en société.
2. Renseigner vendeur, acheteur, notaire, frais, date.
3. Suivre le statut jusqu'à l'inscription au livre foncier.

Recherche par parcelle, type, vendeur ou acheteur.

### FON-07 — Enregistrer une cession

**Où** : Cessions › « + Nouvelle cession ». **Qui** : Foncier puis comptabilité.

1. Choisir la **source** : parcelle (en m²) ou opération (en nombre de lots). Obligatoire.
2. Saisir l'acquéreur : personne physique (nom) ou morale (raison sociale). Identité complète obligatoire.
3. Saisir désignation, prix de cession, date.
4. Enregistrer. L'ERP :
    - attribue un numéro de dossier de cession ;
    - génère l'**écriture SYSCOHADA** (tiers au débit, produit de cession au crédit, comptes paramétrés) ;
    - met à jour la superficie cédée de la parcelle ou les lots cédés de l'opération ;
    - alimente trésorerie et compte de résultat.
5. Bouton « Générer écritures manquantes » : rattrape les cessions saisies sans écriture.

**Lecture** : colonne Coût / Marge = prix de cession − coût de revient. Une marge négative demande une justification à la direction.

**Contrôle** : un compte par défaut manquant (Paramètres › Comptabilité) bloque l'écriture. Le paramétrer, puis relancer.

### FON-08 — Recouvrer les créances d'acquéreurs

**Où** : Recouvrement. **Qui** : comptabilité.

1. Ouvrir l'**échéancier** de l'acquéreur : apport déjà encaissé, plan mensuel, suivi actif.
2. Enregistrer chaque encaissement : écriture SYSCOHADA automatique (trésorerie / compte client foncier).
3. Lire les **niveaux de relance**, selon les mois de retard :

| Retard | Niveau | Action |
|---|---|---|
| < 2 mois | 0 | Rappel simple |
| 2 mois | 1 | Lettre de relance |
| 3 mois | 2 | Mise en demeure |
| 6 mois et plus | 3 | Résiliation (décision direction) |

4. Traiter les **déclarations de paiement** déposées par les acquéreurs avant de relancer : rapprocher le virement ou le reçu, puis valider ou rejeter.

### FON-09 — Supprimer

| Objet | Qui | Condition |
|---|---|---|
| Parcelle | Droit de suppression | Confirmation ; contrôle d'intégrité (liens bloquants) |
| Dossier foncier | **Administrateur seul** | Motif de 10 caractères minimum ; **refusé** si frais comptabilisé ou payé, ou note de débours émise ou encaissée |

Un dossier avec trace comptable : **annuler puis archiver**. La suppression efface étapes, missions, pièces et journal liés ; un instantané reste dans le journal d'audit.

## 4. Contrôles et blocages

| Contrôle | Effet |
|---|---|
| Référence parcelle vide | Enregistrement refusé |
| Source de cession non choisie | Refusé |
| Identité acquéreur incomplète | Refusé |
| Compte comptable par défaut absent | Écriture bloquée |
| Engagement du financeur non soldé | Pas d'attestation de cession |
| Trace comptable sur dossier | Suppression refusée |
| Journal d'audit indisponible | Suppression refusée |

## 5. Routines

| Fréquence | Action | Qui |
|---|---|---|
| Quotidienne | Ma journée, notifications, déclarations de paiement | Foncier, comptabilité |
| Hebdomadaire | Recouvrement : retards et relances ; Kanban | Comptabilité, Foncier |
| Mensuelle | Cessions sans écriture ; export CSV rapproché du bilan ; calendrier des échéances | Comptabilité |
| Annuelle | Taux fiscaux ; rapport stratégique ; revue des contentieux | Direction |

## 6. Erreurs fréquentes

| Erreur | Correction |
|---|---|
| Cession sans écriture | « Générer écritures manquantes » après paramétrage des comptes |
| Valeur patrimoniale trop haute | Renseigner lots totaux et lots du promoteur (indivision) |
| Jalon du titre faux | Corriger le statut de la parcelle, puis « Réinitialiser depuis le statut » |
| Suppression de dossier refusée | Annuler puis archiver |
| Taux fiscal obsolète | Mettre à jour dans Fiscalité immo, valider avec le comptable |

## 7. Check-lists

**Nouvelle parcelle** : référence, localisation, superficie, titre, coût, programme, bornes.
**Avant cession** : titre sécurisé, source choisie, acquéreur complet, prix et coût, comptes paramétrés.
**Après cession** : écriture générée, superficie cédée à jour, échéancier ouvert.
**Clôture annuelle** : cessions toutes comptabilisées, créances rapprochées, contentieux revus.

## 8. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |

Rappel : l'ERP suit la procédure. L'obtention d'un titre relève de l'administration. Fiscalité à valider avec l'expert-comptable.
