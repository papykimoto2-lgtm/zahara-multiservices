# Manuel de procédures — Enregistrement d'un souscripteur

**Objet** : fixer qui fait quoi, dans quel ordre et avec quelles vérifications pour enregistrer un souscripteur, de la fiche d'identité au premier versement et à la remise de son accès portail.
**Principe directeur** : un souscripteur = un dossier, un code (SS001, SS002…), un échéancier et un ou plusieurs lots selon sa nature. Aucun lot n'est réservé deux fois. Chaque création et chaque modification est journalisée.

> Les noms de champs et de boutons sont ceux de l'ERP : module **Souscripteurs**, bouton de création, puis module **Paiements** pour les versements.

---

## 1. Avant de commencer

| Prérequis | Pourquoi |
|---|---|
| Le **programme** et ses **lots** existent, avec leur nature (terrain ou logement), prix, surface, îlot | Le prix, la surface, l'îlot et la nature sont repris du lot |
| Le lot choisi est **disponible** | Un lot déjà rattaché à un autre souscripteur est refusé à l'enregistrement |
| Un **commercial** ou un **apporteur d'affaires** est identifié | L'un des deux est obligatoire |
| Les **comptes par défaut** et le compte « produit des frais de souscription » sont paramétrés | Sans eux, aucun versement ne peut être enregistré |
| Une **caisse** est ouverte si le premier versement est en espèces | Le bon d'entrée en caisse est créé automatiquement |
| Pièce d'identité, numéro de téléphone du souscripteur | Identification et contact |

---

## 2. Règles d'or

1. **Un lot, un souscripteur.** Un lot déjà rattaché ailleurs est refusé.
2. **Logement : un seul lot par souscription.** Pour un deuxième logement, créer une autre souscription.
3. **Terrain : plusieurs lots possibles** dans une même souscription, avec un seul montant total et un seul échéancier.
4. **Un lot supplémentaire n'est pas un terrain supplémentaire.** Un autre lot est une autre entité cadastrale et donc une autre souscription. Un terrain supplémentaire acquis après coup se facture sur la fiche (voir le manuel de l'attestation de solde).
5. **Commercial ou apporteur obligatoire.** Sans l'un des deux, l'enregistrement est refusé.
6. **Un souscripteur ayant des versements ou des conventions ne se supprime pas** : l'ERP bloque la suppression d'un élément référencé ailleurs. On le résilie, la trace est conservée.

---

## 3. Procédures

### SOU-01 — Ouvrir la fiche et choisir le bien

**Qui** : commercial, agent habilité du module Souscripteurs.

1. Ouvrir le module **Souscripteurs** et cliquer sur le bouton de création.
2. Choisir le **programme**, puis le **lot** dans la liste.
3. À la sélection du lot, l'ERP reprend automatiquement : montant total, type de logement, surface, îlot, numéro de titre foncier, mode de livraison et standing. Tout reste modifiable.
4. Contrôler la **nature du bien** (badge sous le lot) :

    - **Terrain nu** : le bloc « Autres lots » est proposé ; le mode de livraison et le standing sont masqués.
    - **Maison / logement** : le bloc « Autres lots » est masqué.
    - En cas de nature incorrecte, la forcer avec le champ **Nature du bien**. Le choix manuel prime sur la nature du lot.
5. **Terrain avec plusieurs lots** : ajouter chaque lot avec le bouton d'ajout. Le montant total et la surface sont majorés du prix et de la surface du lot ajouté ; ajuster si besoin.

**[bloquant]** Un lot déjà rattaché à un autre souscripteur est refusé. Un logement ne peut pas recevoir de lot supplémentaire.

### SOU-02 — Renseigner l'identité

**Champs obligatoires** : nom et téléphone.

| Champ | Règle |
|---|---|
| **Nom, prénoms** | Nom obligatoire |
| **Date de naissance, nationalité, profession, employeur, adresse** | À renseigner pour un dossier complet |
| **Pièce d'identité** (type et numéro) | Reprise sur les attestations remises au notaire |
| **Situation matrimoniale** | Si « marié », les informations du conjoint sont demandées |
| **Téléphone 1** | 10 chiffres pour un numéro ivoirien (ex. 07 12 34 56 78), ou + et l'indicatif pays pour un numéro étranger. Le format ancien à 8 chiffres est refusé |
| **Téléphone 2** | Facultatif ; doit être différent du téléphone 1 |
| **E-mail** | Facultatif ; sert à l'envoi de l'accès portail |

**Astuce** : saisir « numéro A / numéro B » dans le champ 1 place automatiquement le second numéro dans le champ 2.

**[bloquant]** Nom ou téléphone manquant, téléphone invalide ou numéros identiques.

### SOU-03 — Cas particuliers : famille, groupe, mineur

**Souscription de famille ou de groupe (co-souscripteurs)**

1. Ajouter chaque co-souscripteur avec nom, prénoms et, si connu, date de naissance.
2. Renseigner la **part** de chacun, en pourcentage.

**[bloquant]** Nom ou prénoms manquants, date de naissance dans le futur, part hors de 0 à 100 %, somme des parts supérieure à 100 %.

**Souscription pour un mineur (via un représentant légal)**

1. Cocher « souscription pour un mineur » et saisir le nom, les prénoms et la **date de naissance** du bénéficiaire. La date sert à calculer la majorité.
2. Indiquer le **lien** du souscripteur avec le mineur (père, mère, tuteur…).
3. Indiquer le **justificatif** de la qualité de représentant légal.

**[bloquant]** Date de naissance absente ou dans le futur, lien ou justificatif manquant, bénéficiaire déjà majeur (décocher la case ou corriger la date).

### SOU-04 — Fixer les conditions financières

| Champ | Règle |
|---|---|
| **Montant total** | Repris du lot ; ajusté avec les lots ajoutés. C'est la seule référence de ce qui est dû |
| **Apport** | Premier versement attendu |
| **Durée** (mois) | 60 par défaut |
| **Date de début** | Point de départ de l'échéancier |
| **Date de souscription** | Date de signature |

L'ERP calcule la mensualité à partir du montant total, de l'apport et de la durée, et affiche l'échéancier.

### SOU-05 — Rattacher le commercial ou l'apporteur

1. Choisir un **commercial** (employé) ou un **apporteur d'affaires**.
2. Les commissions suivent ensuite automatiquement les versements.

**[bloquant]** Aucun des deux renseigné : l'enregistrement est refusé et les deux champs sont mis en évidence.

### SOU-06 — Dossier villa / foncier (champs administratifs)

À renseigner selon le cas : numéro de dossier DM, numéro de titre foncier, îlot, superficie réelle, superficie supplémentaire (la superficie totale se calcule seule), coût de la villa, mode d'acquisition, modification demandée.

**Contrôle de surface** : si la surface saisie diffère de la surface réelle des lots rattachés, un message indique l'écart. Il n'est jamais bloquant. Un écart défavorable au souscripteur peut être facturé après coup (régularisation de surface).

### SOU-07 — Consentement sur les données personnelles

1. Informer le souscripteur de l'utilisation de ses données (notice de confidentialité remise ou consultable sur le portail).
2. Cocher la case de consentement. La date et l'auteur sont enregistrés et ne sont **jamais écrasés** par un simple ré-enregistrement.

### SOU-08 — Enregistrer

1. Cliquer sur **Enregistrer**. Un second clic accidentel est sans effet.
2. L'ERP :

    - attribue le **code dossier** (SS001, SS002…) ;
   - **rattache** le ou les lots au souscripteur ;
    - met le lot en **réservé** ;
    - journalise la création (audit) ;
    - propose aussitôt les documents du souscripteur.

**Statut du lot** : réservé jusqu'au **seuil d'immobilisation**, vendu au-delà. Le seuil est un paramètre (70 % du montant total par défaut). Au passage à « vendu », la vente du lot est comptabilisée, lot par lot.

**Avertissements à la création** : avant d'enregistrer un **nouveau** souscripteur, l'ERP signale (sans bloquer) : un téléphone déjà utilisé par une autre fiche, un souscripteur de même nom, l'absence de lot, un lot sans prix, un montant total nul. Lire la liste puis choisir *Enregistrer quand même* ou revenir à la fiche. Un téléphone partagé peut être légitime (famille, agence). Un **nom identique est normal** lorsqu'un même client prend plusieurs appartements (une souscription par logement, chacune avec son lot et son échéancier) : dans ce cas créer une nouvelle souscription ; sinon, vérifier qu'il ne s'agit pas d'un doublon. Les anomalies existantes se retrouvent dans Commercialisation › **🔎 Contrôles Ventes** (PRO-PRG).

### SOU-09 — Imprimer les documents de souscription

Après la création, la fenêtre des documents propose :

| Document | Usage |
|---|---|
| **Fiche de souscription** | Identité et conditions du dossier |
| **Engagement ferme et irrévocable d'acquisition** | À faire signer par le souscripteur |
| **Imprimer les deux documents** | Impression groupée |

Faire signer les deux documents, puis les classer dans le dossier physique et numérique.

### SOU-10 — Enregistrer le premier versement

**Qui** : comptabilité, caisse ou agent habilité du module **Paiements**. **Où** : **Enregistrer un versement**.

| Champ | Règle |
|---|---|
| **Souscripteur** | Obligatoire ; le solde du dossier s'affiche |
| **Date** | Obligatoire, année entre 2000 et l'année suivante |
| **Type** | Frais de souscription, apport initial, mensualité, régularisation, autre |
| **Montant** | Obligatoire |
| **Mode** | Espèces, virement, chèque, Mobile Money |
| **Caisse** | **Obligatoire en espèces** : un bon d'entrée est créé dans la caisse choisie |
| **Référence** | N° de chèque, de virement ou de transaction |
| **Mois concerné, notes** | Facultatifs |

**À savoir**

- Les **frais de souscription** ne sont pas imputés sur le prix du bien (non remboursables). Ils sont comptabilisés en produit et n'entrent pas dans le calcul du solde.
- L'apport, les mensualités et les régularisations s'imputent sur le prix.
- Chaque versement génère l'écriture comptable (brouillard) et impacte les commissions.
- Remettre un **reçu de versement** au souscripteur. Il mentionne programme, îlot et lot(s).

**[bloquant]**

- Compte comptable par défaut manquant : rien n'est enregistré, le message nomme le paramètre à corriger.
- Souscripteur **gelé** (mesure de gel SFC) : tout versement est interdit.
- Date invalide, caisse absente en espèces, session de caisse indisponible pour la date.
- **Versement similaire** déjà enregistré (même client, même montant, à 2 jours près) ou mouvement de caisse équivalent : l'ERP demande de confirmer qu'il s'agit bien d'un paiement différent.

### SOU-11 — Remettre l'accès au portail souscripteur

**Qui** : administrateur, gérant ou commercial. **Où** : suivi des souscripteurs, onglet **Accès portail**.

1. Vérifier que le souscripteur a un **téléphone ou un e-mail**.
2. Lancer l'envoi : l'ERP crée un **code personnel à 6 chiffres**, conservé chiffré, et prépare un message contenant le lien, l'**identifiant** (le code dossier) et le **code d'accès**.
3. Envoyer le message (WhatsApp ou e-mail). Le code n'est affiché qu'une seule fois.
4. Le souscripteur ouvre le lien, choisit « Espace souscripteur » et saisit son identifiant et son code.

Le souscripteur y suit ses paiements, ses documents et ses échéances.

### SOU-12 — Modifier un souscripteur

1. Ouvrir la fiche, modifier, enregistrer.
2. La modification **ne perd aucune donnée** hors formulaire (code d'accès portail, statistiques de connexion, attestations).
3. Le **code dossier** ne change jamais.
4. Un souscripteur **résilié** reste résilié, même si on modifie un champ.
5. Si la fiche a été modifiée ailleurs entre-temps, un message de conflit l'indique : recharger avant de modifier.
6. Retirer un lot de la liste le **libère** (retour à « disponible »).

Chaque modification est journalisée avec l'avant et l'après.

### SOU-13 — Résilier un souscripteur

À utiliser quand le souscripteur renonce ou ne peut plus payer. Le **droit de validation** du module Souscripteurs est requis.

1. Choisir le **motif** de résiliation. Chaque motif définit un taux de remboursement indicatif, une retenue minimale, le sort des commissions et la libération des lots.
2. Saisir la **justification** et, si nécessaire, ajuster le taux.
3. L'ERP :

    - **libère** les lots si le motif le prévoit ;
    - passe en écriture le **remboursement** (dette envers le souscripteur) et la **retenue** (produit) ;
    - annule les commissions non payées et marque à récupérer celles déjà payées, selon la règle du motif ;
    - met le statut du souscripteur à **résilié**.
4. Le dossier n'est **jamais supprimé** : la résiliation et tout son détail restent consultables.

**Prérequis** : les comptes « dette de remboursement à la résiliation » et « produit de résiliation » sont paramétrés.

---

## 4. Contrôles et blocages

| Contrôle | Effet |
|---|---|
| Nom ou téléphone manquant | Enregistrement refusé |
| Téléphone invalide (format ivoirien ou international) | Refusé |
| Téléphones 1 et 2 identiques | Refusé |
| Ni commercial ni apporteur | Refusé |
| Lot déjà rattaché à un autre souscripteur | Refusé |
| Deuxième lot sur un logement | Refusé (ancien dossier multi-lots : retrait possible, pas d'ajout) |
| Co-souscripteurs : parts incohérentes | Refusé |
| Mineur : informations ou justificatif manquants, ou majeur | Refusé |
| Versement : compte comptable manquant, client gelé, date invalide, caisse absente | Versement non enregistré |
| Versement similaire déjà présent | Confirmation demandée |
| Création : téléphone ou nom déjà connu, aucun lot, lot sans prix, montant nul | Avertissement, confirmation demandée |

---

## 5. Traçabilité

| Événement | Où il est conservé |
|---|---|
| Création et modifications de la fiche | Journal d'audit (avant et après) |
| Consentement données personnelles | Fiche (date, auteur) |
| Changements de statut du lot | Historique du lot (date, ancien et nouveau statut, auteur) |
| Versements créés ou modifiés | Journal d'audit et écriture comptable |
| Résiliation | Fiche (détail complet) et journal d'audit |

---

## 6. Matrice RACI

R = réalise, A = approuve, C = consulté, I = informé.

| Procédure | Commercial | Comptabilité / caisse | Direction | Souscripteur |
|---|---|---|---|---|
| SOU-01 à 08 Création de la fiche | R | I | A | C |
| SOU-09 Documents signés | R | I | I | R (signature) |
| SOU-10 Premier versement | C | R | I | R (paiement) |
| SOU-11 Accès portail | R | I | A | R (connexion) |
| SOU-12 Modification | R | C | I | C |
| SOU-13 Résiliation | C | R | A | C |

---

## 7. Erreurs fréquentes

| Symptôme | Cause probable | Action |
|---|---|---|
| « Assignez un commercial OU un apporteur » | Aucun des deux choisi | Choisir l'un des deux |
| « Lot déjà rattaché à… » | Lot pris par un autre souscripteur | Choisir un autre lot ou libérer le lot d'abord |
| Impossible d'ajouter un second lot | Souscription au logement | Créer une autre souscription |
| Téléphone refusé | 8 chiffres, caractères parasites ou numéro répété | Saisir 10 chiffres, ou + et l'indicatif |
| « Versement NON enregistré : paramétrage comptable manquant » | Compte par défaut non configuré | Paramétrer le compte nommé dans le message |
| Le lot reste « réservé » alors que le client a payé | Seuil d'immobilisation non atteint | Vérifier le seuil (70 % par défaut) et le total versé sur le prix |
| Les frais de souscription ne réduisent pas le solde | Comportement normal : hors prix du bien | Aucune action |
| Le souscripteur ne peut pas se connecter au portail | Code non remis ou saisi avec une faute | Regénérer l'accès dans le suivi des souscripteurs |
| Message de conflit à l'enregistrement | Fiche modifiée sur un autre poste | Recharger la fiche puis refaire la modification |

---

## 8. Liste de contrôle de fin d'enregistrement

1. Identité complète, téléphone valide, pièce d'identité renseignée.
2. Nature du bien correcte ; un seul lot si logement.
3. Montant total, apport, durée et dates conformes au contrat.
4. Commercial ou apporteur renseigné.
5. Consentement sur les données personnelles coché.
6. Fiche de souscription et engagement imprimés et signés.
7. Premier versement enregistré, reçu remis.
8. Accès portail remis.
9. Dossier physique classé sous le code SS.

---

## 9. Suivi des révisions

| Version | Date | Auteur | Objet |
|---|---|---|---|
| 1.0 | Octobre 2026 | | Création |
| 1.1 | Octobre 2026 | | Avertissements à la création (doublon téléphone/nom, lot manquant ou sans prix, montant nul) |
