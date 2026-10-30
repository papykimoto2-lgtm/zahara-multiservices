# Manuel de procédures — Aménagement foncier

**Réf.** PRO-AME · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour confier des travaux d'aménagement à un aménageur : convention, avenants, situations de travaux, retenues de garantie, paiement en espèces ou en nature (lots).
**Principe directeur** : même rigueur que les marchés de constructeurs ; un paiement en nature attribue des lots à l'aménageur et se comptabilise comme tel.

> Les noms de boutons sont ceux du module **Aménagement foncier** (Aménageurs, Conventions, Avenants, Situations travaux, Retenues de garantie).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Responsable aménagement** | Référence les aménageurs, rédige conventions, avenants, situations |
| **Direction** | Valide les marchés et les situations |
| **Comptabilité** | Contrôle les écritures, règle les situations |

## 2. Règles d'or

1. **Aménageur** : raison sociale obligatoire.
2. **Convention** : numéro et aménageur obligatoires.
3. **Situation** : convention et numéro obligatoires ; la retenue de garantie est de 10 % par défaut.
4. Un **paiement en nature** ne porte que sur des lots disponibles.

## 3. Procédures

### AME-01 — Référencer un aménageur

**Où** : Aménageurs › **+ Aménageur** : raison sociale (obligatoire), RCCM, NCC, responsable, contacts, spécialité, agrément, banque, compte, statut.

### AME-02 — Convention d'aménagement

**Où** : **+ Convention**.

1. Saisir numéro, aménageur, programme, objet, description, date de signature.
2. Montants : HT, TVA, TTC ; **retenue de garantie** (10 % par défaut) ; avance (%).
3. **Mode de rémunération** : espèces ou **en nature** (choisir les lots concernés).
4. Enregistrer : les lots en nature **disponibles** passent à « réservé aménageur » et sont rattachés à la convention.

### AME-03 — Avenant

**Où** : **+ Avenant** : convention et numéro obligatoires, date, objet, montants HT, TVA, TTC, statut.

### AME-04 — Situation de travaux

**Où** : **+ Situation de travaux**.

| Champ | Règle |
|---|---|
| **Convention, numéro** | Obligatoires |
| HT, TVA, TTC, date, travaux réalisés, avancement (%) | Constat |
| Retenue de garantie (%) | 10 par défaut ; la retenue et le net à payer sont calculés |
| **Mode** | Espèces, virement… ou **nature** |
| Statut | Brouillon, validée, payée… |

1. Statut **validée** ou **payée** : écriture au **débit du compte 605** (travaux d'aménagement). Le crédit va au **401** (fournisseur) pour un règlement en espèces, ou au **212** pour un paiement en nature.
2. **Paiement en nature** : les lots désignés passent à « attribué aménageur » avec la date d'attribution.
3. Statut **payée** : écriture de règlement (fournisseur / banque).

### AME-05 — Retenues de garantie

Suivre les retenues cumulées issues des situations validées ou payées (onglet Retenues de garantie) ; la libération relève de la décision de la direction après réception des travaux.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Raison sociale, numéro ou aménageur absent | Refusé |
| Lot déjà réservé ou vendu | Non attribuable en nature |
| Compte par défaut manquant | Écriture refusée (message) |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Convention, avenant, situation | Tables dédiées |
| Lots attribués | Statut du lot + convention liée |
| Comptabilisation | Écritures du journal |

## 6. RACI

| Procédure | Resp. aménagement | Direction | Comptabilité |
|---|---|---|---|
| AME-01 Aménageur | R | I | C |
| AME-02/03 Convention, avenant | R | A | I |
| AME-04 Situation | R | A | R |
| AME-05 Retenues | C | A | R |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Lot non attribuable en nature | Statut différent de disponible | Libérer le lot |
| Pas d'écriture | Situation en brouillon | Passer à validée |

## 8. Liste de contrôle

1. ☐ Aménageur référencé
2. ☐ Convention signée, lots en nature désignés
3. ☐ Situations validées et comptabilisées
4. ☐ Retenue suivie jusqu'à sa libération

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
