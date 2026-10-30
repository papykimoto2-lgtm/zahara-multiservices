# Manuel de procédures — Gestion locative

**Réf.** PRO-LOC · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour gérer des biens en location : propriétaires mandants, baux, états des lieux, quittances, encaissements, recouvrement, révision des loyers, charges, reversements.
**Principe directeur** : un bail actif génère une quittance par échéance ; chaque encaissement et chaque reversement passe en comptabilité ; la part du propriétaire est isolée en compte de mandant.

> Les noms de boutons sont ceux du module **Gestion locative** (Biens, Propriétaires, Démarcheurs, Artisans, Candidatures, Baux, États des lieux, Quittances, Recouvrement, Révision loyers, Charges, Signalements).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Gestionnaire locatif** | Tient biens, baux, quittances, états des lieux |
| **Comptabilité** | Contrôle écritures, encaissements, reversements |
| **Direction** | Décide révisions, contentieux |
| **Propriétaire mandant** | Confie le bien en gestion, reçoit son reversement |

## 2. Règles d'or

1. Un **bail** exige locataire, bien et loyer supérieur à zéro.
2. Un **locataire** exige un nom et un **téléphone**.
3. Une **convention de mandat** exige le nom du propriétaire et la **date de signature**.
4. Un encaissement ne dépasse jamais le **reste dû** ; un reversement ne dépasse jamais le **reste à reverser**.
5. Le quittancement d'un mois **clôturé** est refusé.

## 3. Procédures

### LOC-01 — Propriétaire et mandat

**Où** : Propriétaires (mandats) › nouvelle convention.

1. Saisir nom ou raison sociale (obligatoire), date de signature de la convention (obligatoire), pourcentage d'**honoraires** de gestion, statut.
2. Les honoraires se retiennent à chaque quittance ; la part restante est due au propriétaire.

### LOC-02 — Bail

**Où** : **+ Nouveau bail**.

1. Choisir le **locataire** (ou le créer : nom et téléphone obligatoires) et le **bien** loué.
2. Saisir loyer (> 0), charges, périodicité, jour d'échéance, date de début, durée (12 mois par défaut), nature (habitation ou autre), assujettissement à la TVA, propriétaire mandant, statut.
3. Enregistrer : référence de bail, date de fin calculée.

### LOC-03 — État des lieux

**Où** : États des lieux : constat contradictoire à l'entrée ; le conserver au dossier du bail.

### LOC-04 — Quittancement mensuel

**Où** : Quittances › choisir le mois › générer.

1. L'ERP génère une quittance par **bail actif** dont l'échéance tombe ce mois (début et fin du bail respectés).
2. Une quittance existante pour le même bail et la même période n'est **jamais doublée**.
3. Contenu : loyer, charges, TVA collectée (18 % sur loyer non résidentiel assujetti), total ; pour un bail mandaté : **honoraires** et **part propriétaire**.
4. Écriture : locataire au débit ; honoraires de gestion, part du mandant, provision de charges et TVA au crédit ; sans mandat, le loyer va en produit.
5. Imprimer la quittance.

**[bloquant]** Aucune échéance à cette période (vérifier la périodicité) ; période clôturée.

### LOC-05 — Encaissement

**Où** : Quittances › encaisser.

1. Saisir le montant (> 0, ≤ reste dû), mode, date.
2. L'ERP passe l'écriture de trésorerie / locataire ; la quittance devient **soldée**, **partielle** ou **impayée**.

### LOC-06 — Recouvrement

**Où** : Recouvrement. Les impayés se classent par jours de retard :

| Retard | Palier |
|---|---|
| 5 jours et plus | Rappel amiable |
| 15 jours | Relance formelle |
| 30 jours | Mise en demeure |
| 60 jours | Commandement de payer |

1. Relancer par message préparé (WhatsApp) ; la relance est tracée.
2. Au-delà de la mise en demeure, ouvrir un dossier juridique (PRO-JUR).

### LOC-07 — Reversement au propriétaire

1. Enregistrer le reversement (montant > 0, ≤ reste à reverser).
2. Écriture : compte de mandant (467) / trésorerie.

### LOC-08 — Révision annuelle du loyer

**Où** : Révision loyers.

1. Saisir le **taux** et la **date d'effet** ; simuler sur les baux éligibles.
2. **Appliquer** : confirmation, puis le nouveau loyer prend effet à la date choisie.

### LOC-09 — Régularisation des charges

**Où** : Charges.

1. Choisir le bail et l'exercice ; saisir les **charges réelles**.
2. L'ERP compare provisions et charges réelles et comptabilise la régularisation.

**[bloquant]** Ni provision ni charge sur l'exercice.

### LOC-10 — Signalements, candidatures, artisans

1. **Signalements** : incidents remontés par les locataires ; l'**annuaire des artisans** sert à désigner l'intervenant.
2. **Candidatures** : prospects intéressés par un bien.
3. **Démarcheurs** : agréés ou non.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Loyer nul, locataire ou bien absent | Bail refusé |
| Montant d'encaissement > reste dû | Refusé |
| Reversement > reste à reverser | Refusé |
| Période clôturée | Quittancement refusé |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Quittance | Table des quittances + écriture QUIT- |
| Encaissement, reversement | Quittance (règlements) + écritures |
| Révision | Baux (nouveau loyer, date d'effet) |

## 6. RACI

| Procédure | Gestionnaire | Compta | Direction |
|---|---|---|---|
| LOC-01/02 Mandat, bail | R | C | I |
| LOC-04 Quittancement | R | C | I |
| LOC-05 Encaissement | R | R | I |
| LOC-06 Recouvrement | R | C | A |
| LOC-07 Reversement | C | R | I |
| LOC-08 Révision | R | C | A |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Aucune quittance générée | Bail non actif ou périodicité | Vérifier statut et périodicité |
| Quittance déjà générée | Même période | Rien à faire |
| Reversement refusé | Part propriétaire déjà reversée | Contrôler les quittances |

## 8. Liste de contrôle mensuelle

1. ☐ Quittances générées
2. ☐ Encaissements saisis
3. ☐ Impayés relancés selon le palier
4. ☐ Reversements aux propriétaires faits
5. ☐ Révisions et régularisations planifiées

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
