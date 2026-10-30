# Manuel de procédures — Conception, plans et permis de construire

**Réf.** PRO-CON · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour conduire la conception d'un programme (études, plans) et obtenir ses autorisations de construire.
**Principe directeur** : une fiche de conception par type de logement et par programme ; un permis suivi de son dépôt à son obtention ; les plans alimentent le chiffrage.

> Les noms de boutons sont ceux du module **Conception & Plans Architecturaux** (Projets de conception, Permis de construire, Bibliothèque de plans, Éditeur de plans).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Architecte** | Produit les études et plans |
| **Responsable technique** | Crée les fiches, suit les phases, dépose les permis |
| **Direction** | Valide les projets de conception |

## 2. Règles d'or

1. Une fiche de conception exige **référence et type(s) de logement**.
2. Un permis exige **un numéro**.
3. Les types de logement déclarés en conception servent de base au chiffrage (PRO-DQE) et au pilotage du programme (PRO-PRG).

## 3. Procédures

### CON-01 — Fiche de conception

**Où** : **+ Nouveau projet**.

| Champ | Contenu |
|---|---|
| **Référence, type de logements** | Obligatoires |
| Nature | Villa par défaut |
| Programme, architecte | Rattachement |
| Surface, nombre d'unités, coût estimé | Dimensionnement |
| **Phase** | Esquisse, APD (avant-projet détaillé), plans d'exécution, DCE (dossier de consultation), plans de récolement |
| **Statut** | En cours, validé, suspendu |
| Dates, description | Planning |

1. Enregistrer ; la fiche apparaît dans la grille avec son avancement.
2. Faire progresser la **phase** à chaque livrable ; passer à **validé** à l'accord de la direction.

### CON-02 — Bibliothèque et éditeur de plans

1. **Bibliothèque de plans** : classer les plans par projet.
2. **Éditeur de plans** : tracer ou reprendre un plan ; les quantités alimentent la nomenclature du DQE.

### CON-03 — Permis de construire

**Où** : **+ Nouveau permis**.

| Champ | Contenu |
|---|---|
| **N° de permis** | Obligatoire |
| Programme, type de logement, architecte | Rattachement |
| Mairie, date de dépôt, date d'obtention, validité | Suivi administratif |
| Taxes, surface, niveaux | Dimensionnement |
| **Statut** | En attente, déposé, obtenu, refusé, expiré, en renouvellement |

1. Enregistrer au dépôt ; mettre à jour le statut à chaque décision.
2. Surveiller la **validité** : engager le renouvellement avant l'expiration.
3. Joindre les pièces au dossier juridique si besoin (PRO-JUR).

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Référence ou type absent | Fiche refusée |
| N° de permis absent | Permis refusé |

## 5. RACI

| Procédure | Architecte | Resp. technique | Direction |
|---|---|---|---|
| CON-01 Fiche | R | C | A |
| CON-02 Plans | R | C | I |
| CON-03 Permis | C | R | I |

## 6. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Étape « concevoir » non faite au pilotage | Aucune fiche rattachée au programme | Créer la fiche |
| Permis expiré | Validité dépassée | Déposer un renouvellement |

## 7. Liste de contrôle

1. ☐ Fiche rattachée au bon programme
2. ☐ Phase à jour
3. ☐ Permis déposé, suivi et valide

## 8. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
