# Manuel de procédures — Juridique

**Réf.** PRO-JUR · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour ouvrir et suivre les dossiers juridiques, traiter les contentieux, tenir le registre des attestations et suivre l'agrément du promoteur.
**Principe directeur** : un dossier par sujet, une échéance, un responsable ; toute pièce jointe au dossier ; les relances graves ouvrent un contentieux sans ressaisie.

> Les noms de boutons sont ceux du module **Département Juridique**.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Juriste** | Ouvre et instruit les dossiers, tient le registre des attestations |
| **Avocat** | Suit les contentieux (champ « avocat » du dossier) |
| **Direction** | Arbitre les priorités, décide des procédures |
| **Commercial / comptabilité** | Alimentent les pièces et les faits |

## 2. Règles d'or

1. **Référence obligatoire** et unique pour tout dossier.
2. Fixer une **date d'échéance** (audience, délai) et une **priorité**.
3. Joindre chaque pièce au dossier ; éviter de supprimer un contentieux ouvert.
4. Un dossier de contentieux par source : l'ERP met à jour le dossier existant au lieu d'en créer un second.

## 3. Procédures

### JUR-01 — Ouvrir un dossier juridique

**Où** : **+ Nouveau dossier**.

| Champ | Règle |
|---|---|
| **Référence** | Obligatoire |
| **Type** | Foncier, contrat de vente, convention constructeur, contentieux, administratif, conformité |
| Objet | Sujet du dossier |
| Interlocuteur, avocat | Parties |
| Dates d'ouverture et d'échéance | L'échéance dépassée s'affiche en rouge |
| **Priorité** | Urgente, haute, normale, basse |
| **Statut** | Ouvert, en instruction, en attente, clos favorable, clos défavorable |
| Montant, notes | Enjeu et suivi |

1. Enregistrer ; le dossier est classé par priorité dans **Dossiers actifs**.
2. Modifier un dossier conserve ses liens (souscripteur, bail) et sa date de création.

### JUR-02 — Instruire et suivre

1. Filtrer les dossiers par type, priorité, texte.
2. Ajouter les **pièces** : le compteur de documents s'affiche sur la ligne.
3. Mettre à jour le **statut** à chaque étape ; clore avec le résultat.
4. Contrôler chaque semaine les échéances dépassées.

### JUR-03 — Contentieux

**Où** : onglet **Contentieux** (dossiers de type contentieux).

1. Lire : référence, objet, interlocuteur, montant, avocat, audience, statut.
2. **Ouverture automatique** : une relance de recouvrement à **3 mois de retard** (mise en demeure) ou **6 mois** (résiliation) ouvre ou met à jour un dossier contentieux du souscripteur ; priorité haute puis urgente ; une note datée est ajoutée à chaque relance. Voir le manuel Relances (PRO-REL).
3. Coordonner avec l'avocat ; consigner audiences et décisions dans les notes et pièces.
4. Clore favorable ou défavorable ; informer la direction et la comptabilité.

### JUR-04 — Pièces et dossier du souscripteur

**Où** : fiche souscripteur › documents ; module Juridique.

1. Joindre les pièces types depuis la fiche souscripteur, dont l'attestation de non-gage et de non-hypothèque.
2. Les cessions et les financiers ont leurs propres pièces attendues.
3. Chaque attestation de solde est rattachée au dossier juridique du souscripteur (type « Contrat de vente »), créé s'il n'existe pas.

### JUR-05 — Registre des attestations

**Où** : onglet **Attestations**.

1. Consulter les attestations de solde (initiale et finale), de cession, de réservation, par type et par statut : validée, en attente, brouillon, rejetée, délivrée, à établir.
2. Établir ou faire valider : manuels Attestation de solde (PRO-ATT) et Soumission (PRO-ATT-SUB).

### JUR-06 — Agrément et conformité du promoteur

**Où** : onglet **Agrément & Conformité**.

1. Suivre l'agrément : journal de procédure, renouvellement, échéancier, alertes (délai réglable).
2. Contrôler la checklist des obligations légales du promoteur (VEFA, garantie d'achèvement, dépôt de garantie, publication des plans) ; les points à vérifier restent signalés.
3. Anticiper tout renouvellement avant l'échéance.

### JUR-07 — Contrats

**Où** : onglet **Contrats** (référence des contrats enregistrés). Classer chaque contrat signé au dossier juridique correspondant.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Référence absente | Dossier refusé |
| Échéance dépassée | Affichée en rouge |
| Contentieux existant pour la source | Mise à jour, pas de doublon |
| Suppression d'un dossier | Confirmation ; supprime aussi ses documents |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Dossier | Dossiers juridiques (statut, priorité, dates) |
| Pièces | Documents juridiques rattachés au dossier |
| Contentieux automatique | Notes datées du dossier |
| Attestation | Dossier du souscripteur et registre |

## 6. RACI

| Procédure | Juriste | Avocat | Direction | Autres services |
|---|---|---|---|---|
| JUR-01 Ouverture | R | C | I | C |
| JUR-02 Instruction | R | C | I | C |
| JUR-03 Contentieux | R | R | A | C |
| JUR-05 Attestations | R | – | I | C |
| JUR-06 Agrément | R | C | A | – |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Dossier sans souscripteur lié | Création manuelle | Rattacher au souscripteur concerné |
| Contentieux en double | Dossiers créés à la main | Conserver le dossier automatique, y fusionner les notes |
| Échéance oubliée | Date non renseignée | Fixer l'échéance et la priorité |

## 8. Liste de contrôle hebdomadaire

1. ☐ Échéances dépassées traitées
2. ☐ Contentieux mis à jour
3. ☐ Pièces classées
4. ☐ Attestations à établir examinées
5. ☐ Alertes d'agrément vérifiées

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
