# Manuel de procédures — Budget et engagements de dépense

**Réf.** PRO-BUD · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour établir le budget prévisionnel, engager les dépenses par fiche d'engagement, transférer des crédits entre lignes et suivre le disponible.
**Principe directeur** : aucune dépense sans ligne budgétaire disponible ; budget et transferts passent par brouillon, soumission et validation ; un budget validé ne se modifie plus, il s'ajuste par transfert.

> Les noms de boutons sont ceux du module **Suivi Budgétaire** (Budget prévisionnel, Engagements de dépense, Transferts, Compte d'exploitation prévisionnel, Demandes d'Achat, Mes demandes).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Responsable de service** | Prépare le budget de son service, rédige les engagements |
| **Contrôle de gestion / comptabilité** | Contrôle lignes, disponible, transferts |
| **Direction** | Valide budgets, engagements et transferts (droit de validation du module Budget) |
| **Caisse** | Décaisse les demandes d'achat validées (PRO-CAI) |

## 2. Règles d'or

1. Un budget se rattache à une **ligne budgétaire**, un **sous-compte**, une **division** et un **exercice**.
2. Le **sous-compte commence par le code de la ligne** (ligne 605 → sous-compte 6055).
3. Un seul budget par sous-compte, division et exercice.
4. Seul un budget **brouillon** se soumet ; seul un budget **soumis** se valide.
5. Un budget **validé** n'est plus modifiable : utiliser un **transfert**.
6. Un engagement n'est validé que si le **disponible** de la ligne le couvre.

## 3. Procédures

### BUD-01 — Budget prévisionnel

**Où** : Budget prévisionnel.

1. Créer le budget : ligne budgétaire, sous-compte, exercice, division, montant (> 0) ; répartition mensuelle possible.
2. **Enregistrer** : statut brouillon (un budget rejeté repasse en brouillon).
3. **Soumettre** : statut « soumis ».
4. **Valider** (direction) : la ligne devient active ; ou **rejeter** avec motif.

### BUD-02 — Fiche d'engagement de dépense (FED)

**Où** : Engagements de dépense › **➕ Nouvelle fiche**.

1. Saisir division, exercice, ligne budgétaire (obligatoire), objet, fournisseur, bénéficiaire et au moins **une ligne** de dépense ; le disponible s'affiche.
2. **Enregistrer** : numéro FED attribué, statut brouillon.
3. **Soumettre** : « soumise ». Une fiche soumise ou validée n'est plus modifiable.
4. **Valider** (direction) : contrôle du disponible ; la ligne est **décrémentée** ; la fiche devient une **Demande d'Achat (DA)** numérotée, visible à la Caisse. **Rejeter** : fiche « rejetée » avec motif, modifiable ensuite.

### BUD-03 — Demande d'achat et décaissement

1. **Demandes d'Achat** : suivre les DA validées ; imprimer.
2. La caisse décaisse (PRO-CAI) ; la demande n'est « décaissée » qu'à la sortie réelle de l'argent.
3. **Mes demandes** : chaque demandeur suit l'état de ses fiches.

### BUD-04 — Transfert entre lignes

**Où** : Transferts › **➕ Nouveau transfert**.

1. Choisir **deux sous-comptes différents** de la **même ligne budgétaire**, qui ont déjà chacun un budget prévisionnel, et un montant > 0.
2. **Enregistrer** (brouillon), **soumettre**, puis **valider** : le disponible de la ligne source doit couvrir le montant.
3. Un transfert soumis ou validé n'est plus modifiable.

### BUD-05 — Compte d'exploitation prévisionnel et pilotage

1. **Compte d'exploitation prévisionnel** : lire les produits et charges prévus.
2. **Masque simplifié (business plan)** : renseigner rapidement le budget pour un dossier bancaire (PRO-TRE).
3. Contrôler chaque mois budget, engagé et disponible ; imprimer l'état périodique.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Ligne, sous-compte, exercice ou montant absent | Budget refusé |
| Sous-compte ne commençant pas par la ligne | Refusé |
| Doublon (sous-compte, division, exercice) | Refusé |
| Budget validé modifié | Refusé : transfert requis |
| Disponible insuffisant | Validation de la fiche ou du transfert refusée |
| Deux comptes identiques dans un transfert | Refusé |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Budget, fiche, transfert | Auteur, dates, statut, motif de rejet |
| Numéros | FED puis DA |

## 6. RACI

| Procédure | Resp. service | Contrôle de gestion | Direction | Caisse |
|---|---|---|---|---|
| BUD-01 Budget | R | C | A | – |
| BUD-02 Engagement | R | C | A | I |
| BUD-03 DA | C | C | I | R |
| BUD-04 Transfert | R | C | A | – |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Validation refusée | Disponible insuffisant | Transférer des crédits vers la ligne |
| Budget non modifiable | Déjà validé | Passer par un transfert |
| Transfert refusé | Lignes différentes ou budget absent | Créer le budget manquant |

## 8. Liste de contrôle

1. ☐ Budgets validés pour l'exercice
2. ☐ Engagements rattachés à une ligne
3. ☐ Transferts motivés
4. ☐ Disponible suivi chaque mois

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
