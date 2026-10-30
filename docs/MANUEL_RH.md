# Manuel de procédures — Ressources humaines

**Réf.** PRO-RH · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour gérer le personnel : fiche employé, pointage, congés, mobilité interne, recrutement et formation.
**Principe directeur** : la fiche employé est la source unique ; pointage et congés alimentent la paie sans ressaisie ; toute décision RH est datée, motivée et tracée.

> Les noms de boutons sont ceux des modules **Gestion des Employés**, **Pointage & Présences**, **Congés & Absences**, **Mobilité Interne**, **Recrutement** et **Formations & FDFP**.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Gestionnaire RH** | Tient les fiches, le pointage, les congés, la mobilité |
| **Responsable hiérarchique** | Propose, valide les demandes de son équipe |
| **Direction** | Décide embauche, mutation, promotion ; valide les congés (droit de validation) |
| **Paie** | Exploite fiches, pointages et congés (manuel Paie) |

## 2. Règles d'or

1. **Un matricule unique** par employé ; nom et matricule obligatoires.
2. Rattacher chaque employé à une **division** dès qu'il en existe.
3. Le **mode de rémunération** (mensuel, pointage, journalier, horaire) détermine l'impact du pointage sur la paie.
4. Le **statut CNPS** et le **contrat** pilotent l'exonération en paie.
5. Une mutation ou promotion exige une **date d'effet** et un **motif**.
6. La validation d'un congé est réservée au droit de validation du module Congés.

## 3. Procédures

### RH-01 — Créer ou modifier un employé

**Où** : Gestion des Employés › **+ Nouvel employé**.

| Bloc | Champs principaux |
|---|---|
| Identité | Nom, prénoms, date de naissance, genre, situation matrimoniale, enfants, téléphone, e-mail, adresse |
| Social | N° CNPS, **statut CNPS** (déclaré ou non déclaré) |
| Poste | Poste, département, **division**, **contrat**, date d'embauche, date de fin |
| Rémunération | Secteur et catégorie (grille), salaire de base, **mode de rémunération**, taux horaire ou journalier, primes, transport, logement |
| Paiement | Mode (virement, Wave, Orange Money, MTN, espèces), banque, compte, wallet |
| Statut | Actif, sorti… |

1. Remplir et **Enregistrer**.
2. Modifier une fiche conserve les champs hors formulaire et la date de création.

**[bloquant]** Nom ou matricule absent ; division absente quand l'entreprise en compte.

### RH-02 — Pointage

**Où** : Pointage & Présences.

1. **Tableau journalier** : saisir la présence de chaque employé ; **Scan badge** pour un pointage rapide ; **+ Saisie individuelle** pour une correction.
2. Les statuts **payables** sont : présent (P), retard (R), demi-journée (M, 4 heures), congé (C) et accident du travail (AT). Une demi-journée compte 4 heures, une journée entière 8 heures ; les heures sont plafonnées à 12 par jour.
3. **Récapitulatif mensuel** et **Impact sur la paie** : jours ou heures payables par employé.
4. **Absences & Retards** : contrôler les écarts, relancer.
5. Clôturer le pointage avant la génération des bulletins.

Effet sur la paie : mode **pointage** = salaire mensuel proratisé (jours payables ÷ jours ouvrés) ; **journalier** = taux journalier × jours payables ; **horaire** = taux horaire × heures ; **mensuel** = non impacté.

### RH-03 — Congés et absences

**Où** : Congés & Absences.

1. **+ Nouvelle demande** : employé, type, dates de début et de fin, nombre de jours (calculé si vide), motif.
2. Types : annuel, maladie, maternité, paternité, sans solde, autre.
3. À la création en attente, un message part dans le groupe RH.
4. **Valider** (✅) ou **refuser** (✕) : réservé au droit de validation. Un congé approuvé **pré-remplit le pointage** ; un refus retire les pointages automatiques.
5. **Soldes par employé** et **Planning mensuel** : suivre les droits et les absences du mois.

**Droits au congé annuel** : 2,2 jours par mois de service (réglable), majoration d'ancienneté (+1 jour à 5 ans, +2 à 10, +3 à 15, +4 à 20, +5 à 25 ans) et, pour les salariées, 2 jours par enfant à charge et par an. Une **allocation de congé** est calculée pour un congé annuel.

**[confirmation]** Congé annuel approuvé supérieur au solde disponible : accord pour un congé anticipé.
**[bloquant]** Employé ou dates absents ; date de fin avant la date de début.

### RH-04 — Mobilité interne

**Où** : Mobilité Interne › **+ Nouvelle mutation**.

1. Choisir l'**employé** ; l'ERP enregistre la situation **avant** (poste, département, division, catégorie, salaire).
2. Saisir le **type** (mutation, promotion…), la **date d'effet**, la **décision** (référence, décideur), le **nouveau** poste, département, division, service, catégorie, salaire, et le **motif**.
3. Enregistrer : l'historique conserve avant et après.
4. Une correction ultérieure ne modifie que la nouvelle situation.

**[bloquant]** Employé, date d'effet ou motif absent.

### RH-05 — Recrutement

**Où** : Recrutement.

1. **+ Poste ouvert** : intitulé (obligatoire), département, type de contrat, salaire proposé, dates d'ouverture et limite, statut, description.
2. **Toutes les candidatures** : enregistrer chaque candidat (nom et poste obligatoires, contacts, date, statut, entretien, prétention salariale).
3. **Pipeline candidats** : faire avancer chaque candidature d'étape en étape.
4. Retenu : créer la **fiche employé** (RH-01) ; clôturer le poste.

### RH-06 — Formation et FDFP

**Où** : Formations & FDFP.

1. **+ Nouvelle formation** : titre (obligatoire), type, organisme, dates, durée en heures, coût, éligibilité FDFP et montant, statut, participants, objectifs.
2. **Plan annuel** : planifier les sessions de l'année.
3. **Suivi FDFP** : suivre les montants FDFP des formations ; la taxe FDFP est calculée en paie (0,4 % + 0,6 % + 0,6 % du brut imposable).

### RH-07 — Sortie d'un employé

1. Renseigner la **date de fin** et passer le statut à « sorti » : l'employé n'apparaît plus parmi les actifs de la paie.
2. Établir le dernier bulletin (bulletin individuel) et régler les sommes dues.
3. Archiver le dossier ; supprimer l'accès aux outils.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Nom ou matricule absent | Fiche refusée |
| Division absente | Fiche refusée si l'entreprise a des divisions |
| Fin de congé avant le début | Refusé |
| Solde de congé insuffisant | Confirmation |
| Mutation sans date d'effet ou motif | Refusée |
| Candidature sans nom ou sans poste | Refusée |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Fiche employé | Table des employés (dates de création et de mise à jour) |
| Congé | Table des congés (statut, dates, validation) et messagerie RH |
| Mutation | Table de mobilité (situation avant et après, décideur, référence) |
| Pointage | Table des pointages (jour, statut, heures) |

## 6. RACI

| Procédure | RH | Hiérarchie | Direction | Paie |
|---|---|---|---|---|
| RH-01 Fiche employé | R | C | A | C |
| RH-02 Pointage | R | R | I | C |
| RH-03 Congés | R | C | A | I |
| RH-04 Mobilité | R | C | A | I |
| RH-05 Recrutement | R | C | A | I |
| RH-06 Formation | R | C | A | I |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Salaire proratisé en paie | Pointage non saisi (mode pointage) | Saisir le pointage |
| Solde de congé négatif | Congés anticipés | Régulariser ou refuser |
| Cotisations sur un consultant | Contrat ou statut CNPS mal renseigné | Corriger la fiche |
| Employé absent de la paie | Statut non actif ou sorti | Corriger le statut |
| Mutation non reflétée en paie | Fiche non mise à jour | Mettre à jour salaire et catégorie |

## 8. Liste de contrôle mensuelle

1. ☐ Fiches à jour (statut, contrat, coordonnées)
2. ☐ Pointage clôturé
3. ☐ Congés traités
4. ☐ Mobilités enregistrées avec motif
5. ☐ Postes ouverts et candidatures suivis

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
