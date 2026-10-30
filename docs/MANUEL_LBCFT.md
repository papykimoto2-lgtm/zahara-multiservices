# Manuel de procédures — Conformité LBC/FT

**Réf.** PRO-LBC · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour identifier les clients, détecter les opérations à examiner, déclarer les soupçons à la CENTIF-CI et geler les tiers sanctionnés.
**Principe directeur** : approche par les risques ; toute décision (écarter, déclarer, geler) est écrite, motivée et conservée ; une déclaration de soupçon est **confidentielle** et n'est jamais révélée au client.

> Les noms de boutons sont ceux du module **Conformité LBC/FT**. Seuils et textes : à faire valider par le responsable conformité et le conseil juridique ; le seuil sectoriel immobilier est indiqué « à confirmer » dans le code de l'ERP.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Responsable conformité** (correspondant) | Examine les alertes, établit et transmet les déclarations, anime le dispositif |
| **Direction** | Accède au registre des déclarations, décide les relations à risque élevé |
| **Commercial / comptabilité** | Constituent la fiche de vigilance, signalent toute opération inhabituelle |

Seuls les rôles **administrateur** et **gérant** accèdent au registre des déclarations.

## 2. Règles d'or

1. **Aucune relation d'affaires sans fiche de vigilance** au-delà du seuil.
2. **Ne jamais informer le client** d'une déclaration ou d'un soupçon.
3. Une alerte écartée exige un **motif écrit**.
4. Une déclaration doit être **circonstanciée** : faits et analyse (30 caractères au moins chacun).
5. Un tiers **gelé** ne peut plus recevoir de versement ni de commande.
6. Conservation des pièces : **10 ans** (réglable) après la fin de la relation.

## 3. Paramètres du dispositif

| Paramètre | Valeur par défaut |
|---|---|
| Seuil d'opérations cumulées (vigilance) | 9 000 000 FCFA |
| Seuil des règlements en espèces cumulés | 5 000 000 FCFA |
| Durée de conservation | 10 ans |
| Correspondant et suppléant | À renseigner (Dispositif interne) |

## 4. Procédures

### LBC-01 — Fiche de vigilance (KYC)

**Qui** : commercial ou comptabilité. **Où** : **+ Fiche de vigilance**.

| Bloc | Champs |
|---|---|
| Client | Personne physique ou morale (RCCM, NCC) |
| **Identité** | Type et **numéro de pièce (obligatoire)**, date d'expiration, naissance, nationalité, pays, adresse et justificatif, profession |
| **Bénéficiaire effectif** | Lui-même, tiers ou inconnu ; nom du bénéficiaire |
| **PPE** | Non, proche d'une PPE, ou PPE ; fonction |
| **Origine des fonds** | Justifiée, partielle ou non justifiée ; détail |
| Objet de la relation, notes | Texte libre |

1. Remplir ; le **niveau de risque** (faible, moyen, élevé) se calcule en direct avec ses motifs.
2. Enregistrer : référence KYC-NNNN, date de revue, relecteur, date de fin de conservation.

**Grille de risque** (points) : PPE 35 ; proche de PPE 25 ; pays en vigilance renforcée 25 ; bénéficiaire effectif inconnu 30 ou tiers 15 ; origine des fonds non justifiée 30 ou partielle 15 ; pièce absente 20 ; pièce expirée 10 ; personne morale sans RCCM 10 ; espèces cumulées au-dessus du seuil 20. Niveau **élevé** à partir de 60, **moyen** à partir de 30.

**Risque élevé** : vigilance renforcée ; **accord de la direction** avant d'entrer ou de poursuivre la relation ; suivi continu.

### LBC-02 — Opérations à examiner

**Qui** : responsable conformité. **Où** : **Opérations à examiner**.

L'ERP génère les alertes depuis les versements, quittances et dossiers diaspora :

| Alerte | Déclencheur |
|---|---|
| Vigilance | Cumul au-dessus du seuil sans fiche |
| Espèces | Règlements en espèces cumulés au-dessus du seuil |
| Risque | Profil à risque élevé |
| KYC | Relation engagée sans fiche |
| Remboursement | Remboursement après des versements importants |

Pour chaque alerte :
1. Examiner le dossier du client (versements, fiche, origine des fonds).
2. **Écarter** avec **motif écrit** (conservé pour le contrôle), ou **marquer pour examen**, ou **déclarer** (LBC-03).
3. Une alerte traitée ne réapparaît pas.

Une alerte n'est **pas** un soupçon : elle appelle un examen.

### LBC-03 — Déclaration de soupçon

**Qui** : responsable conformité (accès restreint). **Où** : alerte › Déclarer, ou **Déclarations de soupçon**.

1. Contrôler le client et ses opérations cumulées (dont les espèces).
2. Renseigner : date, montant, nature (opération ou tentative), exécution (avant ou après), **faits**, **analyse**, statut brouillon.
3. Enregistrer : référence DS-AAAA-NNNN ; l'alerte passe « déclarée ».
4. **Imprimer** la déclaration ; la **transmettre à la CENTIF-CI** par le canal officiel.
5. Passer le statut à **transmise** (date automatique) ; saisir l'**accusé de réception** et la suite donnée.
6. **Ne jamais en informer le client.**

### LBC-04 — Criblage des sanctions (SFC)

**Qui** : responsable conformité. **Où** : **Criblage SFC (listes CSNU)**.

1. **Charger** la liste de sanctions à jour.
2. **▶️ Lancer le criblage** : l'ERP compare clients et fournisseurs à la liste (seuil de similarité 80 % par défaut).
3. Pour chaque correspondance :
   - **Écarter** (homonymie) avec motif obligatoire ;
   - **Confirmer et geler** : le tiers est gelé immédiatement, motif et date enregistrés.
4. Imprimer le **retour d'informations** et le transmettre à la CENTIF.
5. Lever un gel : uniquement dans ce module, avec décision écrite.

Effets du gel : versements, bons de commande, factures et paiements refusés ; **suppression refusée** (la preuve du gel est conservée).

### LBC-05 — Gouvernance

**Où** : Dispositif interne, Suivi CAPPI, Suivi ConformX, ARTCI (données personnelles).

1. **Dispositif interne** : renseigner correspondant, suppléant, seuils, durée de conservation ; imprimer la **politique** LBC/FT et la **désignation** du correspondant.
2. Mettre à jour les suivis CAPPI, ConformX et ARTCI selon leur calendrier.

## 5. Contrôles

| Contrôle | Effet |
|---|---|
| Fiche sans numéro de pièce | Refusée |
| Alerte écartée sans motif | Refusée |
| Déclaration sans faits ou sans analyse | Irrecevable |
| Accès au registre sans rôle administrateur ou gérant | Refusé |
| Tiers gelé | Opérations bloquées, suppression refusée |

## 6. Traçabilité

| Événement | Conservé dans |
|---|---|
| Fiche de vigilance | Fiches KYC (revue, relecteur, conservation) |
| Alerte traitée | Alertes (statut, note, auteur, date) |
| Déclaration | Registre confidentiel (référence, faits, analyse, accusé) |
| Criblage | Criblages SFC (résultats, décisions, motifs) |

## 7. RACI

| Procédure | Commercial / compta | Resp. conformité | Direction |
|---|---|---|---|
| LBC-01 Fiche | R | C | A pour risque élevé |
| LBC-02 Alertes | I | R | I |
| LBC-03 Déclaration | – | R | A |
| LBC-04 Criblage | – | R | A |
| LBC-05 Gouvernance | – | R | A |

## 8. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Alerte de vigilance | Cumul au-dessus du seuil sans fiche | Établir la fiche |
| Risque élevé sans motif clair | Facteurs cumulés | Lire les motifs de la fiche |
| Versement refusé | Tiers gelé | Voir le criblage SFC |
| Registre inaccessible | Rôle insuffisant | Demander l'accès à la direction |

## 9. Liste de contrôle

1. ☐ Fiche de vigilance pour tout client au-dessus du seuil
2. ☐ Alertes traitées avec motif
3. ☐ Criblage SFC à jour après chaque mise à jour de liste
4. ☐ Déclarations transmises, accusés conservés
5. ☐ Politique et désignation du correspondant à jour

## 10. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
