# Manuel de procédure — Soumission d'une attestation de solde pour validation par la hiérarchie

**Réf.** PRO-ATT-SUB · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer les étapes, contrôles et responsabilités pour soumettre une attestation de solde à la validation du DG ou du gérant.
**Principe** : aucune attestation sans preuve comptable du solde. Montants jamais saisis à la main. Texte figé à la validation.

---

## 1. Champ d'application

| Élément | Précision |
|---|---|
| Documents | Attestation de solde initiale (ATS-AAAA-NNNN) et finale (ATF-AAAA-NNNN) |
| Émetteur | Comptabilité ou commercial |
| Valideur | DG, gérant (rôles `admin` ou `manager`) |
| Outil | ERP › fiche souscripteur › Documents ; menu **Validations** |

## 2. Rôles

| Rôle | Responsabilité |
|---|---|
| Comptabilité / commercial | Contrôle, soumet, suit, notifie le souscripteur |
| DG / gérant | Examine les pièces, valide ou rejette |
| Administrateur / gérant | Annule une validation faite par erreur |

## 3. Prérequis (à cocher avant soumission)

| # | Contrôle | Preuve |
|---|---|---|
| 1 | Souscripteur **soldé** (prix initial ; valeur finale pour ATF) | Fiche souscripteur |
| 2 | Contrat **non résilié** | Statut du dossier |
| 3 | Tous les versements ont un **reçu** et une **écriture comptable** | Journal / reçus |
| 4 | Espèces : **bon de caisse validé** | Module Caisse |
| 5 | Chèque / virement : **référence** renseignée | Fiche versement |
| 6 | Identité, pièce, désignation du bien **conformes** | Aperçu (bouton œil) |
| 7 | Suppléments facturés enregistrés (pour ATF) | Fiche souscripteur |
| 8 | Aucune demande déjà **en cours** | Statut « En attente DG/gérant » |

## 4. Procédure

### Étape 1 — Ouvrir le dossier
1. Fiche souscripteur › zone **Documents**.
2. Un **brouillon** existe déjà (créé au solde). Sinon, bouton **Faire valider**.

### Étape 2 — Contrôler l'aperçu
1. Bouton **œil** : lire identité, bien, prix, total versé, date de solde, versements.
2. Corriger à la source (versement, fiche) — jamais sur le document.

### Étape 3 — Choisir le visa souscripteur (facultatif)
- Notaire n'exigeant pas le visa : **Retirer le visa** avant soumission (motif non requis au stade brouillon).

### Étape 4 — Soumettre
1. Bouton **📤 Soumettre au DG**.
2. Statut → **⏳ En attente DG/gérant**.
3. Une demande apparaît dans **Validations** avec : type, numéro, souscripteur, dossier, montant.
4. Toast de confirmation : « Attestation transmise au DG / gérant ».

### Étape 5 — Prévenir la hiérarchie
- Informer le DG/gérant (appel, WhatsApp, e-mail) : numéro, souscripteur, urgence.

### Étape 6 — Examen par la hiérarchie
1. Menu **Validations** › ouvrir la demande.
2. **🔎 Pièces** : versements retenus, reçus, bons de caisse, références, écritures.
3. Lignes surlignées = anomalies à lever.
4. Décision : **Valider** ou **Rejeter** (motif obligatoire au rejet).
5. Sans consultation des pièces, l'ERP demande une confirmation.

### Étape 7 — Suite selon la décision

| Décision | Effet ERP | Action de l'émetteur |
|---|---|---|
| **Validée** | Texte figé ; date d'émission, validateur enregistrés ; ligne au dossier juridique | Imprimer « Sans modif. » ; publier au portail ; WhatsApp ; transmettre au notaire |
| **Rejetée** | Statut « Rejetée », motif conservé | Corriger la cause ; **Soumettre au DG** à nouveau |
| **Rejet automatique** | Souscripteur plus soldé à la validation | Contrôler versements annulés/modifiés ; re-soumettre une fois soldé |

### Étape 8 — Annulation d'une validation erronée
- Administrateur/gérant : **Annuler la validation** + motif obligatoire.
- Retour en brouillon ; retrait du portail et de l'espace notaire ; historique conservé.
- Reprendre à l'étape 4.

## 5. Blocages

| Situation | Message / effet |
|---|---|
| Non soldé | « Attestation impossible » |
| Contrat résilié | Soumission refusée |
| Demande déjà en cours | « Demande de validation déjà en cours » |
| Attestation déjà validée | Confirmation requise avant nouvelle demande |
| Valideur sans rôle admin/manager | « Validation réservée à la hiérarchie » |
| Souscripteur supprimé | Rejeter la demande ou restaurer le dossier |

## 6. Délais cibles

| Étape | Délai |
|---|---|
| Soumission après constat du solde | 24 h ouvrées |
| Décision de la hiérarchie | 48 h ouvrées |
| Remise au souscripteur après validation | 24 h ouvrées |
| Re-soumission après rejet | 48 h ouvrées |

## 7. Traçabilité

| Événement | Conservé dans |
|---|---|
| Soumission, validation, rejet | Menu Validations + dossier juridique |
| Demandeur / validateur / dates / motif | Fiche de validation |
| Annulations | Historique de l'attestation |
| Visa retiré / remis | Historique + dossier juridique |

## 8. RACI

| Activité | Compta / commercial | DG / gérant | Admin |
|---|---|---|---|
| Contrôle des prérequis | R | I | – |
| Soumission | R | I | – |
| Examen des pièces | C | R | – |
| Validation / rejet | I | A/R | – |
| Annulation de validation | C | C | A/R |
| Remise au souscripteur / notaire | R | I | – |

## 9. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Bouton « Soumettre » refuse | Non soldé ou résilié | Vérifier versements et statut |
| Demande absente de Validations | Demande déjà traitée ou supprimée | Vérifier statut attestation |
| Pièces signalées ⚠️ | Bon de caisse, référence ou écriture manquants | Régulariser avant décision |
| Rejet « non soldé à la validation » | Versement annulé entre-temps | Rétablir le versement, re-soumettre |
| Montant erroné après validation | Document figé | Annuler la validation, corriger, re-soumettre |

## 10. Liste de contrôle finale

1. ☐ Prérequis 1 à 8 validés
2. ☐ Aperçu relu
3. ☐ Visa choisi
4. ☐ Soumission faite, statut « En attente »
5. ☐ Hiérarchie informée
6. ☐ Décision obtenue et tracée
7. ☐ Document remis (portail / notaire / WhatsApp)

## 11. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
