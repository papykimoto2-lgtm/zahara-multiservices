# Manuel de procédures — Facturation normalisée (FNE)

**Réf.** PRO-FNE · **Version** 2.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour émettre une facture client, la faire certifier par la plateforme FNE, corriger un rejet et émettre un avoir ; **facturer les souscripteurs qui ont soldé**, compléter leurs coordonnées et mettre la passerelle en production.
**Principe directeur** : une facture n'est **opposable** qu'une fois **certifiée** ; une facture certifiée ne se modifie plus, elle se **corrige par un avoir**.

> Les noms de boutons sont ceux de **Facturation › Factures FNE**, de **Souscripteurs** et de **Paramètres › Société › API FNE**. Pour la TVA récupérable sur les **achats**, voir le manuel **PRO-TVA**.

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
6. **Un souscripteur soldé reçoit une seule facture** : aucune seconde facture tant que la première n'est pas annulée par un avoir.
7. **La facture de solde ne s'émet qu'à partir du solde complet** (versé sur le prix ≥ montant du contrat, frais de souscription exclus).
8. **Téléphone et e-mail du client sont exigés** par la plateforme pour certifier : à compléter avant l'émission (FNE-09).
9. **Jamais de facture d'essai en production** : le bouton de test ne l'envoie plus ; l'essai complet se fait en environnement de test.

## 3. Procédures

### FNE-01 — Configurer la FNE

**Où** : Paramètres › FNE.

1. Activer la FNE, saisir la **clé API**, choisir l'**environnement** (test ou production).
2. Renseigner l'**établissement**, le **point de vente** et, si besoin, l'adresse du **proxy** et les URL de test et de production.
3. Cliquer **Tester la connexion** et lire le résultat avant d'émettre. En **test**, une facture d'essai est envoyée ; en **production**, seule la passerelle et sa configuration sont vérifiées (aucune facture d'essai).
4. En HTTPS, l'application passe **d'office par la passerelle** de l'entreprise (`/api/fne-proxy`) : le champ « Passerelle » peut rester vide. Pour la production, voir **FNE-10**.

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

**Où** : Factures FNE : indicateurs **certifiées**, **en attente**, **en erreur** ; filtre par statut.

1. Traiter chaque jour les factures **en erreur** puis **en attente**.
2. Le **relevé de compte** du souscripteur affiche ses factures (numéro, statut, impression) ou « facture à émettre » s'il est soldé.

### FNE-07 — Facturer un souscripteur soldé

**Qui** : facturier. **Où** : **Souscripteurs**, bouton **🧾** de la ligne (ou **Factures FNE › Soldés à facturer**).

| Contrôle | Règle |
|---|---|
| Solde | Facturation refusée si le souscripteur n'a pas soldé (le reste à payer est indiqué) |
| Résiliation | Facturation refusée pour une souscription résiliée |
| Doublon | Refusée s'il existe déjà une facture (hors facture annulée par un avoir) |
| Montant | **Montant total du contrat** (avenants et régularisations inclus), traité comme un montant **HT** ; la TVA s'ajoute selon le paramétrage |
| Coordonnées | Téléphone et e-mail **bloquants** si la FNE est active |

1. Cliquer 🧾 sur un souscripteur soldé : la fenêtre s'ouvre préremplie (client, lot, programme, montant).
2. Lire les alertes (⛔ bloquant, ⚠️ avertissement) et compléter téléphone, e-mail et, pour une société, le **NCC** : ils sont aussi enregistrés sur la fiche.
3. Choisir le type de client (B2C ou B2B), le mode de paiement et **émettre**.
4. Après certification, le bouton 🧾 de la ligne devient vert et permet d'imprimer la facture.

### FNE-08 — Liste « Soldés à facturer » et émission en lot

**Qui** : facturier. **Où** : **Factures FNE**, encadré **✅ Souscripteurs soldés**.

1. Filtrer : **À facturer**, **À régulariser** (erreur ou non certifiée), **Facturés**, **Tous les soldés**.
2. Lire la colonne **Contrôle des données** : seules les lignes **✓ Complet** sont cochables.
3. Choisir le **mode de paiement** indiqué à la DGI pour le lot (virement par défaut : **à vérifier** avant d'émettre).
4. Cocher les lignes et cliquer **🧾 Émettre la sélection** ; lire la confirmation (production = certification réelle, annulable seulement par un avoir).
5. Traiter ensuite les factures **à régulariser** (FNE-04).
6. Si l'encadré affiche ⛔ (clé API absente), l'émission en lot est désactivée : corriger FNE-01.

### FNE-09 — Compléter les coordonnées en masse

**Qui** : facturier, accueil. **Où** : **Souscripteurs › ✉️ Coordonnées manquantes**, ou **Factures FNE › ✉️ Compléter les e-mails**.

1. Choisir la vue : soldés ou tous les actifs ; e-mail, téléphone ou les deux.
2. Saisir directement dans le tableau : l'e-mail doit être valide, le numéro est contrôlé et enregistré au format normalisé ; un e-mail déjà utilisé par un autre souscripteur donne un avertissement.
3. **Ou** exporter la liste en CSV, la faire compléter (colonne **Dossier** inchangée), puis **Importer un CSV** : les valeurs correctes sont chargées dans le tableau, jamais enregistrées d'office, et un champ déjà valide n'est jamais écrasé.
4. Lire le compte rendu d'import (dossiers introuvables, doublons, valeurs invalides) puis cliquer **Enregistrer**.

### FNE-10 — Passerelle serveur et mise en production

**Qui** : administrateur.

1. Vérifier que la passerelle répond : ouvrir `/api/fne-proxy?ping=1&env=test` sur le domaine de l'ERP (réponse `ok: true`).
2. Pour la **production**, définir la variable `FNE_URL_PROD` (URL fournie par la DGI) dans les variables d'environnement du projet d'hébergement, puis redéployer.
3. Tester en environnement de test : une facture certifiée de bout en bout, avec ses spécimens transmis à la DGI.
4. Passer l'environnement en **production** dans Paramètres, saisir la clé de production, puis émettre **une** première facture réelle et la contrôler.

La passerelle n'accepte que des appels du même site, ne relaie que l'émission et l'avoir, ne stocke ni ne journalise la clé API.

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
| FNE-07/08 | I | R/A | C | I |
| FNE-09 | I | R/A | I | I |
| FNE-10 | R/A | I | I | C |

## 7. Erreurs fréquentes

- Émettre en production sans test préalable.
- Refaire une facture au lieu de recertifier.
- Tenter un avoir sur une facture non certifiée.
- Confirmer un avoir sans vérifier la facture.
- Émettre en lot sans avoir vérifié le **mode de paiement** choisi.
- Facturer avant que le souscripteur ait **soldé** (le logiciel refuse).
- Laisser les **e-mails et téléphones** vides : presque aucune facture n'est alors prête.
- Oublier `FNE_URL_PROD` avant la production.

## 8. Liste de contrôle

- [ ] Connexion testée
- [ ] Aucune facture en erreur en fin de journée
- [ ] Avoirs validés par la Direction
- [ ] Soldés à facturer traités (aucun « à facturer » oublié)
- [ ] Coordonnées complètes avant chaque émission en lot

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
| 2.0 | Octobre 2026 | Facturation des souscripteurs soldés, émission en lot, coordonnées en masse, passerelle serveur, essai sans facture en production |
