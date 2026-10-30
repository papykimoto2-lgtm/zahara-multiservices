# Manuel de procédures — Facturation normalisée (FNE)

**Réf.** PRO-FNE · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour émettre une facture client, la faire certifier par la plateforme FNE, corriger un rejet et émettre un avoir.
**Principe directeur** : une facture n'est **opposable** qu'une fois **certifiée** ; une facture certifiée ne se modifie plus, elle se **corrige par un avoir**.

> Les noms de boutons sont ceux de **Facturation › Factures clients** et de **Paramètres › FNE**.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Administrateur** | Renseigne la configuration FNE (clé, environnement, établissement, point de vente) |
| **Facturier** | Émet les factures, suit les statuts, recertifie après correction |
| **Comptabilité** | Contrôle les avoirs et les écritures |
| **Direction** | Décide l'émission d'un avoir |

## 2. Règles d'or

1. **Tester avant la production** : la connexion se valide en environnement de test.
2. La certification exige la **clé API** et l'**URL** de l'environnement choisi.
3. Une facture **en erreur** se corrige puis se **recertifie** ; on n'en crée pas une seconde.
4. Un **avoir** ne s'émet que sur une facture **certifiée**, **une seule fois** par facture, et il est **irréversible**.
5. La clé API ne se communique jamais par message.

## 3. Procédures

### FNE-01 — Configurer la FNE

**Où** : Paramètres › FNE.

1. Activer la FNE, saisir la **clé API**, choisir l'**environnement** (test ou production).
2. Renseigner l'**établissement**, le **point de vente** et, si besoin, l'adresse du **proxy** et les URL de test et de production.
3. Cliquer **Tester la connexion** et lire le résultat avant d'émettre.

### FNE-02 — Émettre une facture

**Où** : Factures clients › émission.

1. Choisir le mode : **FNE** (facture à certifier) ou **simple** (facture non certifiée).
2. Renseigner client, lignes et montants ; la facture reçoit son numéro.
3. En mode FNE avec la FNE active, le statut initial est **à certifier** ; sinon **hors FNE**.

### FNE-03 — Certifier

1. Lancer la certification de la facture.
2. Le dossier part vers la plateforme ; en cas de succès le statut devient **certifiée** et la référence, le jeton et la date de certification sont conservés.
3. En cas d'échec le statut devient **erreur** avec le message reçu.

Messages à connaître :

| Message | Cause | Action |
|---|---|---|
| Clé API absente | Configuration incomplète | FNE-01 |
| URL absente pour l'environnement | URL non renseignée | FNE-01 |
| Erreur réseau / blocage navigateur | Connexion ou restriction d'accès à la plateforme | Vérifier la connexion ou le proxy |

### FNE-04 — Corriger et recertifier

1. Lire le message d'erreur de la facture.
2. Corriger la cause (donnée client, ligne, configuration).
3. Lancer **Recertifier**.

### FNE-05 — Émettre un avoir

1. Ouvrir une facture **certifiée** qui n'a pas encore d'avoir.
2. Cliquer **Générer l'avoir**, confirmer : l'opération est **irréversible**.
3. Si les identifiants de lignes de la plateforme manquent, l'avoir est refusé avec un message : recertifier ou compléter d'abord.

### FNE-06 — Suivi

**Où** : Factures clients : indicateurs **certifiées**, **en attente**, **en erreur** ; filtre par statut.

1. Traiter chaque jour les factures **en erreur** puis **en attente**.

## 4. Statuts

| Statut | Sens |
|---|---|
| à certifier | Émise, pas encore envoyée |
| certifiée | Acceptée par la plateforme |
| erreur | Rejetée ou non transmise |
| hors FNE | Facture simple |
| non applicable | Sans objet |

## 5. Traçabilité

Référence, jeton et date de certification sont conservés sur la facture ; l'avoir est lié à sa facture d'origine.

## 6. RACI

| Étape | Admin | Facturier | Compta | Direction |
|---|---|---|---|---|
| FNE-01 | R/A | I | I | I |
| FNE-02/03/04 | I | R/A | I | I |
| FNE-05 | I | R | C | A |
| FNE-06 | I | R | C | I |

## 7. Erreurs fréquentes

- Émettre en production sans test préalable.
- Refaire une facture au lieu de recertifier.
- Tenter un avoir sur une facture non certifiée.
- Confirmer un avoir sans vérifier la facture.

## 8. Liste de contrôle

- [ ] Connexion testée
- [ ] Aucune facture en erreur en fin de journée
- [ ] Avoirs validés par la Direction

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
