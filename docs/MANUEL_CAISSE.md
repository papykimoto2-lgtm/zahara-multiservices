# Manuel de procédures — Caisse

**Objet** : fixer qui fait quoi, dans quel ordre et avec quelle preuve pour tenir une caisse, de l'ouverture du tiroir à la clôture, aux états transmis à la hiérarchie et au rapprochement.
**Principe directeur** : l'argent n'est réputé entré ou sorti qu'une fois le mouvement **validé** par une autre personne. Chaque caisse n'a qu'une session ouverte à la fois, tenue par une seule personne. Tout écart se compte, se justifie et se trace.

> Les noms de boutons et de champs sont ceux du module **Caisse** de l'ERP.

---

## 1. Rôles et responsabilités

| Rôle | Qui | Responsabilités principales |
|---|---|---|
| **Caissière** | Personne désignée sur la caisse | Ouvre sa caisse, saisit les bons, compte et clôture. Ne voit que ses caisses (sa division, ses caisses assignées) |
| **Validateur** | Rôle disposant du droit de validation et d'un plafond suffisant (DG, gérant, ou remplaçant désigné) | Approuve ou rejette les bons ; confirme la réception d'une remise ; ne valide jamais sa propre demande |
| **Comptable** | Rôle comptable | Ventile les mouvements sur les comptes, contrôle le brouillard et le rapprochement |
| **Administrateur / manager** | admin, manager | Voit et paramètre toutes les caisses ; corrige, remplace un titulaire absent, supprime un mouvement non figé |

### Matrice RACI

R = réalise, A = approuve, C = consulté, I = informé.

| Procédure | Caissière | Validateur | Comptable | Administrateur |
|---|---|---|---|---|
| CAI-01 Paramétrage d'une caisse | – | I | C | A/R |
| CAI-02 Ouverture | R | I | – | C |
| CAI-03 Bons d'entrée et de sortie | R | I | I | C |
| CAI-04 Validation | I | A/R | I | – |
| CAI-05 Remise banque ou direction | R | A | I | C |
| CAI-06 Transfert entre caisses | R | A | I | C |
| CAI-07 Ventilation comptable | – | – | R | C |
| CAI-08 Clôture | R | I | I | C |
| CAI-09 États et rapprochement | C | I | A/R | C |

---

## 2. Règles d'or

1. **Une caisse, une session ouverte, une personne.** Seule la personne qui a ouvert la caisse (ou un administrateur) saisit et clôture.
2. **Le code PIN est obligatoire** pour ouvrir une caisse. Il comporte 4 chiffres et se définit avec le mot de passe du compte.
3. **Aucune entrée ni sortie ne compte avant validation.** Les mouvements en attente n'affectent pas le solde.
4. **On ne valide jamais sa propre demande.** Le rejet reste possible (retrait de sa demande).
5. **Tout écart se compte, s'explique et se trace.** Le comptage physique ne peut pas être négatif.
6. **Une pièce visée ou placée dans un bordereau est figée** : on ne la modifie plus, on ne la supprime plus.
7. **Les espèces d'un souscripteur** saisies dans Paiements créent automatiquement le bon d'entrée : on ne les ressaisit pas en caisse.

---

## 3. Procédures

### CAI-01 — Paramétrer une caisse

**Qui** : administrateur ou manager (droit de modification du module Caisse). **Où** : liste des caisses › paramétrage.

| Champ | Règle |
|---|---|
| **Nom** | Obligatoire |
| **Division** | Obligatoire si des divisions existent |
| **Compte de caisse** | Compte du plan commençant par **57** (trésorerie caisse), par exemple 57110001 |
| **Actif** | Une caisse inactive n'est plus utilisée |
| **Caissières** | Personnes autorisées à tenir cette caisse. Vide : accès ouvert aux habilités du module |
| **Destinataires internes et e-mails** | Reçoivent les états de caisse |
| **Envoi automatique journalier / mensuel** | État transmis à la clôture (journalier) ou chaque mois (mensuel) |

**Prérequis comptables** : comptes par défaut renseignés, dont « Virement interne entre caisses » (compte 585) pour les transferts.

### CAI-02 — Ouvrir la caisse

**Qui** : caissière. **Où** : carte de la caisse › **Ouvrir**.

1. Contrôler le **fond d'ouverture** proposé : il reprend le dernier comptage de clôture.
2. Compter le tiroir. Si le fond saisi **diffère** du dernier comptage, saisir le **motif** de la différence.
3. Saisir son **code PIN**. Sans PIN défini, l'ERP propose de le créer (4 chiffres, avec le mot de passe).
4. Valider : la session est ouverte au nom de la caissière, avec date et heure.

**[bloquant]**

- Fond négatif.
- Motif absent quand le fond diffère du dernier comptage.
- Caisse **déjà ouverte** par une autre personne, y compris sur un autre poste (vérifiée sur le cloud).
- PIN absent ou incorrect.
- Cloud injoignable : l'ouverture est refusée pour éviter une double session. Hors ligne, une confirmation explicite est demandée.

### CAI-03 — Enregistrer un bon d'entrée ou de sortie

**Qui** : caissière, sur sa session ouverte. **Où** : **Bon d'entrée** ou **Bon de sortie**.

| Champ | Règle |
|---|---|
| **Date** | Par défaut le jour. Une date antérieure au démarrage de la caisse classe le bon dans la **session historique** (reprise d'historique), sans effet sur le tiroir |
| **Montant** | Supérieur à zéro |
| **Motif** | Obligatoire |
| **Déposant** (entrée) ou **Bénéficiaire** (sortie) | Obligatoire |
| **Pièce** | N° de pièce justificative ; **obligatoire pour une remise** |
| **Justificatifs** | Documents joints au bon |

**À savoir**

- Le **numéro du bon** est attribué automatiquement, par caisse, par type et par jour. Il ne se saisit pas.
- Le bon est créé **en attente de validation**. Il n'entre pas dans le solde tant qu'il n'est pas validé.
- Une **sortie supérieure au solde** demande une confirmation explicite.
- Une **entrée** dont le montant et le nom correspondent à un versement souscripteur récent déclenche un avertissement : vérifier qu'il ne s'agit pas d'un doublon de Paiements.
- Un **bon identique** (même caisse, type, montant et personne) saisi depuis moins de 10 minutes déclenche un avertissement.
- Un décaissement lié à une **demande d'achat validée** est rattaché à celle-ci ; la demande n'est marquée décaissée qu'à la sortie réelle de l'argent.

**[bloquant]** Montant nul, motif ou déposant/bénéficiaire absent, caisse clôturée entre-temps, caisse désormais tenue par une autre personne, bon sans session, numéro déjà existant.

### CAI-04 — Valider ou rejeter un bon

**Qui** : validateur (droit de validation et plafond couvrant le montant). **Où** : onglet des validations du module Caisse.

1. Ouvrir la demande : numéro, montant, motif, bénéficiaire, demandeur.
2. **Valider** : le montant est immédiatement ajouté au solde (entrée) ou retiré (sortie).
3. Ou **Rejeter** avec un motif : le bon reste tracé, n'affecte pas le solde, et le motif est visible de son auteur.

**[bloquant]**

- Valider **sa propre demande**.
- Plafond du validateur inférieur au montant.
- **Transfert entre caisses** : le bon lié est introuvable, rejeté ou d'un montant différent ; on ne rejette pas un bon dont le jumeau est déjà validé.

**Effets** : une notification interne informe l'auteur de la validation ou du rejet. Un bon validé **après** la clôture de sa session recalcule le solde et l'écart de cette session.

### CAI-05 — Remise en banque ou à la direction

**Pourquoi** : de l'argent qui quitte le tiroir sans mouvement saisi est la cause la plus fréquente d'écarts ronds. Une remise est donc une sortie dédiée, avec preuve.

1. **Saisie** (caissière) : bouton de remise › **Remise en banque** ou **Remise à la direction**. La **pièce est obligatoire** : n° du bordereau de versement (banque) ou n° du reçu signé par la direction.
2. **Validation** du bon par un validateur (CAI-04).
3. **Confirmation de réception** par **une autre personne** que celle qui a saisi la remise : saisir la **référence de la preuve** (reçu bancaire, accusé signé).
4. Tant que la réception n'est pas confirmée, la remise reste signalée par une bannière « Remises à confirmer ».

**[bloquant]** Pièce absente à la saisie, confirmation par la personne qui a saisi, référence de preuve absente.

### CAI-06 — Transfert ou provisionnement entre caisses

**Qui** : caissière de la caisse source. **Où** : transfert de fonds.

1. Choisir la **caisse de destination** (différente de la source), le montant, la date, le motif.
2. L'ERP crée **deux bons** : une sortie sur la caisse source et une entrée sur la caisse destinataire, ventilés sur le compte relais 585 « Virement interne ». Un transfert n'est jamais une charge ni un produit.
3. Les **deux bons** passent par la validation habituelle (CAI-04).

**[bloquant]** Compte « Virement interne entre caisses » non paramétré, destination identique à la source, session source ou destinataire clôturée, caisse source tenue par une autre personne.

### CAI-07 — Ventiler les mouvements (comptabilité)

**Qui** : comptable. **Où** : onglet de ventilation.

1. Pour chaque mouvement « à ventiler », choisir le **compte de contrepartie**.
2. L'ERP génère l'écriture comptable et marque le mouvement ventilé.
3. Quand le motif n'est couvert par aucune règle, l'ERP propose de créer une **règle de ventilation automatique** (un mot-clé associé à un compte). Les mouvements suivants au motif similaire se ventileront seuls.

**Contrôles** : une écriture ne se régénère pas dans un **exercice clôturé** ; le mouvement repasse alors à ventiler.

### CAI-08 — Clôturer la caisse

**Qui** : la caissière qui tient la session (ou un administrateur). **Où** : carte de la caisse › **Clôturer**.

1. **Compter** le tiroir et saisir le **montant réellement compté**. Le champ est obligatoire.
2. L'ERP affiche le **solde théorique** (fond d'ouverture + entrées validées − sorties validées) et l'**écart**.
3. S'il existe des **mouvements en attente de validation**, les **mentionner** dans le champ prévu.
4. Si l'écart n'est pas nul et ne correspond pas exactement aux mouvements en attente, saisir l'**explication de l'écart**.
5. Confirmer. La session passe en **clôturée**, avec le comptage, l'écart, l'auteur et l'heure.
6. Si l'envoi automatique est activé, l'**état journalier** part à la hiérarchie.

**[bloquant]**

- Comptage absent ou **négatif**.
- Mouvements en attente non mentionnés.
- Écart non expliqué.
- Clôture **par un tiers** ou **tardive (plus de 24 h)** sans motif.
- Session **déjà clôturée** sur le cloud : jamais écrasée.
- Cloud injoignable : la clôture est refusée pour éviter d'écraser une clôture existante.

**Alertes**

- Solde théorique **négatif** : confirmation explicite. Le déficit sera reporté comme fond d'ouverture négatif de la session suivante tant qu'il n'est pas corrigé (entrée manquante à saisir ou régularisation comptable).
- Une session ouverte depuis plus de **24 h** est signalée en rouge sur l'écran Caisse : la clôturer avant d'en ouvrir une autre.

### CAI-09 — États, brouillard et rapprochement

| Document | Contenu | Quand |
|---|---|---|
| **Brouillard de caisse** (session ou période) | Liste des bons avec numéro, motif, montants, statut de validation et de ventilation. Imprimable | À la demande |
| **État journalier** | Résumé de la session clôturée | Envoi automatique à la clôture si activé, ou envoi manuel |
| **État mensuel** | Total des entrées, des sorties, solde net, cumul des écarts du mois | Envoi automatique si activé sur la caisse, ou envoi manuel |
| **Rapprochement** | Fond initial + entrées validées − sorties validées = solde attendu, comparé au dernier comptage réel ; écart réel cumulé ; **ruptures de chaîne** (fond d'ouverture différent du dernier comptage) | À la demande, au minimum chaque mois |

**Contrôle mensuel recommandé**

1. Lancer le rapprochement de chaque caisse.
2. Expliquer chaque rupture de chaîne et chaque écart.
3. Vérifier qu'aucune remise ne reste à confirmer et qu'aucun mouvement n'est resté en attente.

### CAI-10 — Corriger, supprimer, importer

**Modifier un bon**

- L'auteur modifie son bon tant que la session est ouverte et que le bon n'est pas ventilé ; un administrateur, un manager ou un comptable le peut plus largement.
- Toute modification d'un bon non encore validé le **remet en attente de validation**.
- Un bon issu d'un versement se modifie **depuis le versement** (module Paiements).
- Un bon **visé** ou **inclus dans un bordereau** est figé.

**Supprimer un mouvement**

- Réservé aux administrateurs, managers et comptables.
- Refusé si le bon est visé, inclus dans un bordereau ou rattaché à un exercice clôturé.
- Pour un transfert, le **bon lié est supprimé avec lui**, pour ne pas laisser un seul côté.

**Historique importé**

- Un import de mouvements est analysé avant confirmation. Un contrôle détecte les **doublons** (même caisse, date, type, montant, pièce, motif).
- Vérifier le rapport d'analyse avant de confirmer.

### CAI-11 — Verrouillage de l'écran

Après **10 minutes d'inactivité** sur l'écran Caisse, l'écran se verrouille. Pour reprendre, saisir son **PIN** (ou son mot de passe si aucun PIN n'est défini). Verrouiller en quittant le poste, même brièvement.

---

## 4. Contrôles et blocages

| Contrôle | Effet |
|---|---|
| Caisse déjà ouverte par une autre personne | Ouverture refusée |
| PIN absent ou incorrect | Ouverture refusée |
| Fond d'ouverture différent du dernier comptage sans motif | Ouverture refusée |
| Montant nul, motif ou personne manquants | Bon refusé |
| Remise sans pièce | Bon refusé |
| Sortie supérieure au solde | Confirmation demandée |
| Bon identique saisi depuis moins de 10 minutes | Confirmation demandée |
| Entrée ressemblant à un versement souscripteur | Confirmation demandée |
| Validation de sa propre demande | Refusée |
| Plafond du validateur insuffisant | Validation refusée |
| Comptage négatif ou absent à la clôture | Clôture refusée |
| Écart non expliqué, mouvements en attente non mentionnés | Clôture refusée |
| Clôture par un tiers ou après 24 h sans motif | Clôture refusée |
| Session déjà clôturée sur le cloud | Clôture refusée |
| Bon visé, en bordereau, ou exercice clos | Modification ou suppression refusée |
| Confirmation d'une remise par son auteur | Refusée |

---

## 5. Traçabilité

| Événement | Où il est conservé |
|---|---|
| Ouverture : auteur, heure, fond, motif de la différence | Session de caisse |
| Bons : numéro, auteur, demandeur, validateur, motif de rejet | Mouvement de caisse |
| Clôture : comptage, écart, explication, tiers ou tardive, mouvements en attente | Session de caisse |
| Remises : preuve et confirmateur | Mouvement de caisse |
| Ventilation : compte, auteur, date | Mouvement et écriture comptable |
| États journalier et mensuel | Messagerie interne et e-mails des destinataires |

---

## 6. Erreurs fréquentes

| Symptôme | Cause probable | Action |
|---|---|---|
| « Cette caisse est déjà ouverte par… » | Session ouverte par une autre personne ou un autre poste | Demander la clôture au titulaire ; sinon l'administrateur intervient |
| « Définissez votre code PIN » | Aucun PIN pour ce compte | Définir le PIN (4 chiffres, avec le mot de passe) |
| Le fond d'ouverture est refusé | Différent du dernier comptage sans motif | Saisir le motif de la différence |
| Le solde ne bouge pas après un bon | Bon en attente de validation | Faire valider le bon |
| « Vous ne pouvez pas valider votre propre demande » | Auteur et validateur identiques | Un autre validateur approuve |
| Clôture refusée | Écart non expliqué, mouvements en attente non mentionnés, comptage absent | Renseigner les champs demandés |
| Solde théorique négatif | Entrées non saisies ou déficit réel | Saisir les entrées manquantes ou régulariser |
| Transfert impossible | Compte 585 non paramétré ou session clôturée | Paramétrer le compte, ouvrir les deux caisses |
| Bon non modifiable | Visé, en bordereau, ventilé ou issu d'un versement | Passer par l'étape qui l'a créé, ou demander à un administrateur |
| L'écran se verrouille | 10 minutes d'inactivité | Saisir le PIN |

---

## 7. Liste de contrôle

**À l'ouverture**

1. Tiroir compté, fond saisi, motif si différence, PIN saisi.

**Pendant la journée**

1. Chaque encaissement et chaque sortie a son bon, sa pièce et son justificatif.
2. Les bons en attente sont signalés au validateur.
3. Aucune espèce de souscripteur n'est ressaisie en caisse.

**À la clôture**

1. Comptage physique réel saisi.
2. Mouvements en attente mentionnés.
3. Écart expliqué.
4. État journalier envoyé.
5. Aucune remise non confirmée.

**Chaque mois**

1. Rapprochement de chaque caisse, ruptures et écarts expliqués.
2. État mensuel transmis.
3. Aucun mouvement en attente ou à ventiler.

---

## 8. Suivi des révisions

| Version | Date | Auteur | Objet |
|---|---|---|---|
| 1.0 | Octobre 2026 | | Création |
