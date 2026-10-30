# Manuel de procédures — Carte commerciale et tournées

**Réf.** PRO-CRC · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour exploiter la carte commerciale (prospects, souscripteurs, commerciaux, programmes, foncier) et organiser les tournées de visite avec compte rendu géolocalisé.
**Principe directeur** : chaque visite est **planifiée**, puis **clôturée par un compte rendu** ; une tournée sans compte rendu n'existe pas pour le suivi commercial.

> Les noms de boutons sont ceux des pages **Carte Commerciale** et **Itinéraires**.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Commercial** | Réalise ses visites, saisit les comptes rendus |
| **Responsable commercial** | Planifie les tournées, analyse la carte |
| **Direction** | Consulte synthèse et résultats |

## 2. Règles d'or

1. Une tournée ou une étape exige un **commercial** et une **date**.
2. Toute étape réalisée reçoit un **compte rendu** avec résultat et statut.
3. La position GPS n'est capturée qu'avec l'**accord** du navigateur.
4. Un prospect se crée depuis la carte avec **+ Prospect** (procédure PRO-CRM).

## 3. Procédures

### CRC-01 — Lire la carte

**Où** : Carte Commerciale.

1. Cocher les couches : prospects, souscripteurs, commerciaux, programmes, parcelles (bornage), courbes de niveau, déblai / remblai, opérations foncières.
2. Filtrer par **commercial** ou rechercher (nom, téléphone, commune).
3. Lire la **synthèse** et la liste des **points affichés** ; sélectionner un point pour sa fiche.
4. **Ma position** localise l'utilisateur ; **Recentrer** et **Voir le foncier** cadrent la carte.

### CRC-02 — Exporter

1. Cliquer **Export** : les points affichés sont exportés ; sans point affiché, rien n'est exporté.

### CRC-03 — Créer une tournée

**Où** : Itinéraires › **+ Planifier une tournée**.

1. Saisir commercial et date (obligatoires), objectif, zone ciblée, notes.
2. Enregistrer : la tournée est « planifiée ».

### CRC-04 — Ajouter une étape

1. Choisir commercial et date (obligatoires), heure prévue, type de visite : prospect froid, visite site / programme, relance souscripteur, signature de contrat, collecte de versement, suivi client.
2. Choisir le client ou le prospect, ou saisir adresse et commune ; préciser objectif et notes.
3. L'étape est « planifiée » et s'affiche dans la tournée du jour du commercial.

### CRC-05 — Compte rendu de visite

**Où** : étape › compte rendu.

1. Choisir le **résultat** : contact établi, RDV pris, visite de site confirmée, négociation, souscription signée, versement encaissé, pas intéressé, absent, à reporter.
2. Choisir le **statut de l'étape** : réalisé, partiel, annulé.
3. Renseigner montant encaissé, date du prochain RDV, heure d'arrivée, durée, compte rendu détaillé ; la position est capturée si disponible.
4. Un versement encaissé se saisit ensuite dans PRO-PAI.

### CRC-06 — Supprimer une étape

1. Confirmer : l'étape **et son compte rendu** sont supprimés.

## 4. Traçabilité

Compte rendu daté, avec résultat, durée et position si capturée.

## 5. RACI

| Étape | Commercial | Resp. commercial | Direction |
|---|---|---|---|
| CRC-01/02 | R | R/A | I |
| CRC-03/04 | C | R/A | I |
| CRC-05 | R/A | C | I |
| CRC-06 | R | A | I |

## 6. Erreurs fréquentes

- Étape réalisée sans compte rendu.
- Montant encaissé noté au compte rendu mais non saisi en paiement.
- Suppression d'une étape qui détruit son compte rendu.

## 7. Liste de contrôle

- [ ] Tournées de la semaine planifiées
- [ ] Comptes rendus du jour saisis avant la fin de journée

## 8. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
