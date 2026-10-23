# Manuel de procédures — Réapprovisionnement des caisses

**Objet** : fixer qui fait quoi, dans quel ordre et avec quelle preuve pour réapprovisionner la caisse d'une division, de la demande jusqu'à l'entrée effective des fonds, et pour traiter les demandes restées ouvertes.
**Principe directeur** : une dotation validée sur le papier ne fait entrer aucun franc en caisse. L'argent n'est réputé versé que lorsque les **deux bons de virement** créés par « Servir » ont été **validés**. Chaque étape est faite par une personne différente de la précédente, et tout reste tracé.

> Les noms de boutons et de champs sont ceux du module **Caisse › Réapprovisionnement** de l'ERP. Ce manuel complète le *Manuel de procédures — Caisse* (CAI-04 validation des bons, CAI-06 transfert entre caisses).

---

## 1. Rôles et responsabilités

| Rôle | Qui | Responsabilités principales |
|---|---|---|
| **Demandeur** | Titulaire ou responsable de la caisse de la division | Rédige la demande, la justifie, la soumet. Ne voit que les demandes de ses caisses |
| **Validateur de la demande** | Rôle disposant du droit de validation et d'un plafond couvrant le montant (DG, gérant, ou remplaçant désigné) | Accorde (en tout ou en partie), rejette ou annule. Ne valide jamais sa propre demande |
| **Serveur** | Trésorerie / caisse centrale (rôle autorisé à saisir en Caisse) | Verse les fonds : choisit leur provenance, crée les bons de virement |
| **Validateur des bons** | Même profil que le validateur de la demande (CAI-04) | Valide ou rejette les deux bons créés par « Servir » ; c'est cette validation qui rend les fonds effectifs |
| **Comptable** | Rôle comptable | Ventile les bons sur le compte relais 585 « Virement interne » |
| **Administrateur / manager** | admin, manager | Voit toutes les caisses, régularise, remplace un titulaire absent |

### Matrice RACI

R = réalise, A = approuve, C = consulté, I = informé.

| Procédure | Demandeur | Validateur | Serveur | Comptable | Administrateur |
|---|---|---|---|---|---|
| REA-01 Rédiger et soumettre | R | I | – | – | C |
| REA-02 Valider ou rejeter | I | A/R | I | – | C |
| REA-03 Servir | I | I | R | I | C |
| REA-04 Valider les bons | I | A/R | I | I | – |
| REA-05 Annuler une demande caduque | C | A/R | C | – | C |
| REA-06 Revue des demandes ouvertes | C | A | R | I | R |

---

## 2. Règles d'or

1. **« Servie » n'est pas « versée ».** Une demande passe à *Servie* dès que les bons sont créés ; les fonds ne sont effectifs que lorsque les deux bons sont validés. Une ligne *Servie* marquée « ⏳ bons à valider » attend encore cette validation.
2. **Le demandeur et le validateur sont deux personnes différentes** : on ne valide pas sa propre demande.
3. **La provenance des fonds est obligatoire.** Servir sans dire d'où vient l'argent est impossible : une autre caisse (avec bon de sortie en miroir) ou une origine externe justifiée.
4. **Une caisse ne peut pas être négative.** Le virement est refusé si la caisse source n'a pas le solde.
5. **On n'efface pas une demande engagée.** Seul un brouillon se supprime. Une demande soumise se rejette ; une demande validée mais jamais servie s'annule avec un **motif obligatoire**.
6. **Si les fonds sont remis hors logiciel, on le dit tout de suite** : on annule la demande avec le motif, ou on rattache le virement à la demande (REA-05). Sinon la demande reste ouverte et peut être servie une seconde fois.
7. **Une demande, un motif lisible.** « prêt » ne suffit pas : bénéficiaire, objet et justificatif doivent apparaître.

---

## 3. Cycle de vie d'une demande

| Statut | Signification | Qui peut agir | Suite possible |
|---|---|---|---|
| 📝 **Brouillon** | Rédigée, modifiable | Demandeur | Soumettre, modifier, supprimer |
| 🕓 **Soumise** | En attente de décision | Validateur | Valider ou rejeter |
| ✅ **Validée — à servir** | Montant accordé fixé, aucun franc encore versé | Serveur | Servir ; annuler (validateur) |
| 🏦 **Servie** | Bons de virement créés ; fonds effectifs après validation des bons | Validateur des bons | – |
| ❌ **Rejetée** | Refusée avec motif | – | Refaire une demande |
| ⊘ **Annulée** | Validée mais caduque ou déjà payée hors logiciel, avec motif | – | – |

Un compte de **retard** s'affiche sur une demande *validée* depuis plus de **7 jours** sans être servie.

---

## 4. Procédures

### REA-01 — Rédiger et soumettre une demande

**Qui** : demandeur. **Où** : Caisse › Réapprovisionnement › ➕ Nouvelle demande.

| Champ | Règle |
|---|---|
| **Division** | Obligatoire. Une caissière ne voit que les divisions de ses caisses |
| **Caisse à réapprovisionner** | Obligatoire, rattachée au demandeur |
| **Montant demandé** | Strictement supérieur à zéro |
| **Date de besoin** | Date à laquelle les fonds sont nécessaires |
| **Motif** | Obligatoire : c'est lui que la hiérarchie lit pour décider |

1. Remplir et enregistrer : la demande est en **brouillon**. Le solde de la caisse à cet instant est figé (« solde constaté »).
2. Cliquer sur **📤 Soumettre** : la demande passe à *Soumise* et un message est envoyé dans la conversation de la caisse.

**Contenu attendu du motif** : bénéficiaire, objet, détail des montants (ex. « salaire 75 000 + loyer 125 000 »), référence du devis ou de l'ordre de mission si elle existe.

**[bloquant]** Division ou caisse absente, caisse non rattachée, montant nul, motif vide.

**[confirmation]** Une demande identique (même caisse, même montant) créée il y a moins de 24 h : le logiciel demande de confirmer.

### REA-02 — Valider ou rejeter une demande

**Qui** : validateur. **Où** : Caisse › Réapprovisionnement, ou Pilotage › Validations › Réapprovisionnement.

1. Lire le motif, le montant demandé, le **solde constaté** et le demandeur.
2. **✅ Valider** : saisir le **montant accordé** (par défaut le montant demandé). Il peut être inférieur, jamais supérieur.
3. Ou **❌ Rejeter** avec un motif (voir la grille ci-dessous). Le rejet est définitif : le demandeur refait une demande.

| Décision | Quand |
|---|---|
| Valider en totalité | Besoin justifié, montant cohérent avec le solde constaté |
| Valider en partie | Besoin justifié mais montant excessif, ou une partie déjà payée |
| Rejeter | Justificatif absent, doublon, besoin couvert autrement, procédure non respectée |

**Délai recommandé** : décider **dans les 2 jours ouvrés**. Une demande laissée *soumise* plusieurs semaines laisse le demandeur sans réponse.

**[bloquant]** Valider sa propre demande ; montant accordé supérieur au montant demandé ; plafond du validateur inférieur au montant ; droit de validation absent.

**Effet** : message interne à la caisse indiquant la décision et, en cas de rejet, le motif.

### REA-03 — Servir une demande validée

**Qui** : serveur (trésorerie / caisse centrale). **Où** : bouton **🏦 Servir** sur la ligne de la demande.

**Avant de servir**

1. Vérifier que les fonds n'ont **pas déjà été remis** hors logiciel (REA-05). Servir deux fois la même dotation est l'erreur la plus coûteuse.
2. Vérifier que la **caisse destinataire est ouverte** (session en cours).
3. Si les fonds viennent d'une autre caisse : que celle-ci est **ouverte**, qu'elle a le **solde suffisant**, et que le compte « Virement interne entre caisses » (585) est paramétré.

**En servant**

1. Choisir la **provenance des fonds** :
   - **📤 Une autre caisse** (ex. la caisse centrale) : le logiciel crée un **bon de sortie** sur la caisse source et un **bon d'entrée** sur la caisse destinataire, liés entre eux et ventilés sur le compte 585.
   - **🏛️ Hors caisse** (banque, DG, apport externe) : saisir la **justification** (chèque n°, remise du DG…), au moins quelques mots. Un seul bon d'entrée est créé et la provenance y est tracée.
2. Confirmer. La demande passe à **Servie**.

**[bloquant]** Demande non validée ; caisse destinataire fermée ; caisse source fermée, tenue par une autre personne, ou au solde insuffisant ; compte 585 non paramétré ; provenance non indiquée ; justification externe trop courte.

> **Attention** : à ce stade, les soldes des caisses ne bougent pas. Passer à REA-04.

### REA-04 — Valider les bons de virement

**Qui** : validateur des bons. **Où** : Caisse › Validations (procédure CAI-04).

1. Ouvrir les bons issus de la demande (pièce de référence = numéro REAP-…).
2. **Valider les deux bons ensemble** : le bon de sortie de la caisse source et le bon d'entrée de la caisse destinataire. Un bon dont le jumeau est rejeté ou d'un montant différent est bloqué.
3. Vérifier sur la ligne de la demande que l'indicateur « ⏳ bons à valider » a disparu.

**Délai recommandé** : valider **le jour même** du service. Il est arrivé que des demandes restent *Servie* avec des bons non validés : la caisse destinataire n'avait en réalité pas reçu les fonds.

**Si un bon est rejeté** : la ligne affiche « ⚠️ bon rejeté — fonds non versés ». Corriger la cause, puis refaire un virement ou demander à un administrateur de régulariser.

### REA-05 — Annuler une demande caduque ou déjà payée

**Qui** : validateur (droit de validation). **Où** : bouton **⊘ Annuler** sur une demande *Validée*.

À utiliser quand une demande validée **n'a jamais été servie** et que :

- le besoin a disparu ; ou
- les fonds ont été remis **hors logiciel** (virement manuel, bon d'appro, avance personnelle remboursée) ; ou
- c'est un **doublon** d'une autre demande.

1. Vérifier auprès du demandeur que l'argent a bien été remis ou que la dépense n'est plus due.
2. Cliquer sur **⊘ Annuler** et saisir un **motif précis** (qui, quoi, quand, par quel bon). Exemple : « Fonds déjà entrés en caisse le 09/10 par le bon BE-571-20261009-001, hors circuit Servir ».
3. Un message est envoyé dans la conversation de la caisse.

Une demande annulée reste visible dans l'historique avec son motif : on n'efface jamais une demande validée.

**Cas du virement déjà fait à la main** : si un transfert entre caisses du même montant est enregistré alors qu'une demande validée l'attend, le logiciel propose de **rattacher le virement à la demande**, ce qui la passe à *Servie* sans doublon. Accepter si le virement correspond bien à cette demande ; sinon refuser pour garder les deux séparés.

**[bloquant]** Demande qui n'est pas *Validée* ; motif vide.

### REA-06 — Revue des demandes ouvertes

**Qui** : validateur, serveur et administrateur. **Quand** : **chaque semaine**, et à chaque clôture mensuelle.

1. Ouvrir Caisse › Réapprovisionnement › **À traiter**. Les tuiles donnent le nombre de demandes *soumises*, *validées* et *en retard*.
2. Pour chaque demande **soumise** : décider (REA-02).
3. Pour chaque demande **validée en retard** (plus de 7 jours) : demander au demandeur si elle est encore due. Si oui, la servir (REA-03) ; sinon, l'annuler avec motif (REA-05).
4. Pour chaque demande **Servie** marquée « ⏳ bons à valider » : faire valider les bons (REA-04).
5. Pour les **montants élevés** ou décrits comme prêts, exiger bénéficiaire, échéance de remboursement et validation de la direction avant de servir.
6. Consigner les décisions : le motif de chaque annulation ou rejet fait foi.

**Règle d'ancienneté recommandée** : toute demande ouverte depuis plus de **15 jours** doit être soit servie, soit annulée ou rejetée à la prochaine revue.

---

## 5. Contrôles et blocages

| Contrôle | Effet |
|---|---|
| Division, caisse ou motif absent ; montant nul | Demande refusée |
| Caisse non rattachée au demandeur | Demande refusée |
| Demande identique à moins de 24 h | Confirmation demandée |
| Validation de sa propre demande | Refusée |
| Montant accordé supérieur au montant demandé | Validation refusée |
| Plafond du validateur insuffisant | Validation refusée |
| Servir une demande non validée | Refusé |
| Caisse destinataire ou source fermée | Service refusé |
| Solde de la caisse source insuffisant | Service refusé |
| Compte « Virement interne » non paramétré | Service refusé |
| Provenance non indiquée, ou justification externe trop courte | Service refusé |
| Annulation sans motif, ou d'une demande non *validée* | Refusée |
| Modification ou suppression d'une demande autre qu'un brouillon | Refusée |
| Demande validée depuis plus de 7 jours non servie | Signalée « en retard » |
| Demande *Servie* dont un bon n'est pas validé | Signalée « bons à valider » |

---

## 6. Traçabilité

| Événement | Où il est conservé |
|---|---|
| Création : demandeur, date, solde constaté de la caisse | Demande |
| Soumission : date | Demande |
| Validation ou rejet : validateur, date, montant accordé ou motif de rejet | Demande |
| Annulation : auteur, date, motif | Demande |
| Service : serveur, date, caisse source ou provenance externe, bons créés | Demande et mouvements de caisse |
| Bons : numéro BE/BS, validateur, ventilation sur le compte 585 | Mouvements de caisse |
| Régularisation : date et motif du rattachement ou de la correction | Demande |
| Notifications : soumission, validation, rejet, annulation | Messagerie interne de la caisse |

---

## 7. Erreurs fréquentes

| Symptôme | Cause probable | Action |
|---|---|---|
| La demande est « servie » mais le solde de la caisse n'a pas changé | Les bons de virement ne sont pas encore validés | Valider les deux bons (REA-04) |
| « Vous êtes l'auteur de la demande… » | Demandeur et validateur identiques | Un autre responsable valide |
| Le bouton **Servir** échoue : caisse fermée | La caisse destinataire ou source n'a pas de session ouverte | Ouvrir la caisse (CAI-02) puis servir |
| « Solde de la caisse source insuffisant » | La caisse source ne couvre pas le montant | Choisir une autre source ou reporter |
| « Compte Virement interne non paramétré » | Compte 585 absent des comptes par défaut | Paramètres › Comptes par défaut |
| Demande validée depuis des semaines | Personne n'a la charge de servir | REA-06 : servir ou annuler |
| Deux demandes pour la même dépense | Doublon (ex. même caisse, même montant, même jour) | Annuler ou rejeter la seconde avec motif |
| Fonds déjà remis hors logiciel, demande encore ouverte | Remise à la main, bon d'appro ou compte courant associé | Annuler avec motif, ou rattacher le virement (REA-05) |
| Deux demandes avec le même numéro | Numérotation ancienne, avant correction | Se référer à la date et au demandeur ; signaler à l'administrateur |
| Demande bloquée « soumise » | Pas de validateur disponible | Faire valider par le remplaçant désigné |

---

## 8. Liste de contrôle

**Demandeur, avant de soumettre**

1. Motif détaillé (bénéficiaire, objet, justificatif).
2. Montant exact, date de besoin.
3. Aucune demande identique déjà ouverte.

**Validateur**

1. Motif et solde constaté lus.
2. Montant accordé adapté.
3. Demandeur différent du validateur.

**Serveur, avant de servir**

1. Fonds non déjà remis hors logiciel.
2. Caisses source et destinataire ouvertes, solde suffisant.
3. Provenance indiquée et justifiée.

**Après avoir servi**

1. Les deux bons sont validés le jour même.
2. L'indicateur « bons à valider » a disparu.

**Chaque semaine**

1. Aucune demande soumise sans décision.
2. Aucune demande validée de plus de 15 jours sans suite.
3. Aucune demande *Servie* avec bons non validés.
4. Les demandes annulées ou rejetées ont un motif lisible.

---

## 9. Suivi des révisions

| Version | Date | Auteur | Objet |
|---|---|---|---|
| 1.0 | Octobre 2026 | | Création |
