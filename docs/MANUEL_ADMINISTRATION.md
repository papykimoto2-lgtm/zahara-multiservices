# Manuel de procédures — Administration du système

**Réf.** PRO-ADM · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour administrer l'ERP : paramètres, utilisateurs et rôles, sécurité, sauvegardes, contrôle d'intégrité, incidents, archivage numérique (GED) et accès aux portails.
**Principe directeur** : moindre privilège ; rien ne se supprime en masse sans sauvegarde préalable ; toute anomalie est tracée et traitée.

> Les noms de boutons sont ceux des modules **Paramètres système**, **Audit d'intégrité**, **Déclarations d'incident**, **GED — Archivage numérique** et **Accès Portail**.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Administrateur** | Crée utilisateurs et rôles, sauvegarde, réinitialise, paramètre |
| **Responsable informatique / support** | Traite les incidents, lance l'audit d'intégrité |
| **Direction** | Arbitre les droits, valide les accès exceptionnels |
| **Utilisateur** | Déclare les incidents, téléverse ses pièces |

## 2. Règles d'or

1. La création d'utilisateurs, la réinitialisation de mots de passe et la remise à zéro des données sont **réservées à l'administrateur**.
2. Exporter une **sauvegarde** avant toute importation ou réinitialisation.
3. Les **comptes comptables par défaut** se paramètrent avant la saisie des opérations : un compte manquant bloque l'écriture avec un message précis.
4. Un poste ne publie jamais sa configuration vide sur le cloud ; un conflit de synchronisation se traite, il ne s'ignore pas.

## 3. Procédures

### ADM-01 — Paramétrage initial

**Où** : Paramètres système, par étapes :

| Étape | Contenu |
|---|---|
| Identité | **Société** (raison sociale, RCCM, NCC, logo : alimente tous les documents), portail public, localisation |
| Accès | Utilisateurs, sécurité, API partenaires |
| Fondations comptables | Plan comptable, **Comptes par défaut** |
| Règles de gestion | Objectifs, seuils d'alerte, workflow |
| Modules métier | RH et paie, Mobile Money |
| Intégrations | Cloud / synchronisation, conflits, comptes holding, communications, reporting |
| Données et maintenance | Import, sauvegardes, manuels et flux |
| Finance et conformité | LBCFT, trésorerie et caisse, budget, DQE, déboursé, stock et achats |
| Patrimoine et terrain | Foncier, juridique, locatif, copropriété, parc auto |
| Relation client | CRM, messagerie et calendrier, diaspora |

Enregistrer avec **💾 Tout enregistrer**.

### ADM-02 — Utilisateurs et rôles

**Où** : Utilisateurs.

1. **+ Nouvel utilisateur** (administrateur) : nom, identifiant, mot de passe saisi deux fois, **rôle**.
2. Rôles système : **administrateur**, **manager**, **comptable**, **commercial**, **caissière**, **commissaire aux comptes**. Le comptable ne supprime jamais : il corrige par écriture inverse.
3. **Rôles & Accès** : créer des rôles sur mesure, régler les permissions par module, **exporter la matrice** en CSV, **simuler** un rôle.
4. **Journal connexions** et **Poste de pilotage** : contrôler qui se connecte.
5. **Auditer les accès** : compare le paramétrage des rôles entre le poste et le cloud.
6. **Réinitialiser les mots de passe** : action d'exception, confirmée.

### ADM-03 — Sécurité

**Où** : Sécurité.

1. Politique de mot de passe : longueur minimale, expiration (en jours, 0 = jamais), exigences obligatoires.
2. Session : durée en minutes, tentatives avant blocage, durée du blocage, inactivité avant déconnexion.
3. **Postes connectés** : surveiller les sessions actives.

### ADM-04 — Sauvegardes, import, remise à zéro

**Où** : Sauvegardes.

1. **⬇ Exporter tout (JSON)** : sauvegarde complète ; **📊 Export CSV multi-modules** ; actualiser les statistiques de la base.
2. **⬆ Importer JSON** : restaurer une sauvegarde.
3. **🗑 Réinitialiser BDD** (administrateur) : l'assistant liste, **par catégorie, ce qui part et ce qui reste**, et exige au moins un sous-module sélectionné.
4. **Import de données** : reprise depuis des fichiers externes ; contrôler les doublons après import (PRO-PAI, PAI-08).

### ADM-05 — Cloud et synchronisation

**Où** : Cloud / Sync, Conflits de synchro.

1. Renseigner l'URL et la clé du projet cloud ; les deux champs sont obligatoires.
2. Lire l'état de la synchronisation.
3. **Conflits de synchro** : enregistrements modifiés ailleurs avant votre enregistrement ; la liste reste locale à ce poste ; traiter poste par poste, sans écraser.

### ADM-06 — Audit d'intégrité

**Où** : Audit d'intégrité › **▶ Lancer l'audit**. Chaque mois et avant chaque clôture.

1. L'audit croise les modules : références orphelines, équilibre comptable, doublons, caisse, achats et stock, cohérence du chiffre d'affaires, comptes par défaut, cas métier (lot vendu sans souscripteur, employé actif avec date de départ…).
2. Les anomalies sont classées **critique**, **majeur** ou **mineur**, avec le module concerné.
3. Corriger d'abord les critiques ; appliquer les corrections automatiques proposées après relecture.
4. Relancer jusqu'à l'absence d'anomalie critique.

### ADM-07 — Déclaration d'incident

**Où** : Déclarations d'incident › **+ Déclarer un incident**.

1. L'utilisateur saisit : **nom et description (obligatoires)**, fonction, division, contacts, poste de travail, date et heure, module, **gravité**, reproductibilité, étapes pour reproduire, résultat attendu et obtenu.
2. L'ERP attribue un **ticket** (statut « nouveau ») et notifie par **e-mail et WhatsApp**.
3. Le support **répond** : « Enregistrer la réponse », qui reste sur le ticket.
4. Suivre le ticket jusqu'à sa résolution.

### ADM-08 — GED : archivage numérique

**Où** : GED.

1. **📁 Téléverser** : fichier, description, entité rattachée.
2. Consulter les documents **par département et par service**.

### ADM-09 — Accès aux portails

**Où** : Accès Portail — tous les acteurs.

1. La liste recense les acteurs qui peuvent se connecter au portail unique : souscripteurs (et diaspora, locataires), apporteurs, acquéreurs fonciers, propriétaires mandants, copropriétaires, propriétaires terriens, partenaires de lotissement, aménageurs.
2. Pour chacun : identifiant, statut — **déjà connecté**, **code émis jamais utilisé**, **sans accès**, **sans identifiant utilisable**.
3. Émettre ou renouveler un code depuis la fiche de l'acteur (SOU-11 pour un souscripteur) ; transmettre le code par canal séparé de l'identifiant.
4. Filtrer par type et par statut ; actualiser.
5. Les **statistiques du portail** mesurent la fréquentation sans donnée personnelle.

### ADM-10 — Manuels et diagrammes

**Où** : Paramètres › Manuels & flux. Choisir un manuel pour afficher ses diagrammes ; ouvrir le PDF.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Action réservée sans rôle administrateur | Refusée |
| Remise à zéro sans sous-module | Refusée |
| URL ou clé cloud absente | Enregistrement refusé |
| Incident sans nom ou description | Refusé |
| Compte par défaut manquant | Écriture refusée, paramètre nommé |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Connexions | Journal des connexions |
| Incidents | Tickets (déclarant, réponse) |
| Audit | Liste d'anomalies avec gravité |
| Documents | GED (entité, description) |

## 6. RACI

| Procédure | Administrateur | Support | Direction | Utilisateurs |
|---|---|---|---|---|
| ADM-01 Paramétrage | R | C | A | – |
| ADM-02 Utilisateurs | R | – | A | – |
| ADM-04 Sauvegardes | R | C | I | – |
| ADM-06 Audit | C | R | I | – |
| ADM-07 Incidents | C | R | I | R |
| ADM-09 Accès portails | R | C | I | – |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| « Réservé à l'administrateur » | Rôle insuffisant | Demander l'action à un administrateur |
| Écriture refusée, « compte manquant » | Compte par défaut absent | Paramètres › Comptes par défaut |
| Conflit de synchro | Modification sur un autre poste | Traiter la ligne du conflit |
| Anomalies critiques d'audit | Références orphelines ou déséquilibre | Corriger la source puis relancer |

## 8. Liste de contrôle mensuelle

1. ☐ Sauvegarde complète exportée
2. ☐ Audit d'intégrité sans anomalie critique
3. ☐ Incidents du mois traités
4. ☐ Accès portail : codes émis, jamais connectés relancés
5. ☐ Journal de connexion relu

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
