# Manuel de procédures — Copropriété et syndic

**Réf.** PRO-COP · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour gérer un immeuble en copropriété : lots et tantièmes, budget voté, appels de charges, fonds travaux, assemblées générales, états de synthèse et rapport du commissaire aux comptes.
**Principe directeur** : les charges se répartissent par tantièmes ; chaque appel génère l'écriture comptable ; les états annuels sont destinés à l'assemblée et au commissaire aux comptes.

> Les noms de boutons sont ceux du module **Copropriété / Syndic** (Immeubles & lots, Budgets, Appels de charges, Fonds travaux, Assemblées générales, États de synthèse, Rapport commissaire aux comptes).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Syndic / gestionnaire** | Crée l'immeuble, les lots, les budgets, les appels |
| **Comptabilité** | Suit règlements, écritures, états |
| **Commissaire aux comptes** | Rédige le rapport annuel (profil autorisé) |
| **Direction** | Convoque et préside l'assemblée |

## 2. Règles d'or

1. Chaque action exige le **droit** du module Copropriété (création ou modification).
2. Un appel de charges ne se génère que si l'immeuble a **des lots** avec leurs tantièmes.
3. La répartition suit les **tantièmes** : montant du lot = montant appelé × tantièmes du lot ÷ total des tantièmes.
4. Les comptes **Copropriété — tiers** et **produit des charges** doivent être paramétrés.

## 3. Procédures

### COP-01 — Immeuble et lots

**Où** : Immeubles & lots.

1. **Créer l'immeuble** : nom de la résidence (obligatoire), adresse, nombre de lots, syndic, division.
2. **Ajouter les lots** : numéro de lot (obligatoire) et tantièmes.
3. Contrôler la somme des tantièmes.

### COP-02 — Budget annuel

**Où** : Budgets.

1. Choisir l'immeuble ; saisir l'exercice et les **postes** de dépense.
2. Enregistrer : le budget est « voté » avec son montant annuel total.

### COP-03 — Appel de charges

**Où** : Appels de charges.

1. Choisir le **budget**, la **période** et le **montant à appeler** (tous obligatoires).
2. Générer : l'appel est réparti par tantièmes sur tous les lots, statut « émis ».
3. L'ERP comptabilise l'appel (copropriétaires au débit, produit des charges au crédit).

### COP-04 — Règlements

1. Ligne de l'appel › **régler** : saisir le règlement du copropriétaire.
2. Suivre le restant dû par lot.

### COP-05 — Fonds travaux

**Où** : Fonds travaux.

1. Choisir l'immeuble, la **période** et le **montant** (obligatoires).
2. Générer l'appel : répartition par tantièmes, écriture vers le compte **Fonds travaux**.

### COP-06 — Assemblée générale

**Où** : Assemblées générales.

1. Choisir l'immeuble ; saisir la **date** (obligatoire), l'**ordre du jour** et le **procès-verbal**.
2. Enregistrer l'AG ; conserver le PV signé.

### COP-07 — États de synthèse

**Où** : États de synthèse : compte de gestion, travaux non clôturés, dettes et créances, constats pour le commissaire.

1. Choisir immeuble et exercice.
2. Imprimer pour l'assemblée et le commissaire.

### COP-08 — Rapport du commissaire aux comptes

**Où** : Rapport commissaire aux comptes.

1. Réservé aux profils autorisés ; immeuble et exercice obligatoires.
2. Renseigner nom, date, avis, observations ; enregistrer ; l'historique des rapports se consulte.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Droit du module absent | Action refusée |
| Immeuble sans nom | Refusé |
| Lot sans numéro | Refusé |
| Appel sans lots | Refusé |
| Compte copropriété non paramétré | Écriture refusée (message) |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Budget, appel, fonds travaux | Tables dédiées + écritures |
| AG | Date, ordre du jour, PV |
| Rapport CAC | Historique des rapports |

## 6. RACI

| Procédure | Syndic | Compta | CAC | Direction |
|---|---|---|---|---|
| COP-01/02 Immeuble, budget | R | C | – | A |
| COP-03/05 Appels | R | R | – | I |
| COP-06 AG | R | C | I | A |
| COP-07 États | C | R | I | I |
| COP-08 Rapport | I | C | R | I |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| « Aucun lot rattaché » | Lots non saisis | Ajouter les lots |
| Répartition faussée | Tantièmes erronés | Corriger les tantièmes |
| Écriture absente | Comptes non paramétrés | Paramètres › Comptes par défaut |

## 8. Liste de contrôle annuelle

1. ☐ Budget voté
2. ☐ Appels émis et suivis
3. ☐ Fonds travaux appelé
4. ☐ AG tenue, PV conservé
5. ☐ États de synthèse remis au commissaire

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
