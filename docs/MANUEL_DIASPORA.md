# Manuel de procédures — Investisseurs diaspora

**Réf.** PRO-DIA · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour sécuriser l'investissement d'un souscripteur de la diaspora : dossier, co-investisseurs, versements en devises placés sous séquestre, libération par jalons sur preuve, chaîne de preuve et certificat d'ancrage.
**Principe directeur** : les fonds de la diaspora entrent au **passif** (séquestre 4191), jamais en produit ; ils ne sortent que sur **jalon prouvé** par une chaîne de preuve intègre.

> Les noms de boutons sont ceux du module **Investisseurs Diaspora** (Dossiers, Co-investissement, Séquestre par jalons, Chaîne de preuve, Ancrage & certificat).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Gestionnaire diaspora** | Ouvre les dossiers, enregistre versements et jalons, scelle les preuves |
| **Validateur de jalon** | Atteste l'avancement et autorise la libération |
| **Comptabilité** | Contrôle les écritures de séquestre et de libération |
| **Direction** | Décide les libérations importantes |

## 2. Règles d'or

1. Un dossier exige **investisseur, pays de résidence et bien concerné**.
2. Les fonds restent **séquestrés** tant qu'un jalon n'est pas libéré.
3. Une libération exige : **fonds suffisants**, **au moins une preuve scellée**, **chaîne de preuve intègre**.
4. Le total des quotes-parts de co-investissement ne dépasse pas **100 %**.
5. Toute chaîne **altérée** bloque les libérations et l'ancrage.

## 3. Procédures

### DIA-01 — Ouvrir un dossier

**Où** : **+ Dossier diaspora** : investisseur (obligatoire), pays de résidence (obligatoire), bien concerné (obligatoire), statut, notes. Une référence est attribuée.

### DIA-02 — Co-investisseurs

**Où** : Co-investissement › ajouter : nom (obligatoire), quote-part (> 0 et ≤ 100) ; le cumul ne dépasse pas 100 %.

### DIA-03 — Versement en devises

**Où** : Séquestre par jalons › versement.

1. Saisir date, **devise**, **montant en devise** et **taux** de change (tous deux > 0), **frais de transfert**, mode, référence.
2. Le montant en FCFA = montant × taux ; le **net séquestré** = brut − frais.
3. Écriture : trésorerie au débit (net) et frais de transfert ; crédit au **séquestre 4191**.

### DIA-04 — Jalons de libération

**Où** : Séquestre par jalons › jalon.

1. Définir chaque jalon : **intitulé** et **montant** (> 0), validateur désigné ; statut « attente ».
2. Suivre le solde séquestré disponible pour chaque libération.

### DIA-05 — Chaîne de preuve

**Où** : Chaîne de preuve.

1. **Sceller** une preuve : choisir le dossier, **décrire** la preuve, joindre le fichier (photo, procès-verbal…) ; l'ERP calcule l'**empreinte** et chaîne le bloc au précédent (numéro, hash).
2. **Vérifier la chaîne** : tout bloc modifié est détecté.
3. Une chaîne altérée se corrige avant toute libération.

### DIA-06 — Libérer un jalon

1. Contrôler les trois conditions de la règle 3 ; confirmer la libération (montant, intitulé, preuve rattachée, validateur).
2. Le jalon passe à « libéré » avec la preuve et la date.
3. Écriture : séquestre 4191 au débit, compte client 4111 au crédit, avec l'empreinte de preuve.

### DIA-07 — Ancrage et certificat

**Où** : Ancrage & certificat.

1. **Générer** le certificat d'ancrage : refusé s'il n'y a aucune preuve ou si la chaîne est altérée.
2. **Imprimer** le certificat ; le **marquer déposé** une fois déposé.

### DIA-08 — Paiement en ligne

Un paiement diaspora réglé par la passerelle suit le même traitement : séquestre, jamais produit (PRO-PAI, PAI-07).

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Investisseur, pays ou bien absent | Dossier refusé |
| Montant ou taux nul | Versement refusé |
| Fonds séquestrés insuffisants | Libération refusée |
| Aucune preuve scellée | Libération refusée |
| Chaîne altérée | Libération et ancrage bloqués |
| Quote-parts > 100 % | Refusées |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Versement | Dossier (montant en devise, taux, FCFA, frais, net) + écriture |
| Preuve | Chaîne (index, hash, description) |
| Libération | Jalon (preuve, date, validateur) + écriture |
| Ancrage | Certificat référencé |

## 6. RACI

| Procédure | Gestionnaire | Validateur | Compta | Direction |
|---|---|---|---|---|
| DIA-01/02 Dossier | R | – | I | I |
| DIA-03 Versement | R | – | R | I |
| DIA-05 Preuve | R | C | – | I |
| DIA-06 Libération | R | A | C | A |
| DIA-07 Ancrage | R | C | – | I |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Libération refusée | Aucune preuve scellée | Sceller la preuve |
| « Chaîne altérée » | Bloc modifié | Corriger avant libération |
| Fonds insuffisants | Jalon supérieur au solde séquestré | Attendre ou enregistrer le versement |

## 8. Liste de contrôle

1. ☐ Dossier complet
2. ☐ Versements en devises séquestrés
3. ☐ Jalons définis avec validateur
4. ☐ Preuves scellées, chaîne vérifiée
5. ☐ Libérations tracées, certificat généré

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
