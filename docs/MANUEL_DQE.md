# Manuel de procédures — DQE, étude de prix et déboursé sec

**Réf.** PRO-DQE · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour chiffrer un programme : nomenclatures et prix unitaires (DQE), études de prix par ouvrage (déboursé sec, frais généraux, aléas, marge) et suivi du prévu face au réalisé.
**Principe directeur** : un prix se construit depuis ses ressources ; chaque programme a son DQE ; tout chiffrage par défaut est signalé et revu avant d'être appliqué aux lots.

> Les noms de boutons sont ceux des modules **DQE & Coût de revient** (Nomenclatures, Prix unitaires, Devis fournisseurs, Calculateur matériaux, Analyse & Écarts) et **Étude de Prix & Déboursé Sec** (Bibliothèque d'ouvrages, Ressources & Prix, Études de prix, Suivi budgétaire, Imputations SYSCOHADA).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Métreur / économiste** | Construit nomenclatures, ouvrages, études |
| **Responsable travaux** | Contrôle quantités et prix, valide le DQE |
| **Acheteur** | Tient les prix et devis fournisseurs |
| **Direction** | Valide marge, aléas, prix de vente |

## 2. Règles d'or

1. Le DQE est **propre à chaque programme** ; on choisit le programme avant de générer.
2. Les **prix unitaires** viennent du catalogue des ressources, tenu à jour par l'acheteur.
3. Une étude de prix applique des coefficients explicites : **frais généraux**, **aléas**, **marge**.
4. Un chiffrage qui retombe sur une valeur **par défaut** est signalé et se corrige avant validation.
5. On relit les quantités avant de les appliquer aux lots.

## 3. Procédures

### DQE-01 — Référentiel : ressources et prix

**Où** : Étude de prix › **Ressources & Prix** ; DQE › **Prix unitaires**.

1. **+ Ressource** : désignation, unité, prix unitaire.
2. Mettre à jour les prix à chaque devis fournisseur reçu (onglet **Devis fournisseurs**).
3. Contrôler les prix avant chaque étude.

### DQE-02 — Bibliothèque d'ouvrages

**Où** : Bibliothèque d'ouvrages › **+ Nouvel ouvrage**.

1. Définir l'ouvrage : catégorie (poste), unité, sous-détail de ressources avec quantités.
2. Le **déboursé sec unitaire** se calcule depuis le sous-détail.
3. Réutiliser les ouvrages dans toutes les études.

### DQE-03 — Nomenclature et DQE d'un programme

**Où** : DQE & Coût de revient.

1. Choisir le **programme** et le **type de logement**.
2. **🚀 Tout générer automatiquement** : Structure, Maçonnerie, Charpente/Couverture, Menuiserie, Élec/Plomberie, au **standing** choisi (éco, moyen ou haut). Chaque module est signalé réussi ou à revoir.
3. Ajuster les quantités ; les postes saisis à la main ne sont pas écrasés par une régénération depuis un plan.
4. Pour un chiffrage depuis un plan : l'éditeur de plans alimente la nomenclature, avec un forfait indicatif pour fondations et menuiseries, à ajuster.
5. **Calculateur matériaux** : estimer rapidement les besoins d'un ouvrage.

**[bloquant]** Programme ou type de logement non choisi ; standing différent de éco, moyen ou haut.

### DQE-04 — État récapitulatif du programme

**Où** : bouton d'état récapitulatif du DQE (étape 8).

1. Le récapitulatif liste, par type de logement : nombre d'unités, coût unitaire, sous-total.
2. Les types **sans nomenclature** sont signalés « par défaut » : les chiffrer avant de valider.
3. Valider le total, puis l'appliquer aux lots.

Un DQE peut se préparer **avant** la création des lots, à partir des modèles de logement du programme.

### DQE-05 — Étude de prix

**Où** : Études de prix › nouvelle étude.

| Champ | Règle |
|---|---|
| **Intitulé** | Obligatoire |
| Programme, date | Rattachement |
| **Lignes** | Ouvrage et quantité |
| **Frais généraux, aléas, marge** | Pourcentages explicites |

1. Enregistrer (un anti-doublon évite deux études identiques sur double clic).
2. Lire : **déboursé sec**, frais généraux, aléas, **prix de revient**, marge, **prix de vente**, et la répartition par poste.

### DQE-06 — Suivi budgétaire

**Où** : Suivi budgétaire ; Imputations SYSCOHADA.

1. Choisir l'étude ; saisir les **réalisations** par poste.
2. Lire le tableau **prévu / réalisé / écart** ; les postes dépassés sont surlignés.
3. Consulter les **Imputations SYSCOHADA** pour rattacher les coûts aux comptes.
4. Expliquer chaque dépassement et, si besoin, réviser le prix ou négocier.

### DQE-07 — Analyse et écarts

**Où** : DQE › **Analyse & Écarts**. Contrôler les écarts de chiffrage ; réviser les prix unitaires qui dérivent.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Programme absent | Génération refusée |
| Type de logement absent | Génération refusée |
| Standing invalide | Refusé |
| Type sans nomenclature | Signalé « par défaut » |
| Intitulé d'étude absent | Étude refusée |
| Réalisé > prévu sur un poste | Ligne surlignée |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Nomenclature | Table des nomenclatures (marque du module généré) |
| Étude | Table des études de prix (lignes, coefficients, réalisations) |
| Ouvrage, ressource | Bibliothèque et catalogue de ressources |

## 6. RACI

| Procédure | Métreur | Resp. travaux | Acheteur | Direction |
|---|---|---|---|---|
| DQE-01 Ressources | C | C | R | I |
| DQE-02 Ouvrages | R | C | C | I |
| DQE-03/04 DQE | R | A | C | I |
| DQE-05 Étude de prix | R | C | C | A |
| DQE-06 Suivi | C | R | – | I |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Total DQE trop bas | Types « par défaut » | Chiffrer les nomenclatures manquantes |
| Prix incohérent | Prix de ressource ancien | Mettre à jour le catalogue |
| Quantités écrasées | Régénération depuis un plan | Vérifier les modules générés |
| Étude en double | Double clic | L'anti-doublon limite le risque : supprimer l'extra |

## 8. Liste de contrôle

1. ☐ Prix des ressources à jour
2. ☐ Ouvrages complets (sous-détail)
3. ☐ DQE généré pour le bon programme et le bon standing
4. ☐ Types « par défaut » traités
5. ☐ Coefficients (frais, aléas, marge) validés
6. ☐ Suivi prévu / réalisé relu

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
