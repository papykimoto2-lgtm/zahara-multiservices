# Manuel de procédures — Fournisseurs

**Réf.** PRO-FOU · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour créer, tenir à jour, contrôler et supprimer les fiches fournisseurs (matériaux, prestataires, personnes physiques).
**Principe directeur** : un seul fournisseur par tiers, un compte 401 correct, une retenue AIRSI déclarée, et aucune opération avec un fournisseur gelé.

> Les noms de boutons sont ceux du module **Fournisseurs** de l'ERP.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Acheteur** | Crée et met à jour les fiches |
| **Comptabilité** | Contrôle le compte 401 et l'AIRSI |
| **Conformité** | Criblage SFC, gel et levée de gel |
| **Direction** | Supprime, arbitre les doublons |

## 2. Règles d'or

1. **Rechercher avant de créer** : nom, RCCM, NCC ou CNI.
2. Entreprise = RCCM et NCC ; personne physique = CNI.
3. Le **compte 401x** détermine la comptabilité du fournisseur : à défaut, le compte par défaut des fournisseurs s'applique.
4. Un fournisseur **soumis à l'AIRSI** doit être coché : la retenue est calculée à chaque facture.
5. Un fournisseur **gelé** ne se supprime pas : il se traite dans Conformité.

## 3. Procédures

### FOU-01 — Créer un fournisseur

**Où** : **➕ Nouveau fournisseur**.

| Champ | Règle |
|---|---|
| **Type** | Entreprise ou personne physique |
| **Raison sociale / nom et prénoms** | Obligatoire |
| **RCCM, NCC** (entreprise) ou **CNI** (personne physique) | À renseigner pour la conformité |
| **Contact / téléphone** | Recommandé |
| **Compte (401x)** | Facultatif ; à défaut, compte par défaut Fournisseur |
| **AIRSI** | À cocher si retenue à la source |

1. Rechercher le fournisseur dans la liste (🔍).
2. Remplir et **Enregistrer**.
3. Le fournisseur devient choisissable dans les bons de commande et les entrées de stock.

**[bloquant]** Nom absent ; compte par défaut Fournisseur non paramétré en l'absence de compte saisi.

### FOU-02 — Modifier un fournisseur

1. Liste › ✏️ ; modifier ; enregistrer.
2. Le gel SFC et son motif sont **conservés**.
3. Un changement de compte 401 n'affecte pas les écritures passées.

### FOU-03 — Contrôler la conformité

1. Dès la création d'un fournisseur important, lancer le **criblage SFC** (Conformité LBC/FT).
2. Fournisseur **gelé** : bons de commande, factures et paiements sont refusés.
3. Lever le gel uniquement dans le module Conformité.

### FOU-04 — Supprimer un fournisseur

**Où** : liste › 🗑.

1. Vérifier qu'aucun BC, réception ou facture n'y est rattaché.
2. Confirmer.

**[bloquant]** Fournisseur gelé : suppression refusée (la preuve du gel doit être conservée 10 ans). Un fournisseur avec historique : préférer le conserver.

### FOU-05 — Suivre le compte du fournisseur

**Où** : Comptabilité › Comptes tiers › **Fournisseurs 401** et **Échéances**.

1. Lire le solde dû par fournisseur et les échéances.
2. Lettrer règlements et factures.
3. Expliquer tout poste ouvert avant la clôture mensuelle.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Nom absent | Refusé |
| Fournisseur gelé | Plus de BC, facture ni paiement ; suppression refusée |
| AIRSI coché | Retenue calculée sur chaque facture |
| Compte 401 vide | Compte par défaut utilisé |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Création, modification | Fiche (dates) et synchronisation cloud |
| Gel / levée | Module Conformité (motif, date) |
| Opérations | BC, réceptions, factures, écritures |

## 6. RACI

| Procédure | Acheteur | Comptabilité | Conformité | Direction |
|---|---|---|---|---|
| FOU-01 Création | R | C | C | I |
| FOU-02 Modification | R | C | – | – |
| FOU-03 Criblage | I | – | R | A |
| FOU-04 Suppression | C | C | C | A/R |
| FOU-05 Suivi du compte | I | R | – | I |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Doublon de fournisseur | Création sans recherche | Conserver un seul, rattacher les opérations, supprimer l'autre si sans historique |
| Facture sans AIRSI | Case non cochée | Cocher ; corriger les factures déjà passées par contre-passation |
| Enregistrement refusé | Compte fournisseur par défaut absent | Paramètres › Comptes par défaut |
| « Fournisseur gelé » | Mesure SFC active | Traiter dans Conformité |

## 8. Liste de contrôle

1. ☐ Recherche faite (pas de doublon)
2. ☐ Type, identifiants (RCCM, NCC ou CNI) renseignés
3. ☐ Compte 401 et AIRSI vérifiés
4. ☐ Criblage SFC effectué

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
