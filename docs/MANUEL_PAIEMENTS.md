# Manuel de procédures — Paiements et échéanciers

**Réf.** PRO-PAI · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi, dans quel ordre et avec quelle preuve pour encaisser, contrôler et corriger les versements des souscripteurs.
**Principe directeur** : un versement n'existe que s'il a un reçu, une écriture comptable et, en espèces, un bon d'entrée en caisse. Aucun solde ne se saisit à la main.

> Les noms de boutons sont ceux du module **Paiements & Échéanciers** de l'ERP.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Comptabilité / caisse** | Enregistre les versements, remet les reçus, rapproche Mobile Money et paiements en ligne |
| **Commercial** | Génère les liens de paiement, suit les échéanciers de ses souscripteurs |
| **Comptable** | Contrôle les écritures, traite les doublons, contre-passe les pièces visées |
| **Direction / administrateur** | Droit de suppression (module Paiements), paramètres de comptes et de paiement en ligne |

## 2. Règles d'or

1. Un versement s'impute **sur le prix** sauf le type « Frais de souscription » (non remboursable, comptabilisé en produit).
2. **Espèces** : la caisse qui reçoit est obligatoire ; un bon d'entrée est créé automatiquement.
3. Une écriture **visée** ou d'un **exercice clos** verrouille le versement : seule la contre-passation corrige.
4. Un souscripteur **gelé** (mesure SFC) ne peut recevoir aucun versement.
5. Jamais de ressaisie d'un paiement déjà présent en caisse ou en historique importé.

## 3. Procédures

### PAI-01 — Enregistrer un versement

**Qui** : comptabilité, caisse. **Où** : **+ Enregistrer un versement**.

| Champ | Règle |
|---|---|
| **Souscripteur** | Obligatoire ; le solde du dossier s'affiche |
| **Date** | Obligatoire ; année entre 2000 et l'année suivante |
| **Type** | Obligatoire : frais de souscription, apport, mensualité, régularisation, autre |
| **Montant** | Obligatoire, supérieur à zéro |
| **Mode** | Espèces, virement, chèque, Mobile Money |
| **Caisse** | Obligatoire en espèces |
| **Référence** | N° de chèque, virement ou transaction |
| **Objet, mois, notes** | Facultatifs ; objet par défaut « Valeur initiale logement » |

1. Remplir et enregistrer. La référence **VRS-AAAA-NNNN** est attribuée automatiquement.
2. L'ERP génère l'**écriture comptable** (débit trésorerie, crédit client lots ; crédit produit pour les frais).
3. En espèces : **bon d'entrée** dans la caisse choisie.
4. Les **commissions** du versement sont générées ; le statut du lot passe à « vendu » au seuil d'immobilisation.
5. Une attestation de solde en brouillon est créée si le souscripteur est soldé.
6. Remettre le **reçu** (programme, îlot, lot) au souscripteur.

**[bloquant]** Souscripteur, montant, date ou type absents ; date invalide ; souscripteur gelé ; compte comptable par défaut manquant (le message nomme le paramètre) ; caisse absente en espèces ; session de caisse indisponible à la date.

**[confirmation]** Frais de souscription supérieurs aux frais prévus (ou 5 % du contrat) ; versement similaire (même client, même montant, ±2 jours) ; mouvement de caisse équivalent au même nom.

### PAI-02 — Corriger un versement

**Où** : ligne du versement › modifier.

1. Modifier client, date, type, montant, mode, référence, mois, notes.
2. L'ERP **réimpacte** les commissions et réécrit l'écriture comptable.
3. Passage en espèces : choisir la caisse pour créer le bon ; sortie des espèces : le bon est supprimé.

**[bloquant]** Bon de caisse d'une session **clôturée** (montant, mode et client figés : régulariser par un bon en caisse) ; écriture **visée** ou exercice **clos** (contre-passer dans Comptabilité › Journal, puis saisir le versement correct).

### PAI-03 — Supprimer un versement

**Qui** : droit de **suppression** du module Paiements. **Où** : ligne du versement › supprimer.

1. Vérifier l'absence de bon de caisse en session clôturée et d'écriture visée.
2. Confirmer. L'ERP supprime : l'écriture, le bon de caisse rattaché, les commissions non payées.
3. Une commission **déjà payée** reste : à traiter manuellement.
4. Un paiement en ligne lié est **rouvert** pour permettre un nouveau rapprochement.

**[bloquant]** Droit absent ; session de caisse clôturée ; écriture visée ou exercice clos.

### PAI-04 — Suivre l'échéancier

**Où** : onglet **Échéanciers** › choisir le souscripteur.

1. Lire montant total, apport, mensualité, versé, reste.
2. Contrôler chaque mois : montant attendu, montant versé, statut.
3. La mensualité = (montant total − apport) ÷ durée.

### PAI-05 — Appels de fonds VEFA

**Qui** : direction, commercial. **Où** : onglet **Appels VEFA**.

1. Choisir le **programme**.
2. Régler la **grille de jalons** (réservation, fondations, hors d'eau, hors d'air, achèvement, livraison) : avancement et pourcentage cumulé exigible.
3. Saisir l'**avancement** des travaux, ou le calculer depuis les situations payées.
4. Lire par souscripteur : prix, exigible, encaissé, **à appeler**.
5. **Imprimer** l'état et appeler les fonds.

Le montant exigible suit l'avancement physique : un appel n'est dû que pour la part du prix correspondant au jalon atteint.

### PAI-06 — Encaisser du Mobile Money

**Où** : onglet **Mobile Money**.

1. Choisir l'**opérateur**.
2. Coller le relevé : une ligne par opération, `date ; téléphone ; nom ; montant ; référence`.
3. L'ERP **rapproche** chaque ligne par téléphone (8 derniers chiffres) puis par nom.
4. Corriger à la main les lignes « à rapprocher ».
5. **Encaisser** ligne par ligne, ou **Encaisser tous** les rapprochés.

**Contrôles** : une référence déjà encaissée est marquée « faite » et refusée ; chaque encaissement crée versement (type mensualité), écriture et commissions.

### PAI-07 — Paiement en ligne

**Où** : onglet **Paiement en ligne**. **Prérequis** : Supabase configuré (Paramètres › Cloud) ; compte de trésorerie et frais de passerelle paramétrés.

1. Choisir le souscripteur, le **type**, le **montant** (100 F minimum), une description.
2. **Générer le lien** : la passerelle renvoie un lien et un numéro de transaction.
3. Envoyer le lien au souscripteur (WhatsApp, e-mail).
4. L'ERP interroge régulièrement la passerelle ; un paiement **réussi** est rapproché : versement (mode Mobile Money, référence = n° de transaction), écriture, commissions, frais de passerelle si à la charge du promoteur.
5. Vérifier un paiement en attente avec **Vérifier**.

**Cas particuliers** : un paiement **diaspora** entre au passif (séquestre), jamais en produit ; un **loyer** payé depuis le portail locataire s'impute sur la quittance.

### PAI-08 — Auditer et corriger les doublons

**Qui** : comptable. **Où** : onglet **Audit doublons**.

1. Un doublon = même souscripteur, même date, même montant, même type. Les groupes contenant un versement **importé** passent en priorité.
2. Examiner chaque groupe : conserver un versement, cocher les autres.
3. **Supprimer la sélection** : une seule confirmation globale, puis suppression ligne par ligne (règles de PAI-03).

Des mensualités identiques à des dates différentes ne sont **pas** des doublons.

### PAI-09 — Rattraper les écritures manquantes

**Qui** : comptable. **Où** : boutons de l'en-tête.

| Bouton | Effet |
|---|---|
| 🧾 Générer écritures manquantes | Écritures des versements saisis sans écriture |
| 🗺️ Comptabiliser ventes terrains | Ventes de parcelles sans écriture |
| 🏠 Comptabiliser ventes logements | Ventes de logements sans écriture |

À lancer après import ou incident, puis contrôler le journal.

## 4. Contrôles et blocages

| Contrôle | Effet |
|---|---|
| Date hors 2000 – année suivante | Refusé |
| Souscripteur gelé | Refusé |
| Compte comptable par défaut absent | Rien n'est enregistré |
| Espèces sans caisse ou session indisponible | Refusé |
| Versement similaire | Confirmation |
| Écriture visée / exercice clos | Modification et suppression refusées |
| Bon de caisse en session clôturée | Modification et suppression refusées |
| Référence Mobile Money déjà encaissée | Ligne refusée |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Création, modification, suppression | Journal d'audit (avant / après) |
| Écriture | Journal comptable (ecr_vrs_…) |
| Bon d'entrée | Brouillard de caisse |
| Paiement en ligne | Table des paiements en ligne (transaction, statut, versement lié) |

## 6. RACI

| Procédure | Compta / caisse | Commercial | Comptable | Direction |
|---|---|---|---|---|
| PAI-01 Versement | R | I | I | – |
| PAI-02 Correction | R | – | C | A |
| PAI-03 Suppression | C | – | R | A |
| PAI-05 VEFA | C | R | – | A |
| PAI-06 Mobile Money | R | – | C | I |
| PAI-07 Paiement en ligne | C | R | C | I |
| PAI-08 Doublons | C | – | R | A |
| PAI-09 Rattrapage | I | – | R | I |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| « Versement NON enregistré : paramétrage manquant » | Compte par défaut absent | Paramètres › Comptes par défaut |
| Impossible de modifier un versement | Écriture visée ou caisse clôturée | Contre-passer ou régulariser en caisse |
| Solde souscripteur trop bas | Versement saisi en « frais de souscription » | Corriger le type |
| Espèces : « bon de caisse impossible » | Caisse fermée ou date hors session | Ouvrir la caisse ou corriger la date |
| Ligne Mobile Money non rapprochée | Téléphone ou nom inconnu | Choisir le souscripteur à la main |
| Paiement en ligne réussi mais pas de versement | Souscripteur introuvable | Vérifier la fiche, relancer le rapprochement |
| Commission restée après suppression | Commission déjà payée | Traiter manuellement |

## 8. Liste de contrôle

1. ☐ Type et mode corrects ; caisse choisie en espèces
2. ☐ Écriture générée et équilibrée
3. ☐ Reçu remis
4. ☐ Pas de doublon signalé
5. ☐ Mobile Money et paiements en ligne rapprochés
6. ☐ Échéanciers contrôlés ; appels VEFA émis selon l'avancement

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
