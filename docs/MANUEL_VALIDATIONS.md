# Manuel de procédures — Validations et délégations

**Réf.** PRO-VAL · **Version** 1.1 · **Date** Octobre 2026
**Objet** : fixer qui valide quoi dans l'ERP, à quelles conditions, comment rejeter, et comment assurer la continuité quand le validateur est absent.
**Principe directeur** : on ne valide **jamais sa propre demande**, et on ne valide **que dans la limite de son plafond** ; toute décision est tracée avec son auteur et sa date.

> Les noms de boutons sont ceux de la page **Validations**. Les détails propres à chaque module restent dans PRO-CAI (caisse), PRO-BUD (budget) et PRO-ATT (attestations).

---

## 1. Les files de validation

| Zone de la page | Ce qui attend une décision | Droit requis |
|---|---|---|
| **1 · Chantier & achats** (circuit général) | Bon de commande, réception de travaux, libération de retenue de garantie, attestation de solde (souscripteur, valeur finale, cession foncière) | Rôle administrateur ou manager |
| **1 · Étapes de dossier foncier** (même zone) | Étapes dont la fiche exige une validation par fonction (ex. identification de la procédure, contrat d’exclusivité, autorisation de lotir, clôture) ; bouton **📁 Dossier** pour ouvrir le dossier | Rôle de la fonction validatrice (Direction : admin, manager, dg, direction ; Service foncier : service_foncier) ou administrateur |
| **2 · Mouvements de caisse** | Entrées et sorties de caisse | Droit de validation sur Caisse, plafond suffisant |
| **2 · Engagements de dépense** | Fiches d'engagement (FED) soumises | Droit de validation sur Budget, plafond suffisant |
| **2 · Transferts budgétaires** | Transferts entre lignes | Droit de validation sur Budget, plafond suffisant |
| **2 · Budget prévisionnel** | Lignes de budget soumises | Droit de validation sur Budget, plafond suffisant |
| **2 · Réapprovisionnement** | Demandes de fonds de caisse soumises | Droit de validation sur Caisse, plafond suffisant |
| **3 · Historique** | Décisions rendues : caisse, demandes d'achat, réapprovisionnements | Consultation |

Un indicateur numérique signale le nombre d'éléments en attente. Le filtre **Secteur d'activité** limite l'affichage à une division.

## 2. Rôles

| Rôle | Responsabilités |
|---|---|
| **Demandeur** | Soumet ; ne valide jamais sa propre demande |
| **Validateur** | Valide ou rejette dans la limite de son droit et de son plafond |
| **Gérant signataire** | Vise les bordereaux de caisse (PRO-CAI) |
| **Suppléant** | Remplace le signataire pour le visa |
| **Administrateur** | Règle droits, plafonds et circuit de visa |

## 3. Règles d'or

1. **Droit de validation** : il se donne par rôle dans Paramètres › Utilisateurs › **Rôles & Accès**.
2. **Plafond de validation** : montant maximal qu'un rôle peut approuver. Vide ou non numérique : **illimité**. Zéro : **aucune validation**. Au-delà, le message « supérieur à votre plafond » s'affiche.
3. **Séparation des tâches** : le demandeur d'un bon de caisse ou d'une demande de réapprovisionnement ne peut pas le valider lui-même.
4. **Une décision est définitive** : un bon validé ne peut plus être rejeté, un bon rejeté ne peut plus être validé.
5. **Rejet motivé** : saisir le motif ; il est visible de l'auteur.
6. **Les profils caissière** n'ont jamais accès au circuit de validation.

## 4. Procédures

### VAL-01 — Soumettre à validation

1. Depuis le module concerné, cliquer **Soumettre** (bon de commande, fiche d'engagement, transfert, budget, demande de réapprovisionnement, attestation…).
2. Un élément déjà en attente n'est pas soumis deux fois (« Déjà en attente de validation »).
3. Fiche d'engagement, transfert, budget et demande de réapprovisionnement : seul un **brouillon** se soumet.

### VAL-02 — Circuit général (chantier et achats)

**Où** : zone 1, onglet **En attente** (recherche libre sur type, objet, demandeur, date, montant, statut).

1. Ouvrir la ligne, contrôler l'objet et le montant.
2. **Valider** : réservé aux rôles administrateur et manager ; sinon « Validation réservée à la hiérarchie ».
3. **Rejeter** : une fenêtre demande le motif.
4. Effet : le bon de commande, la réception ou l'attestation prend le statut validé ou rejeté.

### VAL-03 — Attestation de solde

1. Ouvrir d'abord les **pièces justificatives** avec le bouton **🔎 Pièces**.
2. Sans consultation des pièces, une confirmation est demandée avant de valider.
3. Si le souscripteur (ou la cession) n'est **plus soldé** à la date de validation, l'attestation est **refusée automatiquement** avec le motif correspondant.
4. À la validation, l'attestation officielle est émise et signée du nom du validateur (PRO-ATT).

### VAL-04 — Mouvements de caisse

**Où** : zone 2 › **Mouvements de caisse**.

1. Tout mouvement, entrée ou sortie, doit être validé avant de compter dans le solde, y compris ceux de la Direction.
2. Contrôles avant validation : droit de validation, plafond couvrant le montant, demandeur différent du validateur, bon ni déjà validé ni rejeté, **disponible suffisant** en caisse pour une sortie.
3. Transfert entre caisses : les deux bons liés doivent exister, avoir le même montant et ne pas être rejetés ; ils se valident ensemble.
4. Confirmer le message de validation.
5. Rejeter : saisir le motif ; le bon reste tracé sans effet sur le solde ; le bon lié est rejeté aussi.
6. Annuler un bon validé : saisir un **bon inverse** (contre-passation).

### VAL-05 — Visa du Gérant sur les bordereaux

**Où** : circuit des visas de caisse.

1. Étapes d'un bon : à imprimer et signer → à comptabiliser → à transmettre → transmis en attente du visa → visé ou refusé.
2. Joindre le **scan de la liasse signée** ; sans scan, le visa est impossible.
3. Seul le **signataire désigné** ou son **suppléant** peut viser ; sinon « Seul le Gérant Holding désigné (ou son suppléant) peut viser ».
4. Pour **refuser** un bon, le décocher et saisir le motif ; il revient à la comptabilité.
5. L'administrateur règle signataire, suppléant (qui doit être une autre personne) et date de mise en service du circuit.

### VAL-06 — Engagement de dépense (FED)

1. Seule une fiche **soumise** se valide ; droit Budget et plafond requis.
2. Si le **disponible** de la ligne est insuffisant, faire d'abord un transfert vers cette ligne.
3. À la validation, la ligne est décrémentée et la fiche devient la **Demande d'Achat** avec son numéro DA, visible à la Caisse.
4. Rejet : la fiche passe à « rejetée » avec le motif.

### VAL-07 — Transfert budgétaire

1. Seul un transfert **soumis** se valide ; droit Budget et plafond requis.
2. Le disponible de la ligne **source** doit couvrir le montant.
3. Rejet : statut « rejeté » avec motif.

### VAL-08 — Budget prévisionnel

1. Seul un budget **soumis** se valide ; droit Budget et plafond requis.
2. À la validation, la ligne devient active.
3. Rejet : statut « rejeté » avec motif ; seul un budget en brouillon se supprime.

### VAL-09 — Réapprovisionnement de caisse

1. Seule une demande **soumise** se valide ; droit Caisse et plafond requis ; l'auteur ne peut pas la valider.
2. Le montant accordé est **supérieur à zéro** et **au plus égal** au montant demandé.
3. La validation ne verse rien : il reste à **servir** la demande pour que les fonds entrent en caisse.
4. Une demande validée mais jamais servie s'**annule avec motif** ; elle ne se supprime pas.

### VAL-10 — Délégation et continuité

L'application ne prévoit pas de délégation à durée limitée. La continuité se règle ainsi :

1. **Validation courante** : donner à un remplaçant désigné (par exemple un manager) un rôle avec droit de validation et un plafond adapté, dans Rôles & Accès.
2. **Visa du Gérant** : renseigner le **suppléant** dans les paramètres du circuit.
3. Au retour du titulaire, **retirer** le droit ou le rôle donné au remplaçant.
4. Informer la Direction de toute délégation et de sa durée.

### VAL-11 — Consulter l'historique

1. Zone 3 : choisir Mouvements de caisse, Demandes d'Achat ou Réapprovisionnements.
2. Filtrer par statut : tous, validés uniquement, rejetés uniquement.

## 5. Traçabilité

Chaque décision conserve le nom du validateur, la date et, pour un rejet, le motif.

## 6. RACI

| Étape | Demandeur | Validateur | Gérant signataire | Administrateur |
|---|---|---|---|---|
| VAL-01 | R/A | I | I | I |
| VAL-02/03 | I | R/A | I | I |
| VAL-04 | C | R/A | I | I |
| VAL-05 | I | C | R/A | C |
| VAL-06 à VAL-09 | C | R/A | I | I |
| VAL-10 | I | C | C | R/A |
| VAL-11 | I | R | R | R |

## 7. Erreurs fréquentes

- Valider sans avoir ouvert les pièces d'une attestation.
- Chercher à valider sa propre demande.
- Plafond du validateur inférieur au montant.
- Valider un engagement alors que la ligne budgétaire n'a plus de disponible.
- Oublier de retirer une délégation à la fin de l'absence.
- Rejeter sans motif exploitable pour l'auteur.

## 8. Liste de contrôle

- [ ] Aucun élément en attente depuis plus de la période convenue en interne
- [ ] Plafonds et droits revus à chaque changement de poste
- [ ] Signataire et suppléant du visa à jour
- [ ] Délégations en cours listées et datées

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
