# Manuel de procédures — Comptabilité

**Objet** : fixer qui fait quoi, dans quel ordre et avec quelles vérifications pour tenir la comptabilité dans l'ERP, de l'écriture au brouillard jusqu'à la clôture de l'exercice et à l'export du FEC.
**Principe directeur** : une pièce n'est définitive qu'une fois **visée**. Une pièce visée ne se modifie ni ne se supprime : elle se **contre-passe**. Chaque exercice se clôture dans l'ordre, une seule fois, et se verrouille.

> Les libellés d'onglets et de boutons sont ceux du module **Comptabilité**. Le plan et les comptes cités sont des paramètres : les numéros réels dépendent de votre plan comptable (SYSCOHADA révisé) et des **Comptes par défaut**.
> **À faire valider par votre expert-comptable** : le traitement de la TVA sur les débours de titre foncier, le choix des comptes par défaut et le calendrier de clôture. Ce manuel décrit le fonctionnement de l'ERP, il ne se substitue pas à un avis comptable ou fiscal.

---

## 1. Rôles et responsabilités

| Rôle | Qui | Responsabilités principales |
|---|---|---|
| **Comptable** | Droit « saisie » du module Comptabilité | Saisit les écritures, ventile la caisse, lettre les tiers, rapproche la banque, immobilise |
| **Responsable comptable / valideur** | Droit « validation » avec plafond suffisant | Vise les écritures, contrôle les anomalies, supervise les états |
| **Administrateur** | admin | Clôture et rouvre l'exercice, lève un visa (dévalidation), paramètre le plan et les comptes par défaut |
| **Gérant (holding)** | Gérant désigné | Vise les pièces de caisse soumises au circuit de visas : sans ce visa, l'écriture reste au brouillard |
| **Direction** | dg, direction | Consulte les états, arbitre les écarts significatifs |

### Matrice RACI

R = réalise, A = approuve, C = consulté, I = informé.

| Procédure | Comptable | Responsable comptable | Administrateur | Direction |
|---|---|---|---|---|
| COM-01 Paramétrage | C | C | A/R | I |
| COM-02 Écritures automatiques | I | C | – | – |
| COM-03 Saisie manuelle | R | A | – | – |
| COM-04 Tiers et lettrage | R | A | – | – |
| COM-05 Rapprochement bancaire | R | A | – | I |
| COM-06 Immobilisations | R | A | – | – |
| COM-07 Contrôles mensuels | R | A | C | I |
| COM-08 Visa | C | A/R | C | – |
| COM-09 Contre-passation | R | A | – | – |
| COM-10 États financiers | R | A | C | I |
| COM-11 Clôture, COM-12 Réouverture | C | C | A/R | I |
| COM-13 Export FEC | R | A | C | – |

---

## 2. Règles d'or

1. **Une écriture est équilibrée** : total débit = total crédit, au moins une ligne au débit et une au crédit, deux lignes minimum.
2. **Seuls les comptes du plan comptable** sont imputables. Un compte de regroupement (parent) ne s'impute pas : imputer un sous-compte.
3. **Une pièce visée est intangible.** Toute correction passe par une contre-passation.
4. **Un exercice clos est verrouillé** : aucune écriture, modification ni suppression à une date de cet exercice.
5. **On clôture dans l'ordre**, exercice après exercice, pour que les à-nouveaux reprennent tous les soldes.
6. **Jamais de saisie en double** : un versement souscripteur se saisit dans Paiements, un encaissement espèces dans Paiements (le bon d'entrée de caisse est créé automatiquement), pas en comptabilité.
7. **Le FEC n'est valable que pour des pièces visées** : les pièces restées au brouillard sortent sans date de validation.

---

## 3. Calendrier de travail

| Fréquence | Qui | Action | Où |
|---|---|---|---|
| **Chaque jour** | Comptable | Ventiler les mouvements de caisse clôturés | Caisse › Ventilation |
| **Chaque semaine** | Comptable | Rapprocher la banque, lettrer les tiers | Rapprochement, Tiers |
| **Chaque mois** | Comptable puis responsable | Contrôles mensuels (COM-07), puis visa du mois (COM-08) | Balance, Grand livre, Visa |
| **Chaque trimestre** | Responsable | États périodiques, trésorerie, revue des écarts | États, Trésorerie |
| **Chaque année** | Administrateur | Clôture (COM-11), FEC (COM-13), liasse (COM-10) | Clôture et FEC |

---

## 4. Procédures

### COM-01 — Paramétrer la comptabilité

**Qui** : administrateur. **Où** : Paramètres › Plan comptable, Comptes par défaut, Société.

1. **Plan comptable** : vérifier que chaque compte utilisé existe. Créer les comptes manquants avant de les utiliser.
2. **Comptes par défaut** : renseigner, au minimum, les comptes qui alimentent les écritures automatiques.

| Famille | Exemples de paramètres |
|---|---|
| **Trésorerie** | Banque, caisse, Mobile Money, virement interne entre caisses (585) |
| **Clients** | Client lots (acquéreurs), client foncier |
| **Ventes** | Produit de vente des lots, produit des terrains, TVA collectée, produit des frais de souscription |
| **Fournisseurs et TVA** | Fournisseur, TVA déductible |
| **Paie** | Charges de personnel, personnel rémunérations dues, CNPS, ITS, charges patronales |
| **Caisse** | Écarts de caisse (excédent, manquant) |
| **Foncier** | Honoraires notaire, géomètre, droits d'enregistrement, frais d'actes |
| **Résiliation** | Dette de remboursement, produit de résiliation |

3. **Taux de TVA** : 18 % par défaut, modifiable.
4. **Bilan d'ouverture** : à la reprise d'une comptabilité en cours d'année ou au démarrage, saisir les soldes d'ouverture (onglet Bilan d'ouverture, COM-03 bis).

**[bloquant]** Un compte par défaut manquant interdit l'enregistrement de l'opération qui en dépend (versement, vente, résiliation, transfert de caisse). Le message nomme le paramètre à corriger.

### COM-02 — Contrôler les écritures automatiques

L'ERP génère des écritures sans saisie. Le comptable les **contrôle**, il ne les ressaisit pas.

| Opération | Écriture générée (comptes par défaut) | Journal |
|---|---|---|
| **Versement souscripteur** (apport, mensualité, régularisation) | D Trésorerie (banque, caisse souscripteurs ou Mobile Money selon le mode) — C Client lots | Banque, caisse ou Mobile Money |
| **Frais de souscription** | D Trésorerie — C Produit des frais de souscription | idem |
| **Vente d'un logement** (lot passé « vendu ») | D Client lots — C Produit de vente des lots, au prix du lot | Ventes |
| **Vente d'une parcelle** | D Client lots TTC — C Produit terrain HT — C TVA collectée si terrain viabilisé ; déstockage si le coût de revient est saisi | Ventes |
| **Mouvement de caisse** | Écriture au moment de la ventilation (CAI-07 du manuel Caisse) | Caisse |
| **Résiliation** | D Client lots — C Dette de remboursement et/ou Produit de retenue | Opérations diverses |
| **Immobilisation** | D Compte d'immobilisation — C 481 (à crédit) ou 512 (au comptant) | Opérations diverses |

**Contrôles**

- Une opération supprimée ou modifiée à la source **régénère** son écriture (même identifiant).
- Une écriture automatique à une date d'**exercice clos** est refusée : corriger la date à la source.
- Les frais de souscription ne réduisent pas le solde dû par le souscripteur : ils sont comptabilisés en produit.

### COM-03 — Saisir une écriture manuelle

**Qui** : comptable (droit de saisie). **Où** : onglet **Journal** › nouvelle écriture.

| Champ | Règle |
|---|---|
| **Date** | Obligatoire, sur un exercice **ouvert** |
| **Libellé** | Obligatoire |
| **Pièce** | Numéro de la pièce justificative |
| **Journal** | Automatique ou choisi : ventes, achats, banque, caisse, Mobile Money, paie, stocks, opérations diverses |
| **Lignes** | Compte du plan, sens (débit ou crédit), montant strictement positif, libellé facultatif. Deux lignes valides minimum |

L'ERP attribue une **référence** : JL-année-numéro de 5 chiffres. L'écriture est créée **au brouillard**.

**[bloquant]**

- Libellé ou date manquants, moins de deux lignes valides.
- Compte **inconnu** du plan : choisir une suggestion de la liste ou créer le compte au préalable.
- Compte de **regroupement** : imputer un sous-compte.
- Ligne débit ou ligne crédit absente.
- **Déséquilibre** supérieur ou égal à 1 FCFA.
- **Exercice clos** à la date saisie.
- Modification d'une pièce **visée**.

**COM-03 bis — Bilan d'ouverture** : saisir la date, la note et les soldes de reprise (comptes du plan). Un bilan déséquilibré demande confirmation : l'écart est porté par le compte de liaison 890. Impossible sur un exercice clos.

### COM-04 — Tiers et lettrage

**Où** : onglet **Tiers** (acquéreurs 4111, clients 411, fournisseurs 401, personnel 422, autres tiers 461).

1. Vérifier que chaque écriture de tiers porte son **tiers auxiliaire**. Le lettrage et le FEC en ont besoin.
2. Lancer le **lettrage automatique** de l'exercice : il lettre les correspondances **exactes 1 pour 1** entre un débit et un crédit du même tiers, et les **reliquats de solde nul** (un tiers globalement soldé reçoit une seule lettre).
3. Consulter les **postes ouverts** (non lettrés) : par tiers, nombre de lignes, dernier mouvement, solde ouvert. Le total des soldes débiteurs est le montant à recouvrer, celui des soldes créditeurs le montant à payer.
4. Le **délettrage** retire toutes les lettres de l'exercice, sans modifier les écritures.

**Contrôle** : les postes ouverts doivent s'expliquer (échéance en cours, litige connu). Un poste ancien sans explication est une anomalie.

### COM-05 — Rapprochement bancaire

**Qui** : comptable. **Où** : onglet **Rapprochement**.

1. Choisir le **compte de banque** et la **période**.
2. Comparer, côte à côte, les **écritures du compte de banque** et les **lignes du relevé**.
3. **Pointer** chaque écriture retrouvée sur le relevé (case à cocher). Les lignes pointées passent en « rapproché ».
4. Expliquer les **écritures non rapprochées** (chèque en circulation, virement non encore passé) et les lignes de relevé sans écriture (frais bancaires, encaissement non saisi).
5. Comparer les totaux débits et crédits des deux côtés.

**Fréquence** : chaque semaine pour les comptes actifs, au minimum chaque mois.

### COM-06 — Immobilisations et amortissements

**Qui** : comptable. **Où** : onglet **Amortissements**.

1. **Enregistrer un bien** : désignation, valeur d'origine, date de début, durée (25 ans par défaut, personnalisable), méthode (linéaire par défaut), valeur résiduelle, division.
2. Choisir le **compte d'immobilisation** et le **compte d'amortissement**.
3. Choisir la **contrepartie** : 481 si le bien est acquis à crédit, 512 s'il est payé comptant. L'ERP génère l'écriture d'acquisition.
4. **Dotations de l'exercice** : consulter l'annuité, l'amortissement cumulé et la valeur nette comptable de chaque bien. L'export CSV fournit le tableau.

**[bloquant]** Date d'acquisition sur un exercice clos : le bien est créé mais l'écriture est refusée ; corriger la date.

### COM-07 — Contrôles mensuels

À faire **avant** le visa du mois.

| Contrôle | Où | Ce qu'on vérifie |
|---|---|---|
| **Balance** | Balance | Équilibre général (total des débits = total des crédits) ; diagnostic des écarts |
| **Grand livre** | Grand livre | Détail des mouvements d'un compte sensible (clients, banque, caisse, TVA) |
| **Brouillards de caisse** | Brouillards | Chaque caisse du mois est clôturée, ventilée, et ses écarts sont expliqués |
| **Trésorerie** | Trésorerie | Soldes banque, caisse, Mobile Money cohérents avec les relevés et les comptages |
| **Tiers** | Tiers | Postes ouverts expliqués |
| **Comptes hors plan** | Balance ou alertes | Aucun compte inconnu du plan |
| **Audit** | Audit IA | Anomalies relevées à examiner (aide à la revue, non décisionnelle) |

#### Contrôles des écritures (bouton 🔎 Contrôles)

**Où** : Comptabilité › Écritures › **🔎 Contrôles**. À lancer avant le visa du mois. Quatre onglets :

| Onglet | Ce qu'il repère | Action |
|---|---|---|
| **Dates** | Date absente, illisible, impossible, année improbable, datée du futur, ou avec une heure | Corriger ou normaliser la date ; les dotations et écritures prévues datées du futur sont signalées à part |
| **Doublons** | Plusieurs écritures de même date, compte, montant et libellé | Annuler le doublon par contre-passation (COM-09) |
| **Extournes de commissions** | Extournes non synchronisées avec le cloud | Régulariser (synchronisation) ; l'extourne n'est pas à recréer |
| **Comptes de TVA** | Comptes de TVA par défaut manquants ou ambigus (le plan interne appelle 443 la TVA facturée, 444 la TVA récupérable, 445 la TVA à décaisser) | Choisir le bon compte dans les paramètres : l'ERP ne convertit rien automatiquement |

Aucune correction n'est automatique : chaque ligne se traite après vérification, et une pièce visée se corrige par contre-passation.

### COM-08 — Viser les écritures

**Qui** : valideur (droit de validation du module Comptabilité, plafond couvrant la plus forte pièce du périmètre). **Où** : **Visa des écritures**.

1. Choisir le **périmètre** : année, journal, division.
2. L'ERP contrôle chaque pièce non visée. Une pièce est **bloquante** si :
   - une ligne n'a pas de compte ;
   - un compte est un compte de regroupement ;
   - l'écriture est déséquilibrée ;
   - la pièce vient d'un bon de caisse du circuit de visas et le **visa du Gérant** manque.
3. Corriger les anomalies (onglet **Anomalies**), puis relancer.
4. Confirmer : les pièces visables deviennent **définitives**, avec date et auteur du visa.

**Dévalidation (exceptionnelle)** : réservée à l'administrateur, **motif obligatoire**, tracée dans l'historique de la pièce. Elle remet les pièces du périmètre au brouillard.

### COM-09 — Corriger une pièce visée : la contre-passation

**Qui** : comptable (droit de saisie). **Où** : écriture visée › **Contre-passer**.

1. Saisir la **date** de la contre-passation. Si la date du jour tombe sur un exercice clos, l'ERP propose le 1er janvier de l'exercice suivant.
2. Saisir le **motif**.
3. L'ERP génère l'**écriture inverse** (débits et crédits échangés), numérotée CP-référence, et la relie à la pièce d'origine dans les deux sens.
4. Saisir ensuite la **bonne écriture**.

**[bloquant]** Date sur un exercice clos, pièce déjà contre-passée.

### COM-10 — États financiers et liasse

| État | Contenu |
|---|---|
| **Bilan** | Actif et passif de l'exercice |
| **Compte de résultat** | Charges et produits |
| **Trésorerie** | Situation et prévisions |
| **Analytique** | Ventilation par programme et par division |
| **Intragroupe** | Flux inter-divisions et conventions réglementées (dossier du commissaire aux comptes) |
| **États périodiques** | États sur période libre |
| **Liasse fiscale** | Fiche d'identification, bilan, compte de résultat, tableau des flux de trésorerie, notes annexes, états supplémentaires DGI |

**Avant d'éditer les états de fin d'année** : toutes les pièces de l'exercice sont visées, les rapprochements et le lettrage sont faits, les amortissements sont comptabilisés.

### COM-11 — Clôturer l'exercice

**Qui** : administrateur (droit de validation du module). **Où** : **Clôture et FEC**.

**Prérequis**

1. **Toutes les pièces de caisse** de l'exercice ont reçu le visa du Gérant, le cas échéant.
2. L'exercice précédent est **déjà clôturé** (ou couvert par un bilan d'ouverture). Sinon l'ERP avertit : les à-nouveaux ne reprendraient pas les soldes antérieurs.
3. Le visa des écritures est fait et les contrôles mensuels sont terminés.

**Déroulement**

1. Choisir l'**année** et, si besoin, la **division** (clôture par entité) ou « toutes divisions » (consolidé).
2. Confirmer **deux fois**.
3. L'ERP :
   - solde chaque compte de gestion (classes 6 et 7) mouvementé ;
   - détermine le **résultat** : compte 131 si bénéfice, 139 si perte ;
   - génère l'**écriture de clôture** au 31 décembre (journal CLO) ;
   - génère les **à-nouveaux** au 1er janvier suivant (journal AN), un par compte de bilan mouvementé, en contrepartie du compte 890 ;
   - **verrouille** l'exercice.

**[bloquant]** Réservé à l'administrateur. Aucun mouvement de gestion sur l'exercice : clôture refusée. Pièces de caisse sans visa du Gérant : clôture refusée.

### COM-12 — Rouvrir un exercice

**Qui** : administrateur. Opération **exceptionnelle**.

1. Confirmer. L'ERP **supprime** l'écriture de clôture et les à-nouveaux du périmètre et lève le verrou.
2. Passer les corrections nécessaires.
3. **Clôturer de nouveau** sans attendre, pour reconstituer les à-nouveaux.

À éviter dès que des états ont été remis à un tiers : préférer une contre-passation sur l'exercice ouvert.

### COM-13 — Exporter le FEC

**Où** : **Clôture et FEC** › **Exporter le FEC**.

1. Choisir l'année (et la division).
2. L'ERP produit un fichier texte à séparateur `|` : journal, numéro d'écriture, date, compte et libellé, tiers auxiliaire, pièce, libellé, débit, crédit, lettrage, **date de validation**, une ligne par ligne comptable. Nom du fichier : identifiant fiscal, FEC, année.
3. **Vérifier** avant remise : toutes les pièces sont visées. Une pièce au brouillard sort **sans date de validation**, ce qui la rend rejetable en contrôle.

---

## 5. Contrôles et blocages

| Contrôle | Effet |
|---|---|
| Écriture déséquilibrée | Enregistrement refusé |
| Compte inconnu du plan | Enregistrement refusé |
| Compte de regroupement | Enregistrement refusé |
| Date sur un exercice clos | Création, modification et suppression refusées |
| Pièce visée | Modification et suppression refusées ; contre-passation seule |
| Compte par défaut manquant | Opération automatique refusée, paramètre nommé |
| Visa : ligne sans compte, compte parent, déséquilibre, visa du Gérant manquant | Pièce non visable |
| Visa : plafond insuffisant | Visa refusé |
| Dévalidation, clôture, réouverture | Administrateur uniquement |
| Clôture avec pièces de caisse sans visa du Gérant | Clôture refusée |
| Clôture sans exercice précédent clôturé ni bilan d'ouverture | Avertissement, confirmation demandée |

---

## 6. Traçabilité

| Événement | Où il est conservé |
|---|---|
| Création et modification d'une écriture | Écriture (référence, dates), journal d'actions |
| Visa | Écriture (date et auteur du visa), journal d'actions |
| Dévalidation | Historique de la pièce (date, auteur, motif, visa levé) |
| Contre-passation | Écriture inverse CP, lien dans les deux sens, journal d'actions |
| Lettrage et délettrage | Lettre sur la ligne d'écriture |
| Clôture et à-nouveaux | Écritures CLO et AN, verrou de l'exercice |
| Export FEC | Fichier remis, avec les dates de validation des pièces |

---

## 7. Erreurs fréquentes

| Symptôme | Cause probable | Action |
|---|---|---|
| « Écriture déséquilibrée » | Montants débit et crédit différents | Corriger les lignes |
| « Compte inconnu du plan » | Faute de frappe ou compte non créé | Choisir une suggestion ou créer le compte |
| « Compte de regroupement non imputable » | Compte parent saisi | Imputer un sous-compte |
| « Exercice clôturé » | Date sur un exercice verrouillé | Choisir une date sur un exercice ouvert, ou rouvrir (exceptionnel) |
| « Écriture validée — modification interdite » | Pièce visée | Contre-passer, puis ressaisir |
| Versement non enregistré, « paramétrage comptable manquant » | Compte par défaut absent | Renseigner le compte nommé |
| Pièce non visable | Compte absent, parent, déséquilibre ou visa du Gérant manquant | Corriger dans l'onglet Anomalies |
| Clôture refusée | Pièces de caisse sans visa du Gérant | Faire viser les pièces |
| À-nouveaux incomplets | Exercice intermédiaire jamais clôturé | Clôturer l'exercice sauté, ou saisir un bilan d'ouverture |
| Balance déséquilibrée | Écriture ancienne ou importée incohérente | Utiliser le diagnostic de la balance, corriger par contre-passation |
| FEC rejeté en contrôle | Pièces au brouillard | Viser les pièces avant l'export |

---

## 8. Liste de contrôle

**Fin de mois**

1. Caisses clôturées et ventilées, écarts expliqués.
2. Banque rapprochée, tiers lettrés, postes ouverts expliqués.
3. Balance équilibrée, aucun compte hors plan.
4. Écritures du mois visées.

**Fin d'exercice**

1. Toutes les pièces de l'exercice visées, y compris le visa du Gérant sur la caisse.
2. Amortissements de l'exercice comptabilisés.
3. Rapprochements bancaires et lettrage terminés.
4. États financiers et liasse vérifiés avec l'expert-comptable.
5. Exercice clôturé, à-nouveaux générés, résultat contrôlé.
6. FEC exporté et conservé.
7. Sauvegarde des données effectuée.

---

## 9. Suivi des révisions

| Version | Date | Auteur | Objet |
|---|---|---|---|
| 1.0 | Octobre 2026 | | Création |
| 1.1 | Octobre 2026 | | Contrôles des écritures (dates, doublons, extournes de commissions, comptes de TVA par défaut) |
