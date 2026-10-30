# Manuel de procédures — Parc auto

**Réf.** PRO-PAU · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour gérer les véhicules de l'entreprise : fiche véhicule, affectations, carburant, entretien, courses.
**Principe directeur** : un véhicule, une fiche, un affectataire ; chaque plein et chaque entretien génère son écriture ; aucun compte n'est deviné.

> Les noms de boutons sont ceux du module **Parc Auto** (Véhicules, Courses quotidiennes, Carburant, Entretien, Affectations).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Gestionnaire du parc** | Crée les fiches, affecte, saisit pleins et entretiens |
| **Chauffeur / affectataire** | Déclare ses pleins, signale les pannes |
| **Comptabilité** | Contrôle les écritures de carburant et d'entretien |
| **Direction** | Décide acquisitions et réformes |

## 2. Règles d'or

1. Chaque action exige le **droit** du module Parc Auto (création ou modification).
2. **Immatriculation** obligatoire.
3. Un plein exige véhicule, date, litres, montant et **kilométrage** ; un entretien exige véhicule, date et kilométrage.
4. Un véhicule « Service » (pool) n'a pas d'affectataire fixe : l'affecter durablement demande confirmation.
5. Les comptes de **carburant**, d'**entretien** et de trésorerie sont paramétrés avant la saisie.

## 3. Procédures

### PAU-01 — Fiche véhicule

**Où** : **+ Véhicule**.

| Bloc | Champs |
|---|---|
| Identité | **Immatriculation**, type, marque, modèle, année |
| Gestion | Statut (actif par défaut), usage, division, kilométrage |
| Acquisition | Date, valeur |
| Carte grise | Numéro, date |
| Assurance | Compagnie, police, date de début |

Enregistrer ; modifier une fiche exige le droit de modification.

### PAU-02 — Affectation

**Où** : Affectations › affecter.

1. Choisir le véhicule, l'employé, la date de début (obligatoires) et le motif.
2. Une affectation **active** précédente du même véhicule est **terminée** à la date de début.
3. Véhicule « Service » : confirmer l'affectation durable.

### PAU-03 — Carburant

**Où** : Carburant › nouveau plein.

1. Saisir véhicule, date, litres, montant, kilométrage (obligatoires), station, chauffeur, mode de paiement.
2. Enregistrer : écriture charge de carburant / trésorerie (caisse, mobile money ou banque selon le mode).
3. Si un compte manque, le plein reste enregistré et le message nomme le paramètre.

### PAU-04 — Entretien

**Où** : Entretien › nouvel entretien.

1. Saisir véhicule, date, kilométrage (obligatoires), type, atelier, coût, prochain entretien (kilométrage et date), mode de paiement, description.
2. Enregistrer : écriture charge d'entretien / contrepartie (fournisseur si à crédit, sinon trésorerie).
3. Planifier le prochain entretien selon le kilométrage et la date saisis.

### PAU-05 — Courses quotidiennes

**Où** : Courses quotidiennes : suivre les courses des véhicules. Les ordres de mission peuvent désigner un véhicule de la société (PRO-CRM, CRM-04).

### PAU-06 — Suppression

Un véhicule se supprime depuis la liste ; s'il a un historique, préférer un autre statut que « actif ».

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Immatriculation absente | Refusé |
| Champs obligatoires du plein ou de l'entretien absents | Refusé |
| Compte comptable manquant | Plein ou entretien enregistré sans écriture, message précis |
| Droit absent | Action refusée |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Véhicule, affectation | Tables dédiées (historique des affectations) |
| Plein, entretien | Tables + écritures |

## 6. RACI

| Procédure | Gestionnaire | Chauffeur | Compta | Direction |
|---|---|---|---|---|
| PAU-01 Fiche | R | I | I | A |
| PAU-02 Affectation | R | C | – | I |
| PAU-03 Carburant | R | R | C | – |
| PAU-04 Entretien | R | C | C | I |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Plein sans écriture | Compte carburant absent | Paramètres › Comptes par défaut |
| Ancienne affectation toujours active | Non terminée | Créer la nouvelle affectation : l'ancienne se clôt |

## 8. Liste de contrôle

1. ☐ Fiches à jour (assurance, carte grise)
2. ☐ Affectations actives vérifiées
3. ☐ Pleins et entretiens saisis avec kilométrage
4. ☐ Prochains entretiens planifiés

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
