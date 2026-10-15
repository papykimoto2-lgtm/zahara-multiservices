# Manuel de procédures — Attestation de solde

**Objet** : fixer qui fait quoi, quand et avec quelle preuve pour délivrer une attestation de solde à un souscripteur ayant payé son bien, de la constatation du solde à la remise au notaire.
**Principe directeur** : une attestation n'est délivrée que si la comptabilité prouve le solde. Les montants ne se saisissent jamais à la main : ils viennent des versements enregistrés. Le texte validé par la direction est **figé** ; toute correction est tracée.

> Les noms de boutons sont ceux de l'ERP (fiche du souscripteur, zone **Documents**, et liste **À livrer** du module Réceptions et livraisons).

---

## 1. Les deux attestations

| | Attestation de solde (initiale) | Attestation de solde (valeur finale) |
|---|---|---|
| **Numéro** | ATS-AAAA-NNNN | ATF-AAAA-NNNN |
| **Ce qu'elle atteste** | Le prix **initial** du bien est soldé | La **valeur finale** (prix initial + suppléments) est soldée |
| **Quand elle existe** | Toujours, dès que le prix initial est soldé | Seulement s'il existe au moins un supplément facturé |
| **Contenu en plus** | Mention d'une attestation distincte pour les suppléments | Tableau de décomposition : prix initial, chaque supplément (date, nature, libellé, montant), valeur finale |

### 1.1 Qu'est-ce qu'un supplément ?

Trois natures de supplément, facturées **après** la souscription et ajoutées au montant du contrat :

| Nature | Origine dans l'ERP | Condition |
|---|---|---|
| **Travaux modificatifs** | Demande de modification du souscripteur | Marquée **facturée**, avec montant facturé |
| **Régularisation de surface** | Bouton « Facturer l'écart de surface » (surface réelle supérieure à la surface déclarée) | Enregistrée avec motif |
| **Terrain supplémentaire** | Bouton « Facturer un terrain supplémentaire » | Enregistré avec motif |

**Prix initial = montant du contrat − somme des suppléments facturés.**
Une modification non facturée n'est jamais comptée. Si les données sont incohérentes (prix initial nul ou négatif), l'ERP n'invente aucune décomposition et traite le contrat comme sans supplément.

### 1.2 Ce qui n'est pas un supplément

- **Lot supplémentaire** : un autre lot est une entité cadastrale distincte. Il fait l'objet d'**une autre souscription** et donc de sa propre attestation.
- **Souscription au terrain** : peut regrouper plusieurs lots dans une même souscription ; le prix initial couvre l'ensemble de ces lots.
- **Souscription au logement** : **un seul lot**. L'ERP refuse l'ajout d'un second lot (formulaire souscripteur et rapprochement).
- **Frais de souscription** : non imputés sur le prix, ils n'apparaissent pas dans le tableau des versements (une mention l'indique).

### 1.3 Imputation des versements

Les versements valides (non annulés, hors frais de souscription) sont pris **par ordre chronologique**.

1. Ils soldent d'abord le **prix initial**.
2. Le surplus solde ensuite les **suppléments**.

La **date de solde** est la date du versement qui fait atteindre le prix concerné.

**Exemple chiffré**

| Élément | Montant (FCFA) |
|---|---|
| Montant du contrat | 7 000 000 |
| Travaux modificatifs facturés | 1 500 000 |
| Régularisation de surface | 500 000 |
| **Prix initial** | **5 000 000** |
| Versement 1 (10/01) | 3 000 000 |
| Versement 2 (10/02) | 2 500 000 |
| Versement 3 (01/04) | 1 500 000 |

- Après le versement 2 (5 500 000) : le prix initial est soldé au 10/02 (le versement 2 est imputé pour 2 000 000, mention « partiel »). L'**attestation initiale** est possible ; la valeur finale ne l'est pas.
- Après le versement 3 (7 000 000) : la valeur finale est soldée au 01/04. L'**attestation finale** devient possible.

---

## 2. Rôles

| Rôle | Responsabilités |
|---|---|
| **Comptabilité / commercial** | Enregistre les versements ; soumet l'attestation au DG ; imprime, publie, transmet |
| **DG ou gérant** | Valide ou rejette l'attestation (menu **Validations**) ; peut retirer le visa du souscripteur |
| **Hiérarchie (administrateur, gérant)** | Annule une validation faite par erreur |
| **Souscripteur** | Consulte et imprime l'attestation publiée dans son espace portail |
| **Notaire** | Consulte l'attestation transmise dans son espace Intervenant |

---

## 3. Procédures

### ATT-01 — Constat du solde et brouillon automatique

**Déclencheur** : un versement est enregistré, modifié ou annulé.

1. L'ERP recalcule le solde du souscripteur, pour le prix initial et pour la valeur finale.
2. Si le prix est soldé et qu'aucune attestation n'existe, un **brouillon** est créé avec son numéro, le prix, le total versé et la date de solde. Un message le signale.
3. Si le souscripteur n'est plus soldé (versement annulé ou modifié) et que l'attestation est encore au stade **brouillon**, elle est supprimée.
4. Aucun brouillon n'est créé pour un contrat **résilié**.

**Contrôle** : un brouillon n'est jamais visible du souscripteur.

### ATT-02 — Soumission au DG

**Qui** : comptabilité ou commercial. **Où** : fiche souscripteur › Documents › bouton **Soumettre au DG** (ou **Faire valider** si aucun brouillon).

1. Vérifier l'aperçu (bouton **œil**) : identité, désignation du bien, montants, versements.
2. Choisir, si nécessaire, de **retirer le visa du souscripteur** (ATT-08) avant de soumettre.
3. Cliquer sur **Soumettre au DG**. Le statut passe à **En attente DG/gérant**.
4. Une demande est créée dans le menu **Validations**.

**[bloquant]** Refus si le souscripteur n'est pas soldé, si le contrat est résilié, ou si une demande est déjà en cours. Si une attestation validée existe déjà, l'ERP demande confirmation avant d'en créer une nouvelle.

### ATT-03 — Validation par le DG ou le gérant

**Où** : menu **Validations**.

1. Ouvrir la demande, contrôler les montants.
2. **Valider** ou **Rejeter** (avec motif en cas de rejet).
3. À la validation, l'ERP **re-vérifie le solde**. Si le souscripteur n'est plus soldé, l'attestation est rejetée automatiquement avec la mention « non soldé à la date de validation ».
4. À la validation, le texte est **figé** : date d'émission, signataire (le validateur) et contenu ne changent plus.

Une ligne est ajoutée au dossier juridique du souscripteur.

### ATT-04 — Impression de la version officielle

**Où** : bouton **Sans modif.** (version officielle, à remettre au notaire).

- Le document imprimé est le texte figé à la validation, complété du pied de page de l'entreprise (identité de la division du programme, à défaut de la société).
- C'est la **seule** version à remettre au notaire.

### ATT-05 — Publication au portail du souscripteur

**Où** : bouton **globe** (Publier au portail). Réservé aux attestations **validées**.

1. Cliquer sur le **globe** : l'attestation apparaît dans l'espace du souscripteur, rubrique **Documents**.
2. Un second clic retire l'attestation du portail.
3. L'opération est tracée au dossier juridique.

### ATT-06 — Envoi par WhatsApp

**Où** : bouton **téléphone** (WhatsApp). Réservé aux attestations validées.

1. Le message préparé confirme que le bien (ou la valeur finale) est soldé et indique le numéro du dossier.
2. Si l'attestation est publiée au portail, le message contient le lien vers l'espace souscripteur ; sinon il indique qu'elle peut être retirée aux bureaux.
3. Cliquer sur **Envoyer** dans WhatsApp. L'ERP enregistre la date d'envoi.

**Bonne pratique** : publier au portail **avant** d'envoyer le message, pour que le lien fonctionne.

### ATT-07 — Transmission au notaire

**Où** : bouton **balance** (Transmettre au notaire). Réservé aux attestations validées.

**Prérequis**

- Un **notaire actif** est désigné sur la fiche du souscripteur (intervenant de type notaire).
- Le notaire dispose d'un **accès portail actif**.

**Étapes**

1. Cliquer sur la **balance** : l'attestation apparaît dans l'espace Intervenant du notaire.
2. Le texte transmis est celui figé à la validation.
3. Pour retirer l'accès, cliquer de nouveau sur la **balance**. Changer de notaire coupe aussi l'accès côté serveur.

### ATT-08 — Visa du souscripteur : retirer ou remettre

Le bloc « Le souscripteur — lu et pris connaissance » peut être retiré du document. Le bloc « Signature et cachet » de la direction reste.

**Qui** : administrateur, gérant ou DG.
**Où** : bouton **Retirer le visa** (devient **Remettre le visa**), disponible sur une attestation en brouillon, en attente ou validée.

| Stade | Effet | Motif |
|---|---|---|
| **Brouillon / en attente** | Le choix est mémorisé et appliqué à la validation, à l'aperçu et à l'impression | Non demandé |
| **Validée** | Le document figé, celui du portail et celui du notaire sont mis à jour (seul le bloc de visa change) | **Obligatoire** |

Chaque changement est conservé dans l'historique (date, auteur, retiré ou remis, motif) et ajouté au dossier juridique.
Le choix survit à une annulation de validation.

### ATT-09 — Version indicative « avec modifications »

Réservée à l'attestation initiale validée. Sert quand le souscripteur demande une correction de forme (orthographe du nom, désignation du bien, destinataire).

**Où** : bouton **Avec modif.**

1. Modifier les libellés autorisés : nom et prénoms, date et nationalité, pièce d'identité, désignation du bien, destinataire, observations.
2. Saisir le **motif** (obligatoire).
3. Imprimer : le document est marqué **À titre indicatif** et liste les changements.

**Règles**

- Les **montants, dates et versements** ne sont jamais modifiables : ils viennent de la comptabilité.
- La version officielle (sans modification) reste la référence.
- Chaque impression indicative est tracée (date, auteur, motif, champs modifiés).

### ATT-10 — Annulation d'une validation

**Qui** : administrateur ou gérant. **Où** : bouton **Annuler la validation**.

À utiliser quand une attestation a été validée par erreur.

1. Saisir le **motif** (obligatoire).
2. L'attestation repasse en **brouillon**, est **retirée du portail et de l'espace du notaire**, et sa validation est marquée annulée.
3. L'historique des annulations (date, auteur, motif, ancien validateur) est conservé.
4. Corriger la cause, puis reprendre à ATT-02.

### ATT-11 — Facturer un terrain supplémentaire

**Où** : fiche du souscripteur (enregistré) › bouton **Facturer un terrain supplémentaire**.

1. Renseigner la date, le lot concerné (facultatif), la surface, le prix au m² (le montant se calcule) et le **motif** (obligatoire).
2. Cocher **Montant déjà inclus dans le montant du contrat** uniquement pour régulariser un dossier existant. Sinon, le montant s'ajoute au contrat.
3. Valider : un **avenant signable** s'imprime (sauf montant déjà inclus). La ligne est ajoutée à l'historique et au journal d'audit.
4. L'avenant peut être réimprimé depuis la liste des terrains déjà enregistrés.

**Effet sur l'attestation** : le terrain apparaît comme ligne distincte « Terrain supplémentaire » dans l'attestation **finale**. Le prix initial ne change pas.

### ATT-12 — Facturer un écart de surface

**Où** : fiche du souscripteur, lorsque la surface réelle des lots dépasse la surface déclarée › bouton **Facturer l'écart de surface au souscripteur**.

1. Vérifier le prix au m², saisir le **motif** (relevé topographique, bornage).
2. Valider : le montant s'ajoute au contrat et un avenant s'imprime.
3. La ligne figure dans l'attestation finale sous « Régularisation de surface ».

---

## 4. Contrôles et blocages

| Contrôle | Effet |
|---|---|
| Souscripteur non soldé | Aucune attestation possible |
| Contrat résilié | Aucun brouillon, aucune demande |
| Solde perdu avant la validation | Rejet automatique |
| Demande déjà en cours | Nouvelle demande refusée |
| Attestation non validée | Impression officielle, publication, WhatsApp et notaire refusés |
| Notaire absent ou inactif | Transmission refusée |
| Visa retiré sur attestation validée sans motif | Refusé |
| Rôle insuffisant (visa, annulation) | Refusé |
| Motif manquant (annulation, visa sur validée, avenant, version indicative) | Refusé |

---

## 5. Traçabilité

| Événement | Où il est conservé |
|---|---|
| Création, soumission, validation, publication, WhatsApp, notaire | Dossier juridique du souscripteur |
| Annulations de validation | Fiche de l'attestation (historique) |
| Visa retiré ou remis | Fiche de l'attestation (historique) et dossier juridique |
| Versions indicatives imprimées | Fiche de l'attestation et dossier juridique |
| Terrain supplémentaire, écart de surface | Journal d'audit et dossier juridique |

---

## 6. Matrice RACI

R = réalise, A = approuve, C = consulté, I = informé.

| Procédure | Compta / commercial | DG / gérant | Hiérarchie | Souscripteur | Notaire |
|---|---|---|---|---|---|
| ATT-01 Brouillon automatique | R | I | – | – | – |
| ATT-02 Soumission | R | I | – | – | – |
| ATT-03 Validation | C | A/R | – | – | – |
| ATT-04 Impression officielle | R | I | – | I | – |
| ATT-05/06 Portail, WhatsApp | R | I | – | I | – |
| ATT-07 Transmission notaire | R | I | – | – | I |
| ATT-08 Visa | C | A/R | A | – | – |
| ATT-09 Version indicative | R | C | – | C | – |
| ATT-10 Annulation | C | C | A/R | – | – |
| ATT-11/12 Suppléments | R | A | – | R (signature) | – |

---

## 7. Erreurs fréquentes

| Symptôme | Cause probable | Action |
|---|---|---|
| Pas de brouillon alors que le client a tout payé | Versement non enregistré, annulé, ou contrat résilié | Contrôler les versements ; le brouillon se crée au prochain constat |
| Pas d'attestation finale | Aucun supplément facturé | Facturer le supplément (travaux, surface, terrain) |
| Prix initial trop élevé | Terrain supplémentaire non enregistré comme tel | Enregistrer le terrain (case « déjà inclus »), régénérer l'attestation |
| Attestation déjà émise avec un mauvais montant | Document figé | Annuler la validation (ATT-10), corriger, resoumettre |
| Le notaire ne voit pas l'attestation | Notaire non désigné, inactif, ou accès portail absent | Désigner un notaire actif, activer son accès, retransmettre |
| Lien WhatsApp inactif | Attestation non publiée | Publier au portail (ATT-05) |
| Impossible d'ajouter un second lot | Souscription au logement | Créer une autre souscription pour ce lot |

---

## 8. Liste de contrôle avant remise au notaire

1. Souscripteur soldé et attestation au statut **Validée**.
2. Nom, pièce d'identité et désignation du bien conformes.
3. Montants conformes à la comptabilité ; suppléments détaillés si attestation finale.
4. Visa du souscripteur présent ou retiré selon la demande du notaire.
5. Version **Sans modif.** imprimée et signée.
6. Notaire actif désigné ; transmission **balance** faite.
7. Publication au portail faite si le souscripteur doit pouvoir la consulter.

---

## 9. Suivi des révisions

| Version | Date | Auteur | Objet |
|---|---|---|---|
| 1.0 | Octobre 2026 | | Création |
