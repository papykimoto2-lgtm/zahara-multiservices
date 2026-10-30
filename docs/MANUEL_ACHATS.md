# Manuel de procédures — Achats et commandes

**Réf.** PRO-ACH · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi, dans quel ordre et avec quelle preuve pour acheter des matériaux : bon de commande, validation, réception (BL), facture fournisseur et règlement.
**Principe directeur** : aucun engagement sans validation de la hiérarchie ; aucune facture sans réception ; le rapprochement à trois voies (commande, réception, facture) est obligatoire.

> Les noms de boutons sont ceux du module **Achats & Commandes** de l'ERP (onglets Bons de commande, Réceptions, Factures fournisseur).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Acheteur / chantier** | Rédige le bon de commande, le soumet, suit les livraisons |
| **Direction / gérant** | Valide ou rejette le bon de commande (engagement) |
| **Magasinier** | Réceptionne les marchandises (BL) dans le bon dépôt |
| **Comptabilité** | Enregistre la facture fournisseur, contrôle le rapprochement, ventile les factures de caisse |
| **Caisse / trésorerie** | Règle le fournisseur |

## 2. Règles d'or

1. **Pas de commande sans fournisseur** ni sans ligne valide ; fournisseur **gelé (SFC)** = commande et facture interdites.
2. Un bon de commande n'engage l'entreprise qu'à l'état **Validé**.
3. On ne réceptionne jamais plus que le **reliquat** commandé.
4. Une réception alimente le **stock** (coût moyen pondéré) et provisionne la dette en **408** (factures non parvenues).
5. Une facture solde le 408 : un **écart de prix** est comptabilisé en charge.
6. Rattacher chaque achat à un **chantier** ou à une **division** : sinon il sort de la comptabilité par entité.

## 3. Cycle de vie

| Statut du BC | Signification | Suite |
|---|---|---|
| Brouillon | Modifiable | Soumettre, modifier, supprimer |
| En attente de validation | Décision de la hiérarchie | Valider ou rejeter |
| Validé / Envoyé | Engagement pris | Réceptionner |
| Réceptionné partiel | Reliquat restant | Réceptionner la suite |
| Réceptionné | Tout reçu | Facturer |
| Rejeté / Annulé | Refusé | Corriger puis resoumettre |

## 4. Procédures

### ACH-01 — Rédiger un bon de commande

**Qui** : acheteur. **Où** : **➕ Bon de commande**.

| Champ | Règle |
|---|---|
| **N°** | Automatique si vide |
| **Date** | Par défaut le jour |
| **Fournisseur** | Obligatoire |
| **Chantier (convention)** | Rattache la commande au chantier et à sa division |
| **Division** | À choisir si pas de chantier (fournitures, moyens généraux) |
| **Dépôt de réception** | Dépôt central par défaut |
| **Délai souhaité**, **notes** | Conditions, référence du devis |
| **Lignes** | Matériau (ou ligne libre), quantité > 0, PU HT ; total calculé |

1. Ajouter au moins une ligne valide (➕ Ligne).
2. **Enregistrer (brouillon)**.

**[bloquant]** Fournisseur absent ; aucune ligne valide.
**[confirmation]** Ni chantier ni division : la commande n'apparaîtra dans aucune comptabilité par entité.

### ACH-02 — Soumettre et faire valider

1. **Soumettre** (📤) : le BC passe « en attente de validation » ; une demande part dans **Validations**.
2. La hiérarchie (administrateur ou gérant) **valide** ou **rejette** avec motif.
3. Validé : le BC peut être réceptionné et imprimé. Rejeté : corriger (✏️), puis resoumettre.
4. **Imprimer** (🖨️) le bon pour le fournisseur : visa de la direction inclus.

**[bloquant]** Fournisseur gelé ; validation par une personne sans rôle hiérarchique.

### ACH-03 — Réceptionner (bon de livraison)

**Qui** : magasinier. **Où** : 📥 sur un BC validé ou partiellement reçu.

1. Contrôler la livraison contre le BL du fournisseur.
2. Choisir la **date** et le **dépôt** de réception.
3. Saisir par ligne la **quantité reçue** (préremplie au reliquat).
4. **Valider la réception**.

L'ERP : crée l'entrée en stock par ligne ; crée la réception (numéro automatique) ; passe l'écriture **achat / 408** et l'entrée en stock (stock permanent) ; met le BC à « réceptionné » ou « partiel ».

**[bloquant]** Aucune quantité ; quantité supérieure au reliquat ; compte d'achat, de stock ou 408 non paramétré (le message nomme le paramètre).

### ACH-04 — Enregistrer la facture fournisseur

**Qui** : comptabilité. **Où** : onglet **Réceptions (BL)** › facturer la réception.

| Champ | Règle |
|---|---|
| **N° facture fournisseur** | Obligatoire |
| **Date** | Par défaut le jour |
| **Montant HT facturé** | Obligatoire, > 0 ; prérempli avec la valeur reçue |
| **TVA** | Déductible 18 %, non déductible ou exonéré |
| **Mode** | À crédit (compte du fournisseur) ou comptant (compte de trésorerie obligatoire) |

1. Lire le **rapprochement** : valeur reçue, montant facturé, **écart** (vert < 1 F, orange ≤ 5 %, rouge au-delà), TVA, AIRSI, **net à payer**.
2. Enregistrer.

L'ERP : solde la provision 408 vers le compte fournisseur ; comptabilise l'**écart de prix** en charge ; passe la **TVA** (déductible, ou en charge si non déductible) ; retient l'**AIRSI** si le fournisseur y est soumis ; marque la réception « facturée ».

**[bloquant]** N° facture absent ; HT nul ; fournisseur gelé ; comptant sans trésorerie ; compte 408, achat, TVA ou AIRSI non paramétré.
Une réception déjà facturée ne se refacture pas.

### ACH-05 — Facture ponctuelle sans commande (caisse)

Pour un loyer, une prestation ou toute dépense sans bon de commande.

1. **Caissière** : saisir la facture en attente (fournisseur, n°, montant TTC, dates de facture et d'échéance, pièces jointes de 5 Mo maximum). Aucune imputation comptable.
2. **Comptable** : Comptabilité › Comptes tiers › **Ventilation** : choisir le compte de charge, vérifier HT, TVA (18 %), compte de TVA, division.
3. Valider : l'écriture (journal des achats) est créée, avec l'échéance ; la facture passe « ventilée ».

**[confirmation]** HT + TVA différent du TTC.

### ACH-06 — Règlement du fournisseur

1. Suivre les échéances : Comptabilité › Comptes tiers › **Fournisseurs 401** et **Échéances**.
2. Régler par la caisse (sortie, avec validation) ou par la banque ; lettrer ensuite le paiement avec la facture.
3. Contrôler que la facture est comptabilisée avant de payer.

### ACH-07 — Annuler ou supprimer

- **Brouillon ou rejeté** : modifiable ; supprimable.
- **BC avec réception** : suppression **impossible**.
- Réception ou facture erronée : contre-passer l'écriture (Comptabilité) et saisir la correction.

## 5. Contrôles et blocages

| Contrôle | Effet |
|---|---|
| Fournisseur gelé (SFC) | BC, facture et paiement refusés |
| Quantité reçue > reliquat | Réception refusée |
| Réception déjà facturée | Refus |
| Écart facture / réception | Affiché ; comptabilisé en charge |
| Compte du paramétrage manquant | Rien n'est enregistré, le message nomme le paramètre |
| BC avec réception | Suppression refusée |
| BC sans chantier ni division | Confirmation requise |

## 6. Traçabilité

| Événement | Conservé dans |
|---|---|
| Soumission, validation, rejet | Menu Validations (demandeur, validateur, dates, motif) |
| Réception | Table des réceptions + mouvements de stock |
| Facture | Table des factures fournisseur + écritures liées |
| Visa de la direction | BC imprimé (valide_par, valide_date) |

## 7. RACI

| Procédure | Acheteur | Direction | Magasinier | Comptabilité |
|---|---|---|---|---|
| ACH-01 BC | R | I | – | – |
| ACH-02 Validation | C | A/R | – | – |
| ACH-03 Réception | I | – | R | I |
| ACH-04 Facture | – | – | C | R |
| ACH-05 Facture ponctuelle | – | – | – | R |
| ACH-06 Règlement | – | A | – | R |

## 8. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Impossible de réceptionner | BC non validé | Faire valider |
| « Une quantité dépasse le reliquat » | Livraison supérieure à la commande | Réceptionner le reliquat, avenant ou nouveau BC |
| Facture refusée | Fournisseur gelé ou compte manquant | Voir Conformité ou Paramètres |
| Écart rouge au rapprochement | Prix facturé différent du BC | Faire confirmer par le fournisseur ; comptabilisé en charge |
| Dépense absente de la comptabilité par entité | BC sans chantier ni division | Corriger la division |
| Suppression de BC refusée | Réception existante | Contre-passer |

## 9. Liste de contrôle

1. ☐ Fournisseur actif et non gelé
2. ☐ BC avec chantier ou division
3. ☐ BC validé avant livraison
4. ☐ Réception contrôlée contre le BL, bon dépôt
5. ☐ Facture rapprochée (écart expliqué)
6. ☐ Règlement lettré

## 10. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
